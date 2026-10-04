"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import {
  AuthCheckbox,
  AuthDivider,
  AuthField,
  AuthHeading,
  authInputClassName,
  authInputStyle,
  AuthPrimaryButton,
  AuthSwitchPrompt,
  FieldError,
  fieldA11y,
  PasswordInput,
  PasswordStrengthMeter,
} from "@/app/[locale]/auth/_components/AuthFormParts"
import { AuthOAuthButtons } from "@/app/[locale]/auth/_components/AuthOAuthButtons"
import { newPasswordSchema } from "@/app/[locale]/auth/_components/password-rules"
import { rememberPendingEmail } from "@/app/[locale]/auth/_components/pending-email"
import GlobalLink from "@/components/global/GlobalLink"
import { useUserMutations } from "@/hooks/useUserMutations"
import { VERIFY_EMAIL_PATH } from "@/lib/auth-redirects"
import { T } from "@/lib/design-tokens"
import { MINIMUM_ACCOUNT_AGE } from "@/lib/legal-consent"

const RegisterFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter the name to show on your profile")
    .max(60, "Keep it to 60 characters or fewer"),
  email: z
    .string()
    .min(1, "Enter your email address")
    .email("Enter a valid email address"),
  password: newPasswordSchema,
  terms: z
    .boolean()
    .refine(
      (v) => v === true,
      "Confirm you're 18 or over and accept the terms and privacy notice"
    ),
})

type RegisterFormValues = z.infer<typeof RegisterFormSchema>

export function RegisterForm() {
  const { registerMutation } = useUserMutations()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      terms: false,
    },
  })
  const password = useWatch({ control, name: "password" })

  const onSubmit = handleSubmit(async (values) => {
    registerMutation.mutate(
      {
        name: values.displayName,
        email: values.email,
        password: values.password,
      },
      {
        onSuccess: () => {
          // Email verification is required before the first sign-in. The
          // next page names the address without it going in the URL.
          rememberPendingEmail(values.email)
          globalThis.location.href = VERIFY_EMAIL_PATH
        },
        onError: (error) => {
          const msg = error?.message ?? "Registration failed"
          const display = /already exists/i.test(msg)
            ? "An account with this email already exists. Sign in instead, or reset your password."
            : msg
          toast.error(display)
        },
      }
    )
  })

  const passwordDescribedBy = [
    "password-strength",
    errors.password && "password-error",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <>
      <AuthHeading
        title="Join the"
        italic="index."
        subtitle="Free for readers, librarians and researchers."
      />

      {/* A native submit (before hydration) POSTs to this page instead of
          putting the password in a query string. */}
      <form
        method="post"
        action="/auth/register"
        onSubmit={onSubmit}
        noValidate
        style={{ display: "flex", flexDirection: "column", gap: "20px" }}
      >
        <AuthField
          id="displayName"
          label="Display name"
          hint="(shown on your profile)"
          error={errors.displayName?.message}
        >
          <input
            id="displayName"
            type="text"
            autoComplete="name"
            placeholder="e.g. Morag R."
            style={authInputStyle}
            className={authInputClassName}
            {...fieldA11y("displayName", errors.displayName?.message)}
            {...register("displayName")}
          />
        </AuthField>

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
            {...register("email")}
          />
        </AuthField>

        <AuthField
          id="password"
          label="Create a password"
          error={errors.password?.message}
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={passwordDescribedBy}
            {...register("password")}
          />
          <PasswordStrengthMeter id="password-strength" password={password} />
        </AuthField>

        <div>
          <AuthCheckbox
            label={
              <>
                I&rsquo;m {MINIMUM_ACCOUNT_AGE} or over, and I agree to the{" "}
                <GlobalLink
                  href="/legal/terms"
                  style={{ color: T.accent.primary }}
                  className="underline underline-offset-[3px]"
                >
                  terms of use
                </GlobalLink>{" "}
                and{" "}
                <GlobalLink
                  href="/legal/privacy"
                  style={{ color: T.accent.primary }}
                  className="underline underline-offset-[3px]"
                >
                  privacy notice
                </GlobalLink>
                .
              </>
            }
            {...fieldA11y("terms", errors.terms?.message)}
            {...register("terms")}
          />
          <FieldError id="terms" message={errors.terms?.message} />
        </div>

        <AuthPrimaryButton
          disabled={registerMutation.isPending || isSubmitting}
        >
          {registerMutation.isPending ? "Creating account…" : "Continue"}
        </AuthPrimaryButton>
      </form>

      <AuthSwitchPrompt
        prompt="Already have an account?"
        linkLabel="Sign in"
        href="/auth/signin"
      />

      <AuthDivider />

      <AuthOAuthButtons mode="register" />
    </>
  )
}
