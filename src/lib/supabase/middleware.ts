import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_OPTIONS } from "./cookies";

const PROTECTED = ["/notes", "/settings"];
const AUTH_ONLY = ["/login", "/signup", "/forgot-password"];

export function isGuest(user: { is_anonymous?: boolean; user_metadata?: Record<string, unknown> }) {
  return user.is_anonymous === true || user.user_metadata?.guest === true;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Validates the JWT with Supabase Auth and refreshes it when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const redirectTo = (target: string, keepNext = false) => {
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = keepNext ? `?next=${encodeURIComponent(path + request.nextUrl.search)}` : "";
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  // No registration needed: visitors without a session get a guest session.
  if (!user && PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    return redirectTo("/start", true);
  }
  if (user && path === "/start") {
    return redirectTo("/notes");
  }
  // Guests may still open login/sign-up to switch to a real account.
  if (user && !isGuest(user) && AUTH_ONLY.includes(path)) {
    return redirectTo("/notes");
  }
  if (path === "/") {
    return redirectTo(user ? "/notes" : "/start");
  }
  return response;
}
