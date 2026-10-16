function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

// NEXT_PUBLIC_* values must be referenced literally so Next can inline them.
export const publicEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get siteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  },
};
