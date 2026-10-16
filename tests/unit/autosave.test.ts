import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SaveQueue, type SaveStatus } from "@/lib/autosave";

type P = { title: string; content: string };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("SaveQueue (automatic saving)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces rapid edits into a single request", async () => {
    const send = vi.fn(async () => ({ version: 2 }));
    const q = new SaveQueue<P>(send, 1, { debounceMs: 500 });
    q.update({ title: "a" });
    q.update({ title: "ab" });
    q.update({ content: "<p>x</p>" });
    await vi.advanceTimersByTimeAsync(499);
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ title: "ab", content: "<p>x</p>" }, 1);
  });

  it("never runs two requests at once and sends newer edits afterwards (no stale overwrite)", async () => {
    const first = deferred<{ version: number }>();
    const calls: [Partial<P>, number][] = [];
    const send = vi.fn((patch: Partial<P>, v: number) => {
      calls.push([patch, v]);
      return calls.length === 1 ? first.promise : Promise.resolve({ version: 3 });
    });
    const q = new SaveQueue<P>(send, 1, { debounceMs: 100 });

    q.update({ title: "old" });
    await vi.advanceTimersByTimeAsync(100);
    expect(send).toHaveBeenCalledTimes(1);

    q.update({ title: "new" }); // typed while the first save is in flight
    await vi.advanceTimersByTimeAsync(500);
    expect(send).toHaveBeenCalledTimes(1); // still waiting for the first

    first.resolve({ version: 2 });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(2);
    expect(calls[1]).toEqual([{ title: "new" }, 2]); // carries the version from the first response
    expect(q.version).toBe(3);
  });

  it("keeps failed edits, layers newer edits on top, and retries with backoff", async () => {
    let attempt = 0;
    const send = vi.fn(async (patch: Partial<P>) => {
      attempt++;
      if (attempt === 1) throw new Error("network");
      return { version: 2, patch };
    });
    const statuses: SaveStatus[] = [];
    const q = new SaveQueue<P>(send, 1, { debounceMs: 10, onStatus: (s) => statuses.push(s) });

    q.update({ title: "t1", content: "c1" });
    await vi.advanceTimersByTimeAsync(10);
    expect(statuses).toContain("error");

    q.update({ title: "t2" });
    await vi.advanceTimersByTimeAsync(1000);
    // the debounce for "t2" or the 1s retry fires — either way the merged payload is sent
    expect(send).toHaveBeenLastCalledWith({ title: "t2", content: "c1" }, 1);
    expect(q.status).toBe("saved");
    expect(q.hasUnsavedChanges).toBe(false);
  });

  it("stops and reports a version conflict instead of retrying", async () => {
    const conflict = Object.assign(new Error("conflict"), { conflict: true });
    const send = vi.fn(async () => {
      throw conflict;
    });
    const onConflict = vi.fn();
    const q = new SaveQueue<P>(send, 1, {
      debounceMs: 10,
      isConflict: (e) => (e as { conflict?: boolean }).conflict === true,
      onConflict,
    });
    q.update({ content: "mine" });
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(onConflict).toHaveBeenCalledWith(conflict);
    expect(q.status).toBe("conflict");
    expect(q.pendingPatch).toEqual({ content: "mine" });
  });

  it("flush() saves immediately without waiting for the debounce", async () => {
    const send = vi.fn(async () => ({ version: 5 }));
    const q = new SaveQueue<P>(send, 4, { debounceMs: 10_000 });
    q.update({ title: "now" });
    await q.flush();
    expect(send).toHaveBeenCalledWith({ title: "now" }, 4);
    expect(q.version).toBe(5);
  });

  it("reset() discards queued edits and adopts the server version", async () => {
    const send = vi.fn(async () => ({ version: 9 }));
    const q = new SaveQueue<P>(send, 1, { debounceMs: 100 });
    q.update({ title: "x" });
    q.reset(7);
    await vi.advanceTimersByTimeAsync(200);
    expect(send).not.toHaveBeenCalled();
    expect(q.version).toBe(7);
  });
});
