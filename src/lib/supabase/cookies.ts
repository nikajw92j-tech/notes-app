/**
 * Session cookies are HttpOnly: page scripts can never read the refresh token.
 * The browser only ever receives a short-lived access token (for Realtime) via
 * GET /api/session/realtime-token.
 */
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
