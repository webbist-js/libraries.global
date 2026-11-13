"use client"

// apps/ui/src/app/[locale]/auth/reset-password/_components/ResetPasswordForm.tsx
//
// Where the reset email's link lands (`?token=`). Better Auth only checks the
// token on submit, so an expired or used link shows as such after the first
// attempt. A Google-only account that sets a password here gains one.

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import { authErrorParts } from "@/app/[locale]/auth/_components/auth-error"
import {
  AuthField,
  AuthHeading,
  AuthPrimaryButton,
  AuthPrimaryLink,
  AuthSwitchPrompt,
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
import { RESET_LINK_TTL_SECONDS } from "@/lib/auth-links"

const ResetPasswordSchema = (
  tStatic: ReturnType<typeof useTranslations<"staticUi">>
) => z.object({ password: newPasswordSchema(tStatic) })

type Stage = "missing" | "form" | "expired" | "done"

const LATER_ICONS = [
  "mdi:check-circle-outline",
  "mdi:clock-alert-outline",
] as const

const NEW_LINK_HREF = "/auth/forgot-password"

export function ResetPasswordForm({ token }: { token: string | null }) {
  const { heading, tFlow, lifetime } = useAuthFlow()

  const tStatic = useTranslations("staticUi")

  const tUi = useTranslations("ui")

  usePreloadedIcons(LATER_ICONS)
  const [stage, setStage] = useState<Stage>(token ? "form" : "missing")

  if (stage === "done") {
    return (
      <>
        <AuthHeading
          layout="utility"
          icon="mdi:check-circle-outline"
          iconTone="ok"
          title={heading("saved")}
          subtitle={tStatic(
            "auth.you_ve_been_signed_out_on_every_device_sign_in_with_your_new_password"
          )}
        />
        <AuthPrimaryLink href="/auth/signin">{tUi("sign_in")}</AuthPrimaryLink>
      </>
    )
  }

  if (stage === "missing" || stage === "expired" || !token) {
    const expired = stage === "expired"

    return (
      <>
        <AuthHeading
          layout="utility"
          icon={expired ? "mdi:clock-alert-outline" : "mdi:link-variant-off"}
          iconTone="warn"
          title={heading(expired ? "noLongerWorks" : "incomplete")}
          subtitle={
            expired
              ? tFlow("resetExpired", {
                  duration: lifetime(RESET_LINK_TTL_SECONDS),
                })
              : tStatic(
                  "auth.open_the_link_from_your_email_again_if_it_still_doesn_t_work_ask_for_a_new_one"
                )
          }
        />
        <AuthPrimaryLink href={NEW_LINK_HREF}>
          {tStatic("auth.send_a_new_reset_link")}
        </AuthPrimaryLink>
        <AuthSwitchPrompt
          prompt={tStatic("auth.remembered_it")}
          linkLabel={tStatic("auth.back_to_sign_in")}
          href="/auth/signin"
        />
      </>
    )
  }

  return (
    <NewPasswordForm
      token={token}
      onExpired={() => setStage("expired")}
      onDone={() => setStage("done")}
    />
  )
}

function NewPasswordForm({
  token,
  onExpired,
  onDone,
}: {
  token: string
  onExpired: () => void
  onDone: () => void
}) {
  const { heading } = useAuthFlow()

  const tStatic = useTranslations("staticUi")

  const tUi = useTranslations("ui")

  const { resetPasswordMutation } = useUserMutations()
  const form = useForm<z.infer<ReturnType<typeof ResetPasswordSchema>>>({
    resolver: zodResolver(ResetPasswordSchema(tStatic)),
    defaultValues: { password: "" },
  })
  const { errors, isSubmitting } = form.formState
  const password = useWatch({ control: form.control, name: "password" })

  const onSubmit = form.handleSubmit(async (values) => {
    resetPasswordMutation.mutate(
      { token, password: values.password },
      {
        onSuccess: onDone,
        onError: (error) => {
          const { code, status, message } = authErrorParts(error)
          if (code === "INVALID_TOKEN") return onExpired()
          const refusal = newPasswordRefusal(code, tStatic)
          if (refusal) {
            form.setError(
              "password",
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
                    "auth.we_couldn_t_save_your_password_please_try_again"
                  ))
          )
        },
      }
    )
  })

  const describedBy = [
    "new-password-strength",
    errors.password && "password-error",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <>
      <AuthHeading
        layout="utility"
        title={heading("choose")}
        subtitle={tStatic("auth.you_ll_use_it_to_sign_in_from_now_on")}
      />

      {/* A native submit (before hydration) POSTs to this page instead of
          putting the password in a query string. */}
      <form
        method="post"
        action="/auth/reset-password"
        onSubmit={onSubmit}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "20px" }}
      >
        <AuthField
          id="password"
          label={tUi("new_password")}
          error={errors.password?.message}
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={describedBy}
            {...form.register("password")}
          />
          <PasswordStrengthMeter
            id="new-password-strength"
            password={password}
          />
        </AuthField>

        <AuthPrimaryButton
          disabled={resetPasswordMutation.isPending || isSubmitting}
        >
          {resetPasswordMutation.isPending
            ? tUi("saving")
            : tStatic("auth.save_password")}
        </AuthPrimaryButton>
      </form>

      <AuthSwitchPrompt
        prompt={tStatic("auth.remembered_it")}
        linkLabel={tStatic("auth.back_to_sign_in")}
        href="/auth/signin"
      />
    </>
  )
}
