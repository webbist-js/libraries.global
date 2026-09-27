"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Icon } from "@iconify/react"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

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
import { UseSearchParamsWrapper } from "@/components/helpers/UseSearchParamsWrapper"
import { useUserMutations } from "@/hooks/useUserMutations"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { safeRedirectPath } from "@/lib/safe-redirect"

const PasswordFormSchema = z.object({
  email: z
    .string()
    .min(1, "Enter your email address")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
})

export function SignInForm() {
  return (
    <UseSearchParamsWrapper>
      <SuspensedSignInForm />
    </UseSearchParamsWrapper>
  )
}

function SuspensedSignInForm() {
  const searchParams = useSearchParams()
  const callbackUrl = safeRedirectPath(searchParams.get("callbackUrl"))
  const { signInMutation } = useUserMutations()
  const [magicPending, setMagicPending] = useState(false)

  const form = useForm<z.infer<typeof PasswordFormSchema>>({
    resolver: zodResolver(PasswordFormSchema),
    defaultValues: { email: "", password: "" },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    signInMutation.mutate(values, {
      onSuccess: async () => {
        const { data } = await authClient.getSession()
        const user = data?.user
        // Only a loaded profile with no username means "not onboarded"; a
        // Strapi outage (profileLoaded false) must not force onboarding.
        if (user?.profileLoaded === true && !user.username) {
          const next = encodeURIComponent(callbackUrl)
          globalThis.location.href = `/profile/onboarding?next=${next}`
        } else {
          globalThis.location.href = callbackUrl
        }
      },
      onError: (error) => {
        const msg = error instanceof Error ? error.message : "Sign in failed"
        let display = msg
        if (msg.includes("identifier or password")) {
          display = "Incorrect email or password."
        } else if (/email not verified/i.test(msg)) {
          display =
            "Please confirm your email address first. We've sent you a new link."
        }
        toast.error(display)
      },
    })
  })

  // The sign-in link reuses the email field above instead of a second input.
  const sendMagicLink = async () => {
    const valid = await form.trigger("email", { shouldFocus: true })
    if (!valid) return
    setMagicPending(true)
    try {
      const result = await authClient.signIn.magicLink({
        email: form.getValues("email"),
        callbackURL: callbackUrl,
      })
      if (result?.error) {
        toast.error(result.error.message ?? "Failed to send magic link")
      } else {
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
        title="Welcome"
        italic="back."
        subtitle="Sign in to suggest edits, add and follow libraries."
      />

      <form
        onSubmit={onSubmit}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "20px" }}
      >
        <AuthField
          id="email"
          label="Email address"
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
          label="Password"
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
          {signInMutation.isPending ? "Signing in…" : "Sign in"}
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
          {magicPending ? "Sending…" : "Email me a sign-in link"}
        </AuthSecondaryButton>
      </div>
    </>
  )
}
