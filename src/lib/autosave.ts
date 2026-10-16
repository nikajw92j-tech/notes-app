export type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error" | "offline" | "conflict";

export interface SaveResult {
  version: number;
}

export type SendFn<P> = (patch: P, expectedVersion: number) => Promise<SaveResult>;

export interface SaveQueueOptions {
  debounceMs?: number;
  maxRetryMs?: number;
  onStatus?: (status: SaveStatus) => void;
  /** Called when the server rejects the write because the note changed elsewhere. */
  onConflict?: (error: unknown) => void;
  onSaved?: (result: SaveResult) => void;
  isConflict?: (error: unknown) => boolean;
  /** Non-retryable errors (validation, 404) stop retrying. */
  isFatal?: (error: unknown) => boolean;
  isOffline?: () => boolean;
}

/**
 * Debounced, strictly sequential saver for a single document.
 *
 * Guarantees:
 * - at most one request in flight, so responses can never arrive out of order;
 * - edits made while a request is in flight are merged and sent afterwards,
 *   so an older payload can never overwrite newer content;
 * - failed payloads are merged *under* newer edits and retried with backoff;
 * - every write carries the last known server version (optimistic locking).
 */
export class SaveQueue<P extends object> {
  private pending: Partial<P> | null = null;
  private inFlight: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 0;
  private stopped = false;
  private _status: SaveStatus = "idle";

  constructor(
    private readonly send: SendFn<Partial<P>>,
    public version: number,
    private readonly opts: SaveQueueOptions = {},
  ) {}

  get status() {
    return this._status;
  }

  get hasUnsavedChanges() {
    return this.pending !== null || this.inFlight !== null;
  }

  /** Snapshot of edits not yet confirmed by the server (for local backup). */
  get pendingPatch(): Partial<P> | null {
    return this.pending ? { ...this.pending } : null;
  }

  update(patch: Partial<P>) {
    if (this.stopped) return;
    this.pending = { ...(this.pending ?? {}), ...patch };
    this.setStatus("unsaved");
    this.schedule(this.opts.debounceMs ?? 800);
  }

  /** Save immediately and resolve once everything queued so far is persisted (or failed). */
  async flush(): Promise<void> {
    this.clearTimer();
    while (!this.stopped) {
      if (this.inFlight) {
        await this.inFlight;
        continue;
      }
      if (!this.pending) return;
      await this.run();
      if (this._status === "error" || this._status === "offline" || this._status === "conflict") return;
    }
  }

  /** Stop timers and drop queued work (e.g. after a conflict is resolved by reloading). */
  dispose() {
    this.stopped = true;
    this.clearTimer();
  }

  /** Retry queued edits now (e.g. back online, or "keep mine" after a conflict). */
  retry() {
    if (this.stopped || !this.pending) return;
    this.retryDelay = 0;
    this.setStatus("unsaved");
    this.schedule(0);
  }

  /** Accept a newer server version (e.g. after reloading) and discard queued edits. */
  reset(version: number) {
    this.version = version;
    this.pending = null;
    this.retryDelay = 0;
    this.clearTimer();
    this.setStatus("saved");
  }

  private setStatus(status: SaveStatus) {
    if (this._status === status) return;
    this._status = status;
    this.opts.onStatus?.(status);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(ms: number) {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.run();
    }, ms);
  }

  private run(): Promise<void> {
    if (this.inFlight || !this.pending || this.stopped) return this.inFlight ?? Promise.resolve();
    const payload = this.pending;
    this.pending = null;
    this.setStatus("saving");

    this.inFlight = (async () => {
      try {
        const result = await this.send(payload, this.version);
        this.version = result.version;
        this.retryDelay = 0;
        this.opts.onSaved?.(result);
        if (this.pending) {
          this.setStatus("unsaved");
          this.schedule(0);
        } else {
          this.setStatus("saved");
        }
      } catch (error) {
        // Keep the failed edits, with anything typed since layered on top.
        this.pending = { ...payload, ...(this.pending ?? {}) };
        if (this.opts.isConflict?.(error)) {
          this.setStatus("conflict");
          this.opts.onConflict?.(error);
          return;
        }
        if (this.opts.isFatal?.(error)) {
          this.setStatus("error");
          return;
        }
        this.setStatus(this.opts.isOffline?.() ? "offline" : "error");
        const max = this.opts.maxRetryMs ?? 30_000;
        this.retryDelay = Math.min(max, this.retryDelay ? this.retryDelay * 2 : 1000);
        this.schedule(this.retryDelay);
      } finally {
        this.inFlight = null;
      }
    })();
    return this.inFlight;
  }
}
