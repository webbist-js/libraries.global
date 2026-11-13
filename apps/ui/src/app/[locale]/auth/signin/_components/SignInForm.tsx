"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Icon } from "@iconify/react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import { authErrorParts } from "@/app/[locale]/auth/_components/auth-error"
import {
  AuthDivider,
  AuthField,
  AuthHeading,
  AuthInlineLink,
  authInputClassName,
  authInputStyle,
  AuthPrimaryButton,
  AuthSecondaryButton,
  AuthSwitchPrompt,
  fieldA11y,
  PasswordInput,
} from "@/app/[locale]/auth/_components/AuthFormParts"
import { AuthOAuthButtons } from "@/app/[locale]/auth/_components/AuthOAuthButtons"
import { rememberPendingEmail } from "@/app/[locale]/auth/_components/pending-email"
import { useAuthFlow } from "@/app/[locale]/auth/_components/useAuthFlow"
import { UseSearchParamsWrapper } from "@/components/helpers/UseSearchParamsWrapper"
import { useUserMutations } from "@/hooks/useUserMutations"
import { authClient } from "@/lib/auth-client"
import {
  magicLinkCallbacks,
  signInCallbackURL,
  VERIFY_EMAIL_PATH,
} from "@/lib/auth-redirects"
import { T } from "@/lib/design-tokens"
import { safeRedirectPath } from "@/lib/safe-redirect"

const PasswordFormSchema = (
  tStatic: ReturnType<typeof useTranslations<"staticUi">>
) =>
  z.object({
    email: z
      .string()
      .min(1, tStatic("auth.enter_your_email_address"))
      .email(tStatic("auth.enter_a_valid_email_address")),
    password: z.string().min(1, tStatic("auth.enter_your_password")),
  })

export function SignInForm({ returnTo }: { readonly returnTo?: string } = {}) {
  return (
    <UseSearchParamsWrapper>
      <SuspensedSignInForm returnTo={returnTo} />
    </UseSearchParamsWrapper>
  )
}

function SuspensedSignInForm({ returnTo }: { readonly returnTo?: string }) {
  const { heading } = useAuthFlow()

  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const tUi = useTranslations("ui")

  const searchParams = useSearchParams()
  const callbackUrl = safeRedirectPath(
    returnTo ?? searchParams.get("callbackUrl")
  )
  const { signInMutation } = useUserMutations()
  const [magicPending, setMagicPending] = useState(false)

  const form = useForm<z.infer<ReturnType<typeof PasswordFormSchema>>>({
    resolver: zodResolver(PasswordFormSchema(tStatic)),
    defaultValues: { email: "", password: "" },
  })
  const { errors, isSubmitting } = form.formState

  // On success Better Auth's client follows callbackURL to post-signin, which
  // sends a user who hasn't onboarded to onboarding, else to the destination.
  const onSubmit = form.handleSubmit(async (values) => {
    signInMutation.mutate(
      { ...values, callbackURL: signInCallbackURL(callbackUrl) },
      {
        onError: (error) => {
          const { code, message } = authErrorParts(error)
          // Offer an explicit resend; failed sign-in does not send email.
          if (code === "EMAIL_NOT_VERIFIED") {
            rememberPendingEmail(values.email)
            globalThis.location.href = `${VERIFY_EMAIL_PATH}?state=unverified`

            return
          }
          toast.error(
            code === "INVALID_EMAIL_OR_PASSWORD"
              ? tStatic("auth.incorrect_email_or_password")
              : (message ?? tExisting("auth.signIn.status.fail"))
          )
        },
      }
    )
  })

  // The sign-in link reuses the email field above instead of a second input.
  // The link lands on post-signin (onboarding for a first sign-in), never on
  // the destination directly.
  const sendMagicLink = async () => {
    const valid = await form.trigger("email", { shouldFocus: true })
    if (!valid) return
    setMagicPending(true)
    try {
      const result = await authClient.signIn.magicLink({
        email: form.getValues("email"),
        ...magicLinkCallbacks(callbackUrl),
      })
      if (result?.error) {
        toast.error(result.error.message ?? "Failed to send magic link")
      } else {
        rememberPendingEmail(form.getValues("email"))
        globalThis.location.href = "/auth/magic-link-sent"
      }
    } catch {
      toast.error(tStatic("auth.failed_to_send_magic_link_please_try_again"))
    } finally {
      setMagicPending(false)
    }
  }

  const submitting = signInMutation.isPending || isSubmitting

  return (
    <>
      <AuthHeading
        title={heading("welcome")}
        subtitle={tStatic(
          "auth.sign_in_to_suggest_edits_add_and_follow_libraries"
        )}
      />

      {/* A native submit (before hydration) POSTs to this page instead of
          putting the password in a query string. */}
      <form
        method="post"
        action="/auth/signin"
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

        <AuthField
          id="password"
          label={tUi("password")}
          error={errors.password?.message}
          aside={
            <AuthInlineLink href="/auth/forgot-password">
              {tStatic("auth.forgot_password")}
            </AuthInlineLink>
          }
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            {...fieldA11y("password", errors.password?.message)}
            {...form.register("password")}
          />
        </AuthField>

        <AuthPrimaryButton disabled={submitting}>
          {signInMutation.isPending
            ? tStatic("auth.signing_in")
            : tUi("sign_in")}
        </AuthPrimaryButton>
      </form>

      <AuthSwitchPrompt
        prompt={tStatic("auth.new_here")}
        linkLabel={tExisting("auth.signIn.createAccount")}
        href="/auth/register"
      />

      <AuthDivider />

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <AuthOAuthButtons mode="signin" />
        <AuthSecondaryButton disabled={magicPending} onClick={sendMagicLink}>
          <Icon
            icon="mdi:email-outline"
            width={20}
            aria-hidden="true"
            style={{ color: T.accent.primary }}
          />
          {magicPending
            ? tUi("sending")
            : tStatic("auth.email_me_a_sign_in_link")}
        </AuthSecondaryButton>
      </div>
    </>
  )
}
