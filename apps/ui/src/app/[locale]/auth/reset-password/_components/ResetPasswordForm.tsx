"use client"

// apps/ui/src/app/[locale]/auth/reset-password/_components/ResetPasswordForm.tsx
//
// Where the reset email's link lands (`?token=`). Better Auth only checks the
// token on submit, so an expired or used link shows as such after the first
// attempt. A Google-only account that sets a password here gains one.

import { zodResolver } from "@hookform/resolvers/zod"
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
import { useUserMutations } from "@/hooks/useUserMutations"
import { linkLifetime, RESET_LINK_TTL_SECONDS } from "@/lib/auth-links"

const ResetPasswordSchema = z.object({ password: newPasswordSchema })

type Stage = "missing" | "form" | "expired" | "done"

const LATER_ICONS = [
  "mdi:check-circle-outline",
  "mdi:clock-alert-outline",
] as const

const NEW_LINK_HREF = "/auth/forgot-password"

export function ResetPasswordForm({ token }: { token: string | null }) {
  usePreloadedIcons(LATER_ICONS)
  const [stage, setStage] = useState<Stage>(token ? "form" : "missing")

  if (stage === "done") {
    return (
      <>
        <AuthHeading
          icon="mdi:check-circle-outline"
          iconTone="ok"
          title="Password"
          italic="saved."
          subtitle="You've been signed out on every device. Sign in with your new password."
        />
        <AuthPrimaryLink href="/auth/signin">Sign in</AuthPrimaryLink>
      </>
    )
  }

  if (stage === "missing" || stage === "expired" || !token) {
    const expired = stage === "expired"

    return (
      <>
        <AuthHeading
          icon={expired ? "mdi:clock-alert-outline" : "mdi:link-variant-off"}
          iconTone="warn"
          title={expired ? "That link no longer" : "That link isn’t"}
          italic={expired ? "works." : "complete."}
          subtitle={
            expired
              ? `Reset links work once, for ${linkLifetime(RESET_LINK_TTL_SECONDS)}. Ask for a new one and use it straight away.`
              : "Open the link from your email again. If it still doesn’t work, ask for a new one."
          }
        />
        <AuthPrimaryLink href={NEW_LINK_HREF}>
          Send a new reset link
        </AuthPrimaryLink>
        <AuthSwitchPrompt
          prompt="Remembered it?"
          linkLabel="Back to sign in"
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
  const { resetPasswordMutation } = useUserMutations()
  const form = useForm<z.infer<typeof ResetPasswordSchema>>({
    resolver: zodResolver(ResetPasswordSchema),
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
          const refusal = newPasswordRefusal(code)
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
              ? "Too many attempts. Wait a minute, then try again."
              : (message ?? "We couldn’t save your password. Please try again.")
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
        title="Choose a new"
        italic="password."
        subtitle="You'll use it to sign in from now on."
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
          label="New password"
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
          {resetPasswordMutation.isPending ? "Saving…" : "Save password"}
        </AuthPrimaryButton>
      </form>

      <AuthSwitchPrompt
        prompt="Remembered it?"
        linkLabel="Back to sign in"
        href="/auth/signin"
      />
    </>
  )
}
