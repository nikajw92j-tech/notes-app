"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Images,
  Languages,
  Lock,
  LogOut,
  Moon,
  Sun,
  SunMoon,
  Trash2,
  Type,
  UserRound,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/app/header";
import { Avatar } from "@/components/app/profile-menu";
import { useWorkspace } from "@/components/app/workspace";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { FormError } from "@/components/auth/auth-card";
import { changePassword, logout, type AuthState } from "@/lib/actions/auth";
import { api, errorMessage } from "@/lib/client/api";
import { LOCALES, useI18n, type MessageKey } from "@/lib/i18n";
import type { FontTheme, Locale, Profile, StoredFile, Theme } from "@/lib/types";
import { cn } from "@/lib/cn";

const SECTIONS = [
  { id: "profile", label: "settings.profile", icon: UserRound },
  { id: "theme", label: "settings.colorTheme", icon: Sun },
  { id: "font", label: "settings.fontTheme", icon: Type },
  { id: "language", label: "settings.language", icon: Languages },
  { id: "password", label: "settings.password", icon: Lock },
  { id: "files", label: "settings.files", icon: Images },
  { id: "account", label: "settings.account", icon: UserX },
] as const satisfies readonly { id: string; label: MessageKey; icon: unknown }[];

type SectionId = (typeof SECTIONS)[number]["id"];

/* ------------------------------------------------------------------ */

function PanelHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h2 className="text-preset-3 text-fg">{title}</h2>
      {description && <p className="text-preset-5 text-fg-3">{description}</p>}
    </div>
  );
}

function RadioCards<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; title: string; description?: string; icon: React.ReactNode }[];
}) {
  return (
    <div role="radiogroup" className="flex flex-col gap-4">
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-neutral-500",
              checked ? "border-line bg-muted" : "border-line hover:bg-hover",
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-bg text-fg">
              {o.icon}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-preset-4 text-fg">{o.title}</span>
              {o.description && <span className="text-preset-6 text-fg-3">{o.description}</span>}
            </span>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                checked ? "border-blue-500" : "border-line-strong",
              )}
            >
              <motion.span
                initial={false}
                animate={{ scale: checked ? 1 : 0 }}
                className="size-2 rounded-full bg-blue-500"
              />
            </span>
          </label>
        );
      })}
    </div>
  );
}

