"use client"

// apps/ui/src/app/[locale]/auth/change-password/_components/ChangePasswordForm.tsx
//
// Signed in only (lib/proxies/authGuard.ts). An account with a password
// changes it here; a Google-only account has none to change, so it's offered
// a reset email instead, which adds one (Better Auth's reset creates the
// password sign-in when it's missing).

import { zodResolver } from "@hookform/resolvers/zod"
import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { type FormEvent, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import { authErrorParts } from "@/app/[locale]/auth/_components/auth-error"
import {
  AuthCheckbox,
  AuthField,
  AuthHeading,
  AuthInboxHint,
  AuthInlineLink,
  AuthNote,
  AuthPrimaryButton,
  AuthPrimaryLink,
  type AuthStatus,
  AuthStatusMessage,
  fieldA11y,
  PasswordInput,
  PasswordStrengthMeter,
  usePreloadedIcons,
} from "@/app/[locale]/auth/_components/AuthFormParts"
import {
  newPasswordRefusal,
  newPasswordSchema,
} from "@/app/[locale]/auth/_components/password-rules"
import { useUserMutations } from "@/hooks/useUserMutations"
import {
  linkLifetime,
  RESET_EMAIL_SUBJECT,
  RESET_LINK_TTL_SECONDS,
} from "@/lib/auth-links"
import { T } from "@/lib/design-tokens"

const SETTINGS_HREF = "/map?account=settings"
const TOO_MANY = "Too many attempts. Wait a minute, then try again."

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: newPasswordSchema,
    signOutOthers: z.boolean(),
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Use a different password from your current one",
  })

const LATER_ICONS = [
  "mdi:check-circle-outline",
  "mdi:key-plus",
  "mdi:email-fast-outline",
  "mdi:email-outline",
  "mdi:alert-circle-outline",
] as const

type Stage =
  | { kind: "change" }
  | { kind: "add" }
  | { kind: "changed"; signedOutOthers: boolean }

export function ChangePasswordForm({
  hasPassword,
  email,
}: {
  hasPassword: boolean
  email: string
}) {
  const tUi = useUiTranslations("ui")

  usePreloadedIcons(LATER_ICONS)
  const [stage, setStage] = useState<Stage>({
    kind: hasPassword ? "change" : "add",
  })

  if (stage.kind === "changed") {
    return (
      <>
        <AuthHeading
          icon="mdi:check-circle-outline"
          iconTone="ok"
          title={tUi("password")}
          italic="changed."
          subtitle={
            stage.signedOutOthers
              ? "You're still signed in here. Every other device has been signed out."
              : "You're still signed in here and on your other devices."
          }
        />
        <AuthPrimaryLink href={SETTINGS_HREF}>
          {tUi("back_to_settings")}
        </AuthPrimaryLink>
      </>
    )
  }

  if (stage.kind === "add") return <AddPassword email={email} />

  return (
    <ChangeForm
      onChanged={(signedOutOthers) =>
        setStage({ kind: "changed", signedOutOthers })
      }
      onNoPassword={() => setStage({ kind: "add" })}
    />
  )
}

