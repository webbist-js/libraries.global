"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
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
import { useAuthFlow } from "@/app/[locale]/auth/_components/useAuthFlow"
import { useUserMutations } from "@/hooks/useUserMutations"
import { RESET_EMAIL_SUBJECT, RESET_LINK_TTL_SECONDS } from "@/lib/auth-links"

const ForgotPasswordFormSchema = (
  tStatic: ReturnType<typeof useTranslations<"staticUi">>
) =>
  z.object({
    email: z
      .string()
      .min(1, tStatic("auth.enter_your_email_address"))
      .email(tStatic("auth.enter_a_valid_email_address")),
  })

const SENT_ICONS = ["mdi:email-fast-outline", "mdi:email-outline"] as const

export function ForgotPasswordForm() {
  const { heading, flowRich, tFlow, lifetime } = useAuthFlow()

  const tStatic = useTranslations("staticUi")

  const tUi = useTranslations("ui")

  usePreloadedIcons(SENT_ICONS)
  const t = useTranslations("auth.forgotPassword")
  const { forgotPasswordMutation } = useUserMutations()
  // The address the link went to, once sent.
  const [sentTo, setSentTo] = useState<string | null>(null)

  const form = useForm<z.infer<ReturnType<typeof ForgotPasswordFormSchema>>>({
    resolver: zodResolver(ForgotPasswordFormSchema(tStatic)),
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
          title={heading("inbox")}
          subtitle={flowRich("resetSent", sentTo)}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <AuthInboxHint
            subject={RESET_EMAIL_SUBJECT}
            detail={tFlow("linkOnce", {
              duration: lifetime(RESET_LINK_TTL_SECONDS),
            })}
          />
          <AuthSecondaryButton onClick={() => setSentTo(null)}>
            {tStatic("auth.try_a_different_address")}
          </AuthSecondaryButton>
          <AuthNote>
            {tStatic(
              "auth.nothing_yet_check_your_spam_or_promotions_folder_emails_can_take_a_few_minutes_to_arrive"
            )}
          </AuthNote>
        </div>
        <AuthSwitchPrompt
          prompt={tStatic("auth.remembered_it")}
          linkLabel={tStatic("auth.back_to_sign_in")}
          href="/auth/signin"
        />
      </>
    )
  }

  return (
    <>
      <AuthHeading
        layout="utility"
        title={heading("reset")}
        subtitle={tStatic(
          "auth.enter_the_email_you_signed_up_with_and_we_ll_send_a_reset_link"
        )}
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
            : tStatic("auth.send_reset_link")}
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