function ApplyRow({ onApply, disabled, loading }: { onApply: () => void; disabled?: boolean; loading?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="mt-6 flex justify-end">
      <Button onClick={onApply} disabled={disabled} loading={loading}>
        {t("settings.apply")}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ThemePanel() {
  const { t } = useI18n();
  const { settings, updateSettings } = useWorkspace();
  const [value, setValue] = useState<Theme>(settings.theme);
  const [saving, setSaving] = useState(false);
  return (
    <>
      <PanelHeading title={t("settings.colorTheme")} description={t("settings.colorDesc")} />
      <RadioCards<Theme>
        name="theme"
        value={value}
        onChange={setValue}
        options={[
          { value: "light", title: t("settings.light"), description: t("settings.lightDesc"), icon: <Sun className="size-5" /> },
          { value: "dark", title: t("settings.dark"), description: t("settings.darkDesc"), icon: <Moon className="size-5" /> },
          { value: "system", title: t("settings.system"), description: t("settings.systemDesc"), icon: <SunMoon className="size-5" /> },
        ]}
      />
      <ApplyRow
        disabled={value === settings.theme}
        loading={saving}
        onApply={async () => {
          setSaving(true);
          if (await updateSettings({ theme: value })) toast.success(t("toast.settingsSaved"));
          setSaving(false);
        }}
      />
    </>
  );
}

function FontPanel() {
  const { t } = useI18n();
  const { settings, updateSettings } = useWorkspace();
  const current = settings.preferences.font ?? "sans";
  const [value, setValue] = useState<FontTheme>(current);
  const [saving, setSaving] = useState(false);
  const sample = (font: string) => <span className="text-preset-3" style={{ fontFamily: font }}>Aa</span>;
  return (
    <>
      <PanelHeading title={t("settings.fontTheme")} description={t("settings.fontDesc")} />
      <RadioCards<FontTheme>
        name="font"
        value={value}
        onChange={setValue}
        options={[
          { value: "sans", title: t("settings.sans"), description: t("settings.sansDesc"), icon: sample("var(--font-inter)") },
          { value: "serif", title: t("settings.serif"), description: t("settings.serifDesc"), icon: sample("var(--font-noto-serif)") },
          { value: "mono", title: t("settings.mono"), description: t("settings.monoDesc"), icon: sample("var(--font-source-code)") },
        ]}
      />
      <ApplyRow
        disabled={value === current}
        loading={saving}
        onApply={async () => {
          setSaving(true);
          if (await updateSettings({ preferences: { font: value } })) toast.success(t("toast.settingsSaved"));
          setSaving(false);
        }}
      />
    </>
  );
}

function LanguagePanel() {
  const { t } = useI18n();
  const { settings, updateSettings } = useWorkspace();
  const [value, setValue] = useState<Locale>(settings.language);
  const [saving, setSaving] = useState(false);
  return (
    <>
      <PanelHeading title={t("settings.language")} description={t("settings.languageDesc")} />
      <RadioCards<Locale>
        name="language"
        value={value}
        onChange={setValue}
        options={LOCALES.map((l) => ({
          value: l.code,
          title: l.label,
          icon: <span className="text-preset-6 font-semibold uppercase">{l.code}</span>,
        }))}
      />
      <ApplyRow
        disabled={value === settings.language}
        loading={saving}
        onApply={async () => {
          setSaving(true);
          if (await updateSettings({ language: value })) toast.success(t("toast.settingsSaved"));
          setSaving(false);
        }}
      />
    </>
  );
}

function ProfilePanel() {
  const { t } = useI18n();
  const { profile, setProfile } = useWorkspace();
  const [username, setUsername] = useState(profile.username ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const next = await api<Profile>("/api/profile", {
        method: "PATCH",
        json: { username: username.trim() || null },
      });
      setProfile(next);
      toast.success(t("settings.profileSaved"));
    } catch (err) {
      setError(errorMessage(err, t("toast.error")));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      setProfile(await api<Profile>("/api/profile/avatar", { method: "POST", body: form }));
      toast.success(t("settings.avatarUpdated"));
    } catch (err) {
      toast.error(errorMessage(err, t("toast.error")));
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    setUploading(true);
    try {
      setProfile(await api<Profile>("/api/profile/avatar", { method: "DELETE" }));
      toast.success(t("settings.avatarRemoved"));
    } catch (err) {
      toast.error(errorMessage(err, t("toast.error")));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <PanelHeading title={t("settings.profile")} description={t("settings.profileDesc")} />
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Avatar size={64} className="text-preset-2" />
          <div className="flex flex-col gap-2">
            <span className="text-preset-4 text-fg">{t("settings.avatar")}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="border" loading={uploading} onClick={() => fileRef.current?.click()}>
                {t("settings.upload")}
              </Button>
              {profile.avatar_url && (
                <Button size="sm" variant="ghost" disabled={uploading} onClick={removeAvatar}>
                  {t("settings.remove")}
                </Button>
              )}
            </div>
            <span className="text-preset-6 text-fg-4">{t("settings.avatarHint")}</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {profile.is_guest && (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-line bg-muted p-4 text-preset-5 text-fg-3">
            <p>{t("settings.guestNotice")}</p>
            <Link href="/login" className="focus-ring rounded text-preset-4 text-blue-500 hover:underline">
              {t("profile.loginToAccount")}
            </Link>
          </div>
        )}

        <form onSubmit={save} className="flex flex-col gap-4">
          {!profile.is_guest && <Field label={t("settings.email")} value={profile.email} readOnly disabled />}
          <Field
            label={t("settings.username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            hint={t("settings.usernameHint")}
            error={error}
            maxLength={30}
            autoComplete="username"
          />
          <div className={cn("flex flex-col gap-1.5", profile.is_guest && "hidden")}>
            <span className="text-preset-4 text-fg">{t("settings.signInMethods")}</span>
            <div className="flex flex-wrap gap-1.5">
              {(profile.providers.length ? profile.providers : ["email"]).map((p) => (
                <span key={p} className="rounded bg-chip px-2 py-0.5 text-preset-6 text-fg capitalize">
                  {p}
                </span>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={saving} disabled={(profile.username ?? "") === username.trim()}>
              {t("dialog.save")}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

function PasswordPanel() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AuthState, FormData>(changePassword, {});
  const formRef = useRef<HTMLFormElement>(null);
  const err = (code?: string) => (code ? t(`auth.err.${code}` as MessageKey) : undefined);

  useEffect(() => {
    if (state.done) {
      toast.success(t("settings.passwordUpdated"));
      formRef.current?.reset();
    }
  }, [state, t]);

  return (
    <>
      <PanelHeading title={t("settings.password")} description={t("settings.passwordDesc")} />
      <form ref={formRef} action={action} className="flex flex-col gap-4" noValidate>
        <FormError message={err(state.error)} />
        <Field
          label={t("settings.newPassword")}
          name="password"
          type="password"
          autoComplete="new-password"
          hint={t("settings.passwordHint")}
          error={err(state.fieldErrors?.password)}
        />
        <Field
          label={t("settings.confirmPassword")}
          name="confirm"
          type="password"
          autoComplete="new-password"
          error={err(state.fieldErrors?.confirm)}
        />
        <div className="flex justify-end">
          <Button type="submit" loading={pending}>
            {t("settings.savePassword")}
          </Button>
        </div>
      </form>
    </>
  );
}

function FilesPanel() {
  const { t } = useI18n();
  const [files, setFiles] = useState<StoredFile[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [target, setTarget] = useState<StoredFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setFiles(await api<StoredFile[]>("/api/files?bucket=note-images"));
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      await api(target.src, { method: "DELETE" });
      setFiles((f) => f?.filter((x) => x.path !== target.path) ?? f);
      toast.success(t("settings.fileDeleted"));
      setTarget(null);
    } catch (err) {
      toast.error(errorMessage(err, t("toast.error")));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PanelHeading title={t("settings.files")} description={t("settings.filesDesc")} />
      {failed ? (
        <Button variant="border" size="sm" onClick={load}>
          {t("common.retry")}
        </Button>
      ) : files === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong p-8 text-center text-preset-5 text-fg-4">
          <ImageOff className="size-8" />
          {t("settings.noFiles")}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <AnimatePresence initial={false}>
            {files.map((f) => (
              <motion.li
                key={f.path}
                layout
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-gated image */}
                <img src={f.src} alt={f.name} loading="lazy" className="size-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2 text-[11px] text-white">
                  <span>{(f.size / 1024).toFixed(0)} KB</span>
                  <button
                    type="button"
                    onClick={() => setTarget(f)}
                    aria-label={t("settings.deleteFile")}
                    className="focus-ring flex size-7 cursor-pointer items-center justify-center rounded-md bg-black/40 hover:bg-red-500"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        onConfirm={remove}
        loading={deleting}
        title={t("settings.deleteFileTitle")}
        description={t("settings.deleteFileBody")}
      />
    </>
  );
}

function AccountPanel() {
  const { t } = useI18n();
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const inputId = useId();

  const remove = async () => {
    setDeleting(true);
    try {
      await api("/api/account", { method: "DELETE", json: { confirm } });
      window.location.href = "/login";
    } catch (err) {
      toast.error(errorMessage(err, t("toast.error")));
      setDeleting(false);
    }
  };

  return (
    <>
      <PanelHeading title={t("settings.account")} description={t("settings.accountDesc")} />
      <div className="flex flex-col gap-4 rounded-xl border border-red-500/30 p-4">
        <Field
          id={inputId}
          label={t("settings.typeDelete")}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
        />
        <div className="flex justify-end">
          <Button variant="danger" disabled={confirm !== "DELETE"} loading={deleting} onClick={remove}>
            <Trash2 className="size-4" />
            {t("settings.deleteAccount")}
          </Button>
        </div>
      </div>
    </>
  );
}

const PANELS: Record<SectionId, () => React.ReactElement> = {
  profile: ProfilePanel,
  theme: ThemePanel,
  font: FontPanel,
  language: LanguagePanel,
  password: PasswordPanel,
  files: FilesPanel,
  account: AccountPanel,
};

/* ------------------------------------------------------------------ */

export function SettingsView() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const raw = sp.get("section");
  const section = SECTIONS.some((s) => s.id === raw) ? (raw as SectionId) : null;
  const active: SectionId = section ?? "theme";
  const Panel = PANELS[active];

  useEffect(() => {
    document.title = `${t("settings.title")} · ${t("app.name")}`;
  }, [t]);

  const go = (id: SectionId | null) => router.replace(id ? `${pathname}?section=${id}` : pathname, { scroll: false });

  return (
    <>
      <Header title={t("settings.title")} />
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label={t("settings.title")}
          className={cn(
            "w-full shrink-0 flex-col gap-2 overflow-y-auto px-4 pt-5 pb-24 md:px-8 lg:flex lg:w-[258px] lg:border-r lg:border-line lg:px-4 lg:pb-5",
            section ? "hidden" : "flex",
          )}
        >
          <h1 className="mb-2 text-preset-1 text-fg lg:hidden">{t("settings.title")}</h1>
          <ul className="flex flex-col gap-1">
            {SECTIONS.map(({ id, label, icon: Icon }) => {
              const isActive = active === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => go(id)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "focus-ring relative flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-preset-4 transition-colors",
                      isActive ? "text-fg lg:bg-muted" : "text-fg-3 hover:bg-hover hover:text-fg",
                    )}
                  >
                    <Icon className={cn("size-5", isActive ? "lg:text-blue-500" : "", id === "account" && "text-red-500")} />
                    <span className="flex-1">{t(label)}</span>
                    <ChevronRight className={cn("size-5", isActive ? "lg:opacity-100" : "lg:opacity-0")} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="my-2 h-px bg-line" />
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => logout())}
            className="focus-ring flex h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-preset-4 text-fg-3 transition-colors hover:bg-hover hover:text-fg disabled:opacity-60"
          >
            <LogOut className="size-5" />
            {t("settings.logout")}
          </button>
        </nav>

        <section
          className={cn(
            "min-w-0 flex-1 overflow-y-auto px-4 pt-5 pb-24 md:px-8 lg:block lg:pt-8 lg:pb-8",
            section ? "block" : "hidden",
          )}
        >
          <button
            type="button"
            onClick={() => go(null)}
            className="focus-ring mb-4 -ml-1 flex cursor-pointer items-center gap-1 rounded px-1 text-preset-5 text-fg-3 hover:text-fg lg:hidden"
          >
            <ChevronLeft className="size-[18px]" />
            {t("settings.back")}
          </button>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.16 }}
              className="max-w-[528px]"
            >
              <Panel />
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </>
  );
}
