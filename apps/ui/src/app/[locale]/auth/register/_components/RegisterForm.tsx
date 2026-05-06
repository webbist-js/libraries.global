"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import { AuthLeftPanel } from "@/app/[locale]/auth/_components/AuthLeftPanel"
import { AuthOAuthButtons } from "@/app/[locale]/auth/_components/AuthOAuthButtons"
import GlobalLink from "@/components/global/GlobalLink"
import { useUserMutations } from "@/hooks/useUserMutations"
import { PASSWORD_MIN_LENGTH } from "@/lib/constants"
import { T } from "@/lib/design-tokens"

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: "10px",
  border: `1px solid ${T.border.hi}`,
  background: T.bg.surface,
  color: T.ink.base,
  fontSize: "14px",
  fontFamily: T.font.sans,
  outline: "none",
  boxSizing: "border-box" as const,
}

const labelStyle = {
  fontFamily: T.font.mono,
  fontSize: "10px",
  letterSpacing: ".18em",
  textTransform: "uppercase" as const,
  color: T.ink.low,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "6px",
}

const RegisterFormSchema = z
  .object({
    email: z.string().email(),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Minimum ${PASSWORD_MIN_LENGTH} characters`),
    passwordConfirmation: z.string().min(PASSWORD_MIN_LENGTH),
    terms: z.boolean().refine((v) => v === true, "You must accept the terms"),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.passwordConfirmation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["passwordConfirmation"],
      })
    }
  })

export function RegisterForm() {
  const { registerMutation } = useUserMutations()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof RegisterFormSchema>>({
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: {
      email: "",
      password: "",
      passwordConfirmation: "",
      terms: false,
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    registerMutation.mutate(
      { email: values.email, password: values.password },
      {
        onSuccess: () => {
          globalThis.location.href = "/"
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

  return (
    <>
      <AuthLeftPanel mode="register" />

      {/* Right panel */}
      <div
        className="flex flex-1 flex-col justify-center px-8 py-12 lg:px-16"
        style={{ background: "var(--t-bg-space)" }}
      >
        {/* Top nav */}
        <div className="mb-10 flex items-center justify-between">
          <GlobalLink
            href="/"
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
            className="transition-colors hover:text-(--t-ink-base)"
          >
            ← Back to atlas
          </GlobalLink>
          <GlobalLink
            href="/auth/signin"
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
              textDecoration: "none",
            }}
            className="transition-colors hover:text-(--t-ink-base)"
          >
            Have an account?{" "}
            <span style={{ color: T.accent.aurora }}>Sign in</span>
          </GlobalLink>
        </div>

        <div style={{ maxWidth: "380px", width: "100%", margin: "0 auto" }}>
          {/* Eyebrow */}
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".22em",
              textTransform: "uppercase",
              color: T.ink.faint,
              marginBottom: "12px",
            }}
          >
            § 01 · Create account
          </p>

          {/* Heading */}
          <h1
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(2rem,4vw,2.8rem)",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: T.ink.base,
              margin: "0 0 8px",
            }}
          >
            Join the <em style={{ fontStyle: "italic" }}>index.</em>
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: T.ink.low,
              marginBottom: "28px",
              fontWeight: 300,
              lineHeight: "1.6",
            }}
          >
            Free forever for readers and librarians. Two minutes, no card
            required.
          </p>

          {/* OAuth */}
          <AuthOAuthButtons mode="register" />

          {/* Form */}
          <form
            onSubmit={onSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div>
              <label style={labelStyle} htmlFor="email">
                <span>Email address</span>
                <span style={{ color: T.accent.aurora, fontSize: "10px" }}>
                  *
                </span>
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@library.org"
                style={inputStyle}
                className="focus:border-[rgba(127,223,255,.4)] focus:bg-[rgba(127,223,255,.03)]"
                {...register("email")}
              />
              {errors.email && (
                <p
                  style={{
                    fontSize: "11px",
                    color: T.accent.danger,
                    marginTop: "4px",
                  }}
                >
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label style={labelStyle} htmlFor="password">
                <span>Create password</span>
                <span style={{ color: T.ink.faint, fontSize: "10px" }}>
                  Minimum {PASSWORD_MIN_LENGTH} characters
                </span>
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••••••"
                style={inputStyle}
                className="focus:border-[rgba(127,223,255,.4)] focus:bg-[rgba(127,223,255,.03)]"
                {...register("password")}
              />
              {errors.password && (
                <p
                  style={{
                    fontSize: "11px",
                    color: T.accent.danger,
                    marginTop: "4px",
                  }}
                >
                  {errors.password.message}
                </p>
              )}
            </div>

            <div>
              <label style={labelStyle} htmlFor="passwordConfirmation">
                <span>Confirm password</span>
                <span style={{ color: T.accent.aurora, fontSize: "10px" }}>
                  *
                </span>
              </label>
              <input
                id="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••••••"
                style={inputStyle}
                className="focus:border-[rgba(127,223,255,.4)] focus:bg-[rgba(127,223,255,.03)]"
                {...register("passwordConfirmation")}
              />
              {errors.passwordConfirmation && (
                <p
                  style={{
                    fontSize: "11px",
                    color: T.accent.danger,
                    marginTop: "4px",
                  }}
                >
                  {errors.passwordConfirmation.message}
                </p>
              )}
            </div>

            {/* Terms */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                style={{
                  marginTop: "2px",
                  accentColor: T.accent.aurora,
                  flexShrink: 0,
                }}
                {...register("terms")}
              />
              <span
                style={{
                  fontSize: "12px",
                  color: T.ink.low,
                  lineHeight: "1.55",
                }}
              >
                I agree to the{" "}
                <GlobalLink
                  href="/terms"
                  style={{ color: T.accent.aurora, textDecoration: "none" }}
                  className="hover:underline"
                >
                  Terms
                </GlobalLink>{" "}
                &amp;{" "}
                <GlobalLink
                  href="/privacy"
                  style={{ color: T.accent.aurora, textDecoration: "none" }}
                  className="hover:underline"
                >
                  Privacy Policy
                </GlobalLink>
              </span>
            </label>
            {errors.terms && (
              <p
                style={{
                  fontSize: "11px",
                  color: T.accent.danger,
                  marginTop: "-8px",
                }}
              >
                {errors.terms.message}
              </p>
            )}

            <button
              type="submit"
              disabled={registerMutation.isPending || isSubmitting}
              style={{
                marginTop: "6px",
                width: "100%",
                padding: "13px",
                borderRadius: "10px",
                background: T.ink.base,
                color: T.bg.void,
                fontFamily: T.font.sans,
                fontWeight: 600,
                fontSize: "14px",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "opacity 150ms",
                opacity: registerMutation.isPending || isSubmitting ? 0.6 : 1,
              }}
            >
              {registerMutation.isPending
                ? "Creating account…"
                : "Create account →"}
            </button>
          </form>

          <p
            style={{
              textAlign: "center",
              marginTop: "20px",
              fontSize: "13px",
              color: T.ink.faint,
            }}
          >
            Already have an account?{" "}
            <GlobalLink
              href="/auth/signin"
              style={{ color: T.accent.aurora, textDecoration: "none" }}
              className="hover:underline"
            >
              Sign in
            </GlobalLink>
          </p>

          <p
            style={{
              textAlign: "center",
              marginTop: "12px",
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            Your email is never shared
          </p>
        </div>
      </div>
    </>
  )
}
