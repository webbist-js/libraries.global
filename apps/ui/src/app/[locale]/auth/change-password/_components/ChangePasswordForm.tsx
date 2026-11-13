"use client"

// apps/ui/src/app/[locale]/auth/change-password/_components/ChangePasswordForm.tsx
//
// Signed in only (lib/proxies/authGuard.ts). An account with a password
// changes it here; a Google-only account has none to change, so it's offered
// a reset email instead, which adds one (Better Auth's reset creates the
// password sign-in when it's missing).

import { zodResolver } from "@hookform/resolvers/zod"
import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"
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
import { useAuthFlow } from "@/app/[locale]/auth/_components/useAuthFlow"
import { useUserMutations } from "@/hooks/useUserMutations"
import { RESET_EMAIL_SUBJECT, RESET_LINK_TTL_SECONDS } from "@/lib/auth-links"

const SETTINGS_HREF = "/map?account=settings"

const ChangePasswordSchema = (
  tStatic: ReturnType<typeof useTranslations<"staticUi">>
) =>
  z
    .object({
      currentPassword: z
        .string()
        .min(1, tStatic("auth.enter_your_current_password")),
      newPassword: newPasswordSchema(tStatic),
      signOutOthers: z.boolean(),
    })
    .refine((v) => v.newPassword !== v.currentPassword, {
      path: ["newPassword"],
      message: tStatic("auth.use_a_different_password_from_your_current_one"),
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
  const { heading } = useAuthFlow()

  const tStatic = useTranslations("staticUi")

  const tUi = useTranslations("ui")

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
          title={heading("changed")}
          subtitle={
            stage.signedOutOthers
              ? tStatic(
                  "auth.you_re_still_signed_in_here_every_other_device_has_been_signed_out"
                )
              : tStatic(
                  "auth.you_re_still_signed_in_here_and_on_your_other_devices"
                )
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
  const { heading } = useAuthFlow()

  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const tUi = useTranslations("ui")

  const { changePasswordMutation } = useUserMutations()
  const form = useForm<z.infer<ReturnType<typeof ChangePasswordSchema>>>({
    resolver: zodResolver(ChangePasswordSchema(tStatic)),
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
              { message: tStatic("auth.that_isn_t_your_current_password") },
              { shouldFocus: true }
            )

            return
          }
          if (code === "CREDENTIAL_ACCOUNT_NOT_FOUND") return onNoPassword()
          const refusal = newPasswordRefusal(code, tStatic)
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
              ? tStatic("auth.too_many_attempts_wait_a_minute_then_try_again")
              : (message ??
                  tStatic(
                    "auth.we_couldn_t_change_your_password_please_try_again"
                  ))
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
        title={heading("change")}
        subtitle={tStatic(
          "auth.you_ll_use_the_new_one_the_next_time_you_sign_in"
        )}
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
              {tStatic("auth.forgot_it")}
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
          hint={tStatic(
            "auth.do_this_if_you_think_someone_else_knows_your_old_password"
          )}
          {...form.register("signOutOthers")}
        />

        <AuthPrimaryButton
          disabled={changePasswordMutation.isPending || isSubmitting}
        >
          {changePasswordMutation.isPending
            ? tStatic("auth.changing_password")
            : tExisting("navbar.actions.changePassword")}
        </AuthPrimaryButton>
      </form>
    </>
  )
}

function AddPassword({ email }: { email: string }) {
  const { heading, flowRich, tFlow, lifetime } = useAuthFlow()

  const tStatic = useTranslations("staticUi")

  const tUi = useTranslations("ui")

  const { forgotPasswordMutation } = useUserMutations()
  const [sent, setSent] = useState(false)
  const [status, setStatus] = useState<AuthStatus>(null)

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
                ? tStatic("auth.too_many_attempts_wait_a_minute_then_try_again")
                : tStatic("auth.we_couldn_t_send_the_email_please_try_again"),
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
          title={heading("inbox")}
          subtitle={flowRich("sentPassword", email)}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <AuthInboxHint
            subject={RESET_EMAIL_SUBJECT}
            detail={tFlow("linkOnce", {
              duration: lifetime(RESET_LINK_TTL_SECONDS),
            })}
          />
          <AuthNote>
            {tStatic(
              "auth.setting_a_password_signs_you_out_on_every_device_so_you_rsquo_ll_sign_in_again_afterwards_with_your_"
            )}
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
        title={heading("add")}
        subtitle={flowRich("socialPassword", email)}
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
            : tStatic("auth.email_me_a_link")}
        </AuthPrimaryButton>
        <AuthStatusMessage status={status} />
      </form>
    </>
  )
}
