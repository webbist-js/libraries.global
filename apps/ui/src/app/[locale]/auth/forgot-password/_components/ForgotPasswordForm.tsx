"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import {
  AuthField,
  AuthHeading,
  authInputClassName,
  authInputStyle,
  AuthPrimaryButton,
  AuthSwitchPrompt,
  fieldA11y,
} from "@/app/[locale]/auth/_components/AuthFormParts"
import { useUserMutations } from "@/hooks/useUserMutations"
import { useRouter } from "@/lib/navigation"

const ForgotPasswordFormSchema = z.object({
  email: z
    .string()
    .min(1, "Enter your email address")
    .email("Enter a valid email address"),
})

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword")
  const router = useRouter()
  const { forgotPasswordMutation } = useUserMutations()

  const form = useForm<z.infer<typeof ForgotPasswordFormSchema>>({
    resolver: zodResolver(ForgotPasswordFormSchema),
    defaultValues: { email: "" },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(async (data) => {
    forgotPasswordMutation.mutate(data, {
      onSuccess: () => {
        // This flow happens even if the email does not exist in the system
        toast.success(t("passwordChangeEmailSent"))
        form.reset()
        router.push("/auth/signin")
      },
      onError: (error) => {
        // This happens only on unexpected errors (e.g. network issues)
        toast.error(
          error?.message ?? t("errors.failedToSendPasswordResetEmail")
        )
      },
    })
  })

  return (
    <>
      <AuthHeading
        title="Reset your"
        italic="password."
        subtitle="Enter the email you signed up with and we'll send a reset link."
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

        <AuthPrimaryButton disabled={forgotPasswordMutation.isPending}>
          {forgotPasswordMutation.isPending ? "Sending…" : "Send reset link"}
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
