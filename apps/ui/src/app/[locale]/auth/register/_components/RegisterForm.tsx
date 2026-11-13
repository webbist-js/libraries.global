"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
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
import { useAuthFlow } from "@/app/[locale]/auth/_components/useAuthFlow"
import GlobalLink from "@/components/global/GlobalLink"
import { useUserMutations } from "@/hooks/useUserMutations"
import { VERIFY_EMAIL_PATH } from "@/lib/auth-redirects"
import { T } from "@/lib/design-tokens"
import { MINIMUM_ACCOUNT_AGE } from "@/lib/legal-consent"

const RegisterFormSchema = (
  tStatic: ReturnType<typeof useTranslations<"staticUi">>
) =>
  z.object({
    displayName: z
      .string()
      .trim()
      .min(1, tStatic("auth.enter_the_name_to_show_on_your_profile"))
      .max(60, tStatic("auth.keep_it_to_60_characters_or_fewer")),
    email: z
      .string()
      .min(1, tStatic("auth.enter_your_email_address"))
      .email(tStatic("auth.enter_a_valid_email_address")),
    password: newPasswordSchema(tStatic),
    terms: z
      .boolean()
      .refine(
        (v) => v === true,
        tStatic(
          "auth.confirm_you_re_18_or_over_and_accept_the_terms_and_privacy_notice"
        )
      ),
  })

type RegisterFormValues = z.infer<ReturnType<typeof RegisterFormSchema>>

export function RegisterForm() {
  const { heading, tFlow } = useAuthFlow()

  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const tUi = useTranslations("ui")

  const { registerMutation } = useUserMutations()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(RegisterFormSchema(tStatic)),
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
          const msg = error?.message ?? tExisting("auth.register.status.fail")
          const display = /already exists/i.test(msg)
            ? tStatic(
                "auth.an_account_with_this_email_already_exists_sign_in_instead_or_reset_your_password"
              )
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
        title={heading("join")}
        subtitle={tStatic("auth.free_for_readers_librarians_and_researchers")}
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
          label={tUi("display_name")}
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
            {...register("email")}
          />
        </AuthField>

        <AuthField
          id="password"
          label={tUi("create_a_password")}
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
            label={tFlow.rich("consent", {
              age: MINIMUM_ACCOUNT_AGE,
              terms: (chunks) => (
                <GlobalLink
                  href="/legal/terms"
                  style={{ color: T.accent.primary }}
                  className="underline underline-offset-[3px]"
                >
                  {chunks}
                </GlobalLink>
              ),
              privacy: (chunks) => (
                <GlobalLink
                  href="/legal/privacy"
                  style={{ color: T.accent.primary }}
                  className="underline underline-offset-[3px]"
                >
                  {chunks}
                </GlobalLink>
              ),
            })}
            {...fieldA11y("terms", errors.terms?.message)}
            {...register("terms")}
          />
          <FieldError id="terms" message={errors.terms?.message} />
        </div>

        <AuthPrimaryButton
          disabled={registerMutation.isPending || isSubmitting}
        >
          {registerMutation.isPending
            ? tStatic("auth.creating_account")
            : tUi("continue")}
        </AuthPrimaryButton>
      </form>

      <AuthSwitchPrompt
        prompt={tExisting("auth.register.signInLinkLinkDescription")}
        linkLabel={tExisting("ui.sign_in")}
        href="/auth/signin"
      />

      <AuthDivider />

      <AuthOAuthButtons mode="register" />
    </>
  )
}
