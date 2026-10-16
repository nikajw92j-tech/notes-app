import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ZodError, type ZodType } from "zod";
import { createClient, createClientWithToken } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new ApiError(404, "not_found", `${what} not found`);

interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string;
}

/** Map a Supabase/PostgREST error onto an ApiError. */
export function dbError(error: PostgrestLikeError): ApiError {
  switch (error.code) {
    case "PGRST116":
    case "P0002":
      return notFound();
    case "23505":
      return new ApiError(409, "conflict", "A record with that value already exists");
    case "23503":
      return new ApiError(400, "invalid_reference", "Referenced record does not exist");
    case "23514":
    case "22P02":
    case "22001":
      return new ApiError(400, "invalid_input", "Invalid input");
    case "42501":
      return new ApiError(403, "forbidden", "Not allowed");
    default:
      console.error("[db]", error);
      return new ApiError(500, "db_error", "Database error");
  }
}

export interface Ctx<P> {
  req: NextRequest;
  params: P;
  supabase: SupabaseClient;
  user: User;
}

interface Options {
  rateLimit?: { name: string; limit: number; windowMs: number };
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients; SameSite cookies still apply
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Wrap a route handler with authentication, CSRF origin check, optional rate
 * limiting and uniform JSON error responses. Handlers return either a Response
 * or a JSON-serialisable value.
 */
export function route<P extends Record<string, string | string[]> = Record<string, never>>(
  handler: (ctx: Ctx<P>) => Promise<unknown>,
  options: Options = {},
) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

      if (!bearer && MUTATING.has(req.method) && !sameOrigin(req)) {
        throw new ApiError(403, "bad_origin", "Cross-origin request rejected");
      }

      const supabase = bearer ? createClientWithToken(bearer) : await createClient();
      const {
        data: { user },
      } = bearer ? await supabase.auth.getUser(bearer) : await supabase.auth.getUser();
      if (!user) throw new ApiError(401, "unauthorized", "Authentication required");

      if (options.rateLimit) {
        const { name, limit, windowMs } = options.rateLimit;
        const rl = rateLimit(`${name}:${user.id}:${clientIp(req.headers)}`, limit, windowMs);
        if (!rl.ok) {
          return NextResponse.json(
            { error: { code: "rate_limited", message: "Too many requests" } },
            { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
          );
        }
      }

      const params = (await context.params) ?? ({} as P);
      const result = await handler({ req, params, supabase, user });
      if (result instanceof Response) return result;
      if (result === undefined) return new NextResponse(null, { status: 204 });
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: err.issues[0]?.message ?? "Invalid input",
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      { status: 400 },
    );
  }
  console.error("[api]", err);
  return NextResponse.json(
    { error: { code: "internal_error", message: "Something went wrong" } },
    { status: 500 },
  );
}

export async function parseJson<T>(req: NextRequest, schema: ZodType<T>, maxBytes = 2_500_000): Promise<T> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > maxBytes) throw new ApiError(413, "payload_too_large", "Request body too large");
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > maxBytes) throw new ApiError(413, "payload_too_large", "Request body too large");
    body = text ? JSON.parse(text) : {};
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "invalid_json", "Body must be valid JSON");
  }
  return schema.parse(body);
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  const raw: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    if (v !== "") raw[k] = v;
  });
  return schema.parse(raw);
}
