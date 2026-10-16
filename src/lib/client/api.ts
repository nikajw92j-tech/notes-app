import type { ApiErrorBody } from "@/lib/types";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
  get isNetwork() {
    return this.status === 0;
  }
}

export async function api<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: {
        Accept: "application/json",
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiClientError(0, "network", "Network error");
  }

  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
    throw new ApiClientError(
      res.status,
      body?.error?.code ?? "http_error",
      body?.error?.message ?? res.statusText,
      body?.error?.details,
    );
  }
  return body as T;
}

export function errorMessage(err: unknown, fallback: string) {
  if (err instanceof ApiClientError && err.status !== 500 && err.status !== 0) return err.message;
  return fallback;
}
