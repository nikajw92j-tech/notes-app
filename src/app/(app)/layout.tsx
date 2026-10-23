import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getSettings } from "@/lib/services/account";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/start");

  const [profile, settings] = await Promise.all([getProfile(supabase, user), getSettings(supabase, user.id)]);

  return (
    <AppShell profile={profile} settings={settings}>
      {children}
    </AppShell>
  );
}
