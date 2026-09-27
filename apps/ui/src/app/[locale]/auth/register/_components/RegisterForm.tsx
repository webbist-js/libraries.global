"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import {
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
} from "@/app/[locale]/auth/_components/AuthFormParts"
import { AuthOAuthButtons } from "@/app/[locale]/auth/_components/AuthOAuthButtons"
import GlobalLink from "@/components/global/GlobalLink"
import { useUserMutations } from "@/hooks/useUserMutations"
import { PASSWORD_MIN_LENGTH } from "@/lib/constants"
import { T } from "@/lib/design-tokens"
import { MINIMUM_ACCOUNT_AGE } from "@/lib/legal-consent"
import { passwordStrength } from "@/lib/password-strength"

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
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`),
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
          // Email verification is required before the first sign-in.
          globalThis.location.href = "/auth/verify-email-sent"
        },
        onError: (error) => {
          const msg = error?.message ?? "Registration failed"
          const display = msg.includes("already taken")
            ? "An account with this email already exists."
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

      <form
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
          <PasswordStrengthMeter password={password} />
        </AuthField>

        <div>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              cursor: "pointer",
              fontSize: "15px",
              lineHeight: 1.5,
              color: T.ink.base,
            }}
          >
            <input
              type="checkbox"
              style={{
                width: "20px",
                height: "20px",
                marginTop: "1px",
                accentColor: T.accent.primary,
                flexShrink: 0,
              }}
              {...fieldA11y("terms", errors.terms?.message)}
              {...register("terms")}
            />
            <span>
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
            </span>
          </label>
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

// Filled-segment colour per score; the label text carries the same meaning.
const STRENGTH_COLOR = [
  T.bg.muted2,
  T.accent.danger,
  T.accent.warn,
  T.accent.ok,
  T.accent.ok,
]

function PasswordStrengthMeter({ password }: { password: string }) {
  const { score, label } = passwordStrength(password, PASSWORD_MIN_LENGTH)

  return (
    <div style={{ marginTop: "10px" }}>
      <div aria-hidden="true" className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            style={{
              height: "6px",
              borderRadius: "999px",
              background:
                segment <= score ? STRENGTH_COLOR[score] : T.bg.muted2,
              transition: "background 150ms",
            }}
          />
        ))}
      </div>
      <p
        id="password-strength"
        aria-live="polite"
        style={{
          marginTop: "8px",
          fontSize: "14px",
          lineHeight: 1.5,
          color: T.ink.dim,
        }}
      >
        <strong style={{ fontWeight: 600, color: T.ink.base }}>{label}.</strong>{" "}
        At least {PASSWORD_MIN_LENGTH} characters. A few unrelated words works
        well.
      </p>
    </div>
  )
}
