"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Keyboard, LogIn, LogOut, Moon, Settings, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { useWorkspace } from "@/components/app/workspace";
import { logout } from "@/lib/actions/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/cn";

export function Avatar({ size = 36, className }: { size?: number; className?: string }) {
  const { profile } = useWorkspace();
  const initial = (profile.username || profile.email || "?").charAt(0).toUpperCase();
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-500 text-preset-4 text-white",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {profile.avatar_src ? (
        // eslint-disable-next-line @next/next/no-img-element -- private, auth-gated image via redirect
        <img src={profile.avatar_src} alt="" className="size-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}

export function ProfileMenu() {
  const { t } = useI18n();
  const router = useRouter();
  const { profile, setShortcutsOpen, updateSettings } = useWorkspace();
  const { resolvedTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const isDark = resolvedTheme === "dark";

  return (
    <Menu
      label={t("profile.menu")}
      trigger={(p) => (
        <button
          {...p}
          type="button"
          aria-label={t("profile.menu")}
          className="focus-ring cursor-pointer rounded-full transition-transform hover:scale-105"
        >
          <Avatar />
        </button>
      )}
      className="w-64"
    >
      <MenuLabel>{t("profile.signedInAs")}</MenuLabel>
      <div className="truncate px-2.5 pb-2 text-preset-4 text-fg">
        {profile.username || (profile.is_guest ? t("profile.guest") : profile.email)}
      </div>
      <MenuSeparator />
      <MenuItem icon={<Settings />} onSelect={() => router.push("/settings")}>
        {t("nav.settings")}
      </MenuItem>
      <MenuItem icon={<Keyboard />} onSelect={() => setShortcutsOpen(true)}>
        {t("profile.shortcuts")}
      </MenuItem>
      <MenuItem
        icon={isDark ? <Sun /> : <Moon />}
        onSelect={() => void updateSettings({ theme: isDark ? "light" : "dark" })}
      >
        {t(isDark ? "profile.lightMode" : "profile.darkMode")}
      </MenuItem>
      <MenuSeparator />
      {profile.is_guest ? (
        // Logging a guest out would orphan their notes, so offer sign-in instead.
        <MenuItem icon={<LogIn />} onSelect={() => router.push("/login")}>
          {t("profile.loginToAccount")}
        </MenuItem>
      ) : (
        <MenuItem icon={<LogOut />} disabled={pending} onSelect={() => startTransition(() => logout())}>
          {t("profile.logout")}
        </MenuItem>
      )}
    </Menu>
  );
}
