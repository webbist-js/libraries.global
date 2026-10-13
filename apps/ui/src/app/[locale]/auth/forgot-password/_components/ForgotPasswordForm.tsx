"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import {
  AuthField,
  AuthHeading,
  AuthInboxHint,
  authInputClassName,
  authInputStyle,
  AuthNote,
  AuthPrimaryButton,
  AuthSecondaryButton,
  AuthSwitchPrompt,
  fieldA11y,
  usePreloadedIcons,
} from "@/app/[locale]/auth/_components/AuthFormParts"
import { useUserMutations } from "@/hooks/useUserMutations"
import {
  linkLifetime,
  RESET_EMAIL_SUBJECT,
  RESET_LINK_TTL_SECONDS,
} from "@/lib/auth-links"
import { T } from "@/lib/design-tokens"

const ForgotPasswordFormSchema = z.object({
  email: z
    .string()
    .min(1, "Enter your email address")
    .email("Enter a valid email address"),
})

const SENT_ICONS = ["mdi:email-fast-outline", "mdi:email-outline"] as const

export function ForgotPasswordForm() {
  const tUi = useUiTranslations("ui")

  usePreloadedIcons(SENT_ICONS)
  const t = useUiTranslations("auth.forgotPassword")
  const { forgotPasswordMutation } = useUserMutations()
  // The address the link went to, once sent.
  const [sentTo, setSentTo] = useState<string | null>(null)

  const form = useForm<z.infer<typeof ForgotPasswordFormSchema>>({
    resolver: zodResolver(ForgotPasswordFormSchema),
    defaultValues: { email: "" },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(async (data) => {
    forgotPasswordMutation.mutate(data, {
      // Better Auth answers the same whether or not the address has an
      // account, so the next screen doesn't claim one does.
      onSuccess: () => setSentTo(data.email),
      onError: (error) => {
        // This happens only on unexpected errors (e.g. network issues)
        toast.error(
          error?.message ?? t("errors.failedToSendPasswordResetEmail")
        )
      },
    })
  })

  if (sentTo) {
    return (
      <>
        <AuthHeading
          layout="utility"
          icon="mdi:email-fast-outline"
          title="Check your"
          italic="inbox."
          subtitle={
            <>
              If <strong style={{ color: T.ink.base }}>{sentTo}</strong> has an
              account, we&rsquo;ve sent it a link to choose a new password.
            </>
          }
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <AuthInboxHint
            subject={RESET_EMAIL_SUBJECT}
            detail={`The link works once, for ${linkLifetime(RESET_LINK_TTL_SECONDS)}.`}
          />
          <AuthSecondaryButton onClick={() => setSentTo(null)}>
            Try a different address
          </AuthSecondaryButton>
          <AuthNote>
            Nothing yet? Check your spam or promotions folder. Emails can take a
            few minutes to arrive.
          </AuthNote>
        </div>
        <AuthSwitchPrompt
          prompt="Remembered it?"
          linkLabel="Back to sign in"
          href="/auth/signin"
        />
      </>
    )
  }

  return (
    <>
      <AuthHeading
        layout="utility"
        title="Reset your"
        italic="password."
        subtitle="Enter the email you signed up with and we'll send a reset link."
      />

      {/* A native submit (before hydration) POSTs to this page instead of
          putting the email address in a query string. */}
      <form
        method="post"
        action="/auth/forgot-password"
        onSubmit={onSubmit}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "20px" }}
      >
        <AuthField
          id="email"
          label={tUi("email_address")}
          error={errors.email?.message}
        >
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.org"
            style={authInputStyle}
            className={authInputClassName}
            {...fieldA11y("email", errors.email?.message)}
            {...form.register("email")}
          />
        </AuthField>

        <AuthPrimaryButton disabled={forgotPasswordMutation.isPending}>
          {forgotPasswordMutation.isPending
            ? tUi("sending")
            : "Send reset link"}
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
