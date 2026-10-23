"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { AuthCard, FormError, FormSuccess } from "@/components/auth/auth-card";
import { GoogleButton } from "@/components/auth/google-button";
import {
  login,
  requestPasswordReset,
  resetPassword,
  signup,
  type AuthState,
} from "@/lib/actions/auth";
import { useI18n, type MessageKey } from "@/lib/i18n";

function useErr() {
  const { t } = useI18n();
  return (code?: string) => (code ? t(`auth.err.${code}` as MessageKey) : undefined);
}

const linkClass = "focus-ring rounded text-fg hover:text-blue-500 hover:underline";

export function LoginForm() {
  const { t } = useI18n();
  const err = useErr();
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const [state, action, pending] = useActionState<AuthState, FormData>(login, {});
  const urlError = params.get("error");

  return (
    <AuthCard
      title={t("auth.welcome")}
      subtitle={t("auth.loginSubtitle")}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <Link href="/signup" className={linkClass}>
            {t("auth.signup")}
          </Link>
        </>
      }
    >
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError message={err(state.error ?? urlError ?? undefined)} />
        <input type="hidden" name="next" value={next} />
        <Field
          label={t("auth.email")}
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t("auth.emailPlaceholder")}
          required
          error={err(state.fieldErrors?.email)}
        />
        <Field
          label={t("auth.password")}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={err(state.fieldErrors?.password)}
          labelAction={
            <Link href="/forgot-password" className={`${linkClass} text-preset-6 text-fg-4 underline`}>
              {t("auth.forgot")}
            </Link>
          }
        />
        <Button type="submit" loading={pending} className="w-full">
          {t("auth.login")}
        </Button>
      </form>
      <GoogleButton next={next} />
      <Link href="/start" className={`${linkClass} self-center text-preset-5 text-fg-4`}>
        {t("auth.continueAsGuest")}
      </Link>
    </AuthCard>
  );
}

export function SignupForm() {
  const { t } = useI18n();
  const err = useErr();
  const [state, action, pending] = useActionState<AuthState, FormData>(signup, {});

  return (
    <AuthCard
      title={t("auth.signupTitle")}
      subtitle={t("auth.signupSubtitle")}
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className={linkClass}>
            {t("auth.login")}
          </Link>
        </>
      }
    >
      {state.done ? (
        <FormSuccess title={t("auth.checkEmail")}>
          {t("auth.checkEmailSignup", { email: state.email ?? "" })}
        </FormSuccess>
      ) : (
        <>
          <form action={action} className="flex flex-col gap-4" noValidate>
            <FormError message={err(state.error)} />
            <Field
              label={t("auth.email")}
              name="email"
              type="email"
              autoComplete="email"
              placeholder={t("auth.emailPlaceholder")}
              required
              error={err(state.fieldErrors?.email)}
            />
            <Field
              label={t("auth.password")}
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              hint={t("auth.passwordHint")}
              error={err(state.fieldErrors?.password)}
            />
            <Button type="submit" loading={pending} className="w-full">
              {t("auth.signup")}
            </Button>
          </form>
          <GoogleButton />
        </>
      )}
    </AuthCard>
  );
}

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const err = useErr();
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {});

  return (
    <AuthCard
      title={t("auth.forgotTitle")}
      subtitle={t("auth.forgotSubtitle")}
      footer={
        <Link href="/login" className={linkClass}>
          {t("auth.backToLogin")}
        </Link>
      }
    >
      {state.done ? (
        <FormSuccess title={t("auth.checkEmail")}>{t("auth.checkEmailReset")}</FormSuccess>
      ) : (
        <form action={action} className="flex flex-col gap-4" noValidate>
          <FormError message={err(state.error)} />
          <Field
            label={t("auth.email")}
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t("auth.emailPlaceholder")}
            required
            error={err(state.fieldErrors?.email)}
          />
          <Button type="submit" loading={pending} className="w-full">
            {t("auth.sendReset")}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPasswordForm() {
  const { t } = useI18n();
  const err = useErr();
  const [state, action, pending] = useActionState<AuthState, FormData>(resetPassword, {});

  return (
    <AuthCard title={t("auth.resetTitle")} subtitle={t("auth.resetSubtitle")}>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormError message={err(state.error)} />
        <Field
          label={t("auth.newPassword")}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          hint={t("auth.passwordHint")}
          error={err(state.fieldErrors?.password)}
        />
        <Field
          label={t("auth.confirmPassword")}
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          error={err(state.fieldErrors?.confirm)}
        />
        <Button type="submit" loading={pending} className="w-full">
          {t("auth.resetButton")}
        </Button>
      </form>
      {state.error === "session_missing" && (
        <Link href="/forgot-password" className={`${linkClass} text-center text-preset-5`}>
          {t("auth.sendReset")}
        </Link>
      )}
    </AuthCard>
  );
}
