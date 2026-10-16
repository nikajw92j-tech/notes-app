import path from "node:path";
import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabaseUrl.replace(/^http/, "ws");

const csp = [
  "default-src 'self'",
  // Next.js inlines small bootstrap scripts; 'unsafe-eval' only in dev for React Refresh
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // note images: our /api/files redirect → Supabase signed URLs; https images pasted into notes
  `img-src 'self' data: blob: https:`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseUrl} ${supabaseWs}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com " + supabaseUrl,
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
