"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import { AuthLeftPanel } from "@/app/[locale]/auth/_components/AuthLeftPanel"
import { AuthOAuthButtons } from "@/app/[locale]/auth/_components/AuthOAuthButtons"
import GlobalLink from "@/components/global/GlobalLink"
import { UseSearchParamsWrapper } from "@/components/helpers/UseSearchParamsWrapper"
import { useUserMutations } from "@/hooks/useUserMutations"
import { T } from "@/lib/design-tokens"

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: "10px",
  border: `1px solid ${T.border.hi}`,
  background: "rgba(255,255,255,.04)",
  color: T.ink.base,
  fontSize: "14px",
  fontFamily: T.font.sans,
  outline: "none",
  boxSizing: "border-box" as const,
}

const labelStyle = {
  fontFamily: T.font.mono,
  fontSize: "9px",
  letterSpacing: ".18em",
  textTransform: "uppercase" as const,
  color: T.ink.low,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "6px",
}

const SignInFormSchema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
})

export function SignInForm({ strapiUrl }: { strapiUrl?: string }) {
  return (
    <UseSearchParamsWrapper>
      <SuspensedSignInForm strapiUrl={strapiUrl} />
    </UseSearchParamsWrapper>
  )
}

function SuspensedSignInForm({ strapiUrl }: { strapiUrl?: string }) {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/"
  const { signInMutation } = useUserMutations()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof SignInFormSchema>>({
    resolver: zodResolver(SignInFormSchema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = handleSubmit(async (values) => {
    signInMutation.mutate(values, {
      onSuccess: () => {
        globalThis.location.href = callbackUrl
      },
      onError: (error) => {
        const msg = error?.message ?? "Sign in failed"
        const display = msg.includes("identifier or password")
          ? "Incorrect email or password."
          : msg
        toast.error(display)
      },
    })
  })

  return (
    <>
      <AuthLeftPanel mode="signin" />

      {/* Right panel */}
      <div
        className="flex flex-1 flex-col justify-center px-8 py-12 lg:px-16"
        style={{ background: "#050816" }}
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
            className="transition-colors hover:text-white"
          >
            ← Back to atlas
          </GlobalLink>
          <GlobalLink
            href="/auth/register"
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
              textDecoration: "none",
            }}
            className="transition-colors hover:text-white"
          >
            New here?{" "}
            <span style={{ color: T.accent.aurora }}>Create account</span>
          </GlobalLink>
        </div>

        <div style={{ maxWidth: "380px", width: "100%", margin: "0 auto" }}>
          {/* Eyebrow */}
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".22em",
              textTransform: "uppercase",
              color: T.ink.faint,
              marginBottom: "12px",
            }}
          >
            § 01 · Authentication
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
            Welcome <em style={{ fontStyle: "italic" }}>back.</em>
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
            Sign in to continue contributing to the global library index.
          </p>

          {/* OAuth */}
          <AuthOAuthButtons strapiUrl={strapiUrl} mode="signin" />

          {/* Form */}
          <form
            onSubmit={onSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div>
              <label style={labelStyle} htmlFor="email">
                <span>Email address</span>
                <span style={{ color: T.accent.aurora, fontSize: "9px" }}>
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
                <span>Password</span>
                <GlobalLink
                  href="/auth/forgot-password"
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: T.ink.faint,
                    textDecoration: "none",
                  }}
                  className="transition-colors hover:text-[#7fdfff]"
                >
                  Forgot?
                </GlobalLink>
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••"
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

            <button
              type="submit"
              disabled={signInMutation.isPending || isSubmitting}
              style={{
                marginTop: "6px",
                width: "100%",
                padding: "13px",
                borderRadius: "10px",
                background: T.ink.base,
                color: "#030511",
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
                opacity: signInMutation.isPending || isSubmitting ? 0.6 : 1,
              }}
            >
              {signInMutation.isPending ? "Signing in…" : "Sign in →"}
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
            Don&apos;t have an account?{" "}
            <GlobalLink
              href="/auth/register"
              style={{ color: T.accent.aurora, textDecoration: "none" }}
              className="hover:underline"
            >
              Create one — it&apos;s free
            </GlobalLink>
          </p>

          {/* Footer */}
          <div
            style={{
              marginTop: "40px",
              display: "flex",
              justifyContent: "space-between",
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.ghost,
            }}
          >
            <span>Secured by TLS 1.3</span>
            <div style={{ display: "flex", gap: "12px" }}>
              <span>Privacy</span>
              <span>Terms</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
