import { ApiError, route } from "@/lib/api";

/**
 * Returns the current short-lived access token so the browser can authorise
 * its Realtime socket. The refresh token stays in an HttpOnly cookie.
 */
export const GET = route(async ({ supabase }) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new ApiError(401, "unauthorized", "Authentication required");
  return { access_token: session.access_token, expires_at: session.expires_at ?? null };
});