function ChangeForm({
  onChanged,
  onNoPassword,
}: {
  onChanged: (signedOutOthers: boolean) => void
  onNoPassword: () => void
}) {
  const tUi = useUiTranslations("ui")

  const { changePasswordMutation } = useUserMutations()
  const form = useForm<z.infer<typeof ChangePasswordSchema>>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      signOutOthers: true,
    },
  })
  const { errors, isSubmitting } = form.formState
  const newPassword = useWatch({ control: form.control, name: "newPassword" })

  const onSubmit = form.handleSubmit(async (values) => {
    changePasswordMutation.mutate(
      {
        currentPassword: values.currentPassword,
        password: values.newPassword,
        revokeOtherSessions: values.signOutOthers,
      },
      {
        onSuccess: () => onChanged(values.signOutOthers),
        onError: (error) => {
          const { code, status, message } = authErrorParts(error)
          if (code === "INVALID_PASSWORD") {
            form.setError(
              "currentPassword",
              { message: "That isn't your current password" },
              { shouldFocus: true }
            )

            return
          }
          if (code === "CREDENTIAL_ACCOUNT_NOT_FOUND") return onNoPassword()
          const refusal = newPasswordRefusal(code)
          if (refusal) {
            form.setError(
              "newPassword",
              { message: refusal },
              { shouldFocus: true }
            )

            return
          }
          toast.error(
            status === 429
              ? TOO_MANY
              : (message ??
                  "We couldn’t change your password. Please try again.")
          )
        },
      }
    )
  })

  const describedBy = [
    "new-password-strength",
    errors.newPassword && "newPassword-error",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <>
      <AuthHeading
        title={tUi("change_your")}
        italic="password."
        subtitle="You'll use the new one the next time you sign in."
      />

      {/* A native submit (before hydration) POSTs to this page instead of
          putting the passwords in a query string. */}
      <form
        method="post"
        action="/auth/change-password"
        onSubmit={onSubmit}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "20px" }}
      >
        <AuthField
          id="currentPassword"
          label={tUi("current_password")}
          error={errors.currentPassword?.message}
          aside={
            <AuthInlineLink href="/auth/forgot-password">
              Forgot it?
            </AuthInlineLink>
          }
        >
          <PasswordInput
            id="currentPassword"
            autoComplete="current-password"
            {...fieldA11y("currentPassword", errors.currentPassword?.message)}
            {...form.register("currentPassword")}
          />
        </AuthField>

        <AuthField
          id="newPassword"
          label={tUi("new_password")}
          error={errors.newPassword?.message}
        >
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            aria-invalid={errors.newPassword ? true : undefined}
            aria-describedby={describedBy}
            {...form.register("newPassword")}
          />
          <PasswordStrengthMeter
            id="new-password-strength"
            password={newPassword}
          />
        </AuthField>

        <AuthCheckbox
          label={tUi("sign_out_on_my_other_devices")}
          hint="Do this if you think someone else knows your old password."
          {...form.register("signOutOthers")}
        />

        <AuthPrimaryButton
          disabled={changePasswordMutation.isPending || isSubmitting}
        >
          {changePasswordMutation.isPending
            ? "Changing password…"
            : "Change password"}
        </AuthPrimaryButton>
      </form>
    </>
  )
}

function AddPassword({ email }: { email: string }) {
  const tUi = useUiTranslations("ui")

  const { forgotPasswordMutation } = useUserMutations()
  const [sent, setSent] = useState(false)
  const [status, setStatus] = useState<AuthStatus>(null)
  const to = <strong style={{ color: T.ink.base }}>{email}</strong>

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(null)
    forgotPasswordMutation.mutate(
      { email },
      {
        onSuccess: () => setSent(true),
        onError: (error) => {
          const { status: httpStatus } = authErrorParts(error)
          setStatus({
            tone: "error",
            text:
              httpStatus === 429
                ? TOO_MANY
                : "We couldn’t send the email. Please try again.",
          })
        },
      }
    )
  }

  if (sent) {
    return (
      <>
        <AuthHeading
          icon="mdi:email-fast-outline"
          title="Check your"
          italic="inbox."
          subtitle={
            <>We sent a link to {to}. Open it to choose your password.</>
          }
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <AuthInboxHint
            subject={RESET_EMAIL_SUBJECT}
            detail={`The link works once, for ${linkLifetime(RESET_LINK_TTL_SECONDS)}.`}
          />
          <AuthNote>
            Setting a password signs you out on every device, so you&rsquo;ll
            sign in again afterwards, with Google or the new password.
          </AuthNote>
          <AuthPrimaryLink href={SETTINGS_HREF}>
            {tUi("back_to_settings")}{" "}
          </AuthPrimaryLink>
        </div>
      </>
    )
  }

  return (
    <>
      <AuthHeading
        icon="mdi:key-plus"
        title="Add a"
        italic="password."
        subtitle={
          <>
            You sign in with Google, so there&rsquo;s no password to change.
            We&rsquo;ll email {to} a link to set one, and you can then sign in
            either way.
          </>
        }
      />

      <form
        method="post"
        action="/auth/change-password"
        onSubmit={onSubmit}
        noValidate
      >
        <AuthPrimaryButton disabled={forgotPasswordMutation.isPending}>
          <Icon icon="mdi:email-outline" width={20} aria-hidden="true" />
          {forgotPasswordMutation.isPending
            ? tUi("sending")
            : "Email me a link"}
        </AuthPrimaryButton>
        <AuthStatusMessage status={status} />
      </form>
    </>
  )
}
