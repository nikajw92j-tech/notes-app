import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

/**
 * PKCE code exchange for OAuth sign-in, email confirmation and password
 * recovery links (Supabase default email templates).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (searchParams.get("error")) {
    const isOauth = !next.startsWith("/reset-password");
    return NextResponse.redirect(`${origin}/login?error=${isOauth ? "oauth" : "link_invalid"}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link_invalid`);
}
