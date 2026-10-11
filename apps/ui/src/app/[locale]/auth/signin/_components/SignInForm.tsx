"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Icon } from "@iconify/react"
import { useSearchParams } from "next/navigation"
import { useTranslations as useUiTranslations } from "next-intl"
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

const PasswordFormSchema = z.object({
  email: z
    .string()
    .min(1, "Enter your email address")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
})

export function SignInForm({ returnTo }: { readonly returnTo?: string } = {}) {
  return (
    <UseSearchParamsWrapper>
      <SuspensedSignInForm returnTo={returnTo} />
    </UseSearchParamsWrapper>
  )
}

function SuspensedSignInForm({ returnTo }: { readonly returnTo?: string }) {
  const tUi = useUiTranslations("ui")

  const searchParams = useSearchParams()
  const callbackUrl = safeRedirectPath(
    returnTo ?? searchParams.get("callbackUrl")
  )
  const { signInMutation } = useUserMutations()
  const [magicPending, setMagicPending] = useState(false)

  const form = useForm<z.infer<typeof PasswordFormSchema>>({
    resolver: zodResolver(PasswordFormSchema),
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
          // Better Auth has just emailed this unconfirmed account a new link.
          if (code === "EMAIL_NOT_VERIFIED") {
            rememberPendingEmail(values.email)
            globalThis.location.href = `${VERIFY_EMAIL_PATH}?state=unverified`

            return
          }
          toast.error(
            code === "INVALID_EMAIL_OR_PASSWORD"
              ? "Incorrect email or password."
              : (message ?? "Sign in failed")
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
      toast.error("Failed to send magic link. Please try again.")
    } finally {
      setMagicPending(false)
    }
  }

  const submitting = signInMutation.isPending || isSubmitting

  return (
    <>
      <AuthHeading
        title={tUi("welcome")}
        italic="back."
        subtitle="Sign in to suggest edits, add and follow libraries."
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
              Forgot password?
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
          {signInMutation.isPending ? "Signing in…" : tUi("sign_in")}
        </AuthPrimaryButton>
      </form>

      <AuthSwitchPrompt
        prompt="New here?"
        linkLabel="Create an account"
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
          {magicPending ? tUi("sending") : "Email me a sign-in link"}
        </AuthSecondaryButton>
      </div>
    </>
  )
}
