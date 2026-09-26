"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"

import { AuthLeftPanel } from "@/app/[locale]/auth/_components/AuthLeftPanel"
import { AuthOAuthButtons } from "@/app/[locale]/auth/_components/AuthOAuthButtons"
import GlobalLink from "@/components/global/GlobalLink"
import { UseSearchParamsWrapper } from "@/components/helpers/UseSearchParamsWrapper"
import { useUserMutations } from "@/hooks/useUserMutations"
import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import { safeRedirectPath } from "@/lib/safe-redirect"

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
  fontFamily: T.font.sans,
  fontSize: "13px",
  color: T.ink.low,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "6px",
}

const PasswordFormSchema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
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
  const [magicEmail, setMagicEmail] = useState("")
  const [magicPending, setMagicPending] = useState(false)

  const form = useForm<z.infer<typeof PasswordFormSchema>>({
    resolver: zodResolver(PasswordFormSchema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    signInMutation.mutate(values, {
      onSuccess: async () => {
        const { data } = await authClient.getSession()
        const username = (data?.user as Record<string, unknown> | undefined)
          ?.username as string | null | undefined
        if (!username) {
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

  return (
    <>
      <AuthLeftPanel mode="signin" />

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
              fontFamily: T.font.sans,
              fontSize: "13px",
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
            href="/auth/register"
            style={{
              fontFamily: T.font.sans,
              fontSize: "13px",
              color: T.ink.faint,
              textDecoration: "none",
            }}
            className="transition-colors hover:text-(--t-ink-base)"
          >
            New here?{" "}
            <span style={{ color: T.accent.aurora }}>Create account</span>
          </GlobalLink>
        </div>

        <div style={{ maxWidth: "380px", width: "100%", margin: "0 auto" }}>
          {/* Eyebrow */}
          <p
            style={{
              fontFamily: T.font.sans,
              fontSize: "13px",
              color: T.ink.faint,
              marginBottom: "12px",
            }}
          >
            Sign in
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
          <AuthOAuthButtons mode="signin" />

          {/* Email / password form */}
          <form
            onSubmit={onSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div>
              <label style={labelStyle} htmlFor="email">
                <span>Email address</span>
                <span style={{ color: T.accent.aurora, fontSize: "13px" }}>
                  *
                </span>
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@library.org"
                style={inputStyle}
                className="focus:border-(--t-aurora-edge) focus:bg-(--t-aurora-soft)"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p
                  style={{
                    fontSize: "13px",
                    color: T.accent.danger,
                    marginTop: "4px",
                  }}
                >
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label style={labelStyle} htmlFor="password">
                <span>Password</span>
                <GlobalLink
                  href="/auth/forgot-password"
                  style={{
                    fontFamily: T.font.sans,
                    fontSize: "13px",
                    color: T.ink.faint,
                    textDecoration: "none",
                  }}
                  className="transition-colors hover:text-(--t-accent-aurora)"
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
                className="focus:border-(--t-aurora-edge) focus:bg-(--t-aurora-soft)"
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p
                  style={{
                    fontSize: "13px",
                    color: T.accent.danger,
                    marginTop: "4px",
                  }}
                >
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={signInMutation.isPending || form.formState.isSubmitting}
              style={{
                marginTop: "6px",
                width: "100%",
                padding: "13px",
                borderRadius: "999px",
                background: T.accent.primary,
                color: "#fff",
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
                opacity:
                  signInMutation.isPending || form.formState.isSubmitting
                    ? 0.6
                    : 1,
              }}
            >
              {signInMutation.isPending ? "Signing in…" : "Sign in →"}
            </button>
          </form>

          {/* Magic link divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              margin: "20px 0 16px",
            }}
          >
            <span
              style={{
                flex: 1,
                height: "1px",
                background: T.border.line,
                display: "block",
              }}
            />
            <span
              style={{
                fontFamily: T.font.sans,
                fontSize: "13px",
                color: T.ink.faint,
              }}
            >
              or use a magic link
            </span>
            <span
              style={{
                flex: 1,
                height: "1px",
                background: T.border.line,
                display: "block",
              }}
            />
          </div>

          {/* Magic link form */}
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!magicEmail) return
              setMagicPending(true)
              try {
                const result = await authClient.signIn.magicLink({
                  email: magicEmail,
                  callbackURL: callbackUrl,
                })
                if (result?.error) {
                  toast.error(
                    result.error.message ?? "Failed to send magic link"
                  )
                } else {
                  globalThis.location.href = "/auth/magic-link-sent"
                }
              } catch {
                toast.error("Failed to send magic link. Please try again.")
              } finally {
                setMagicPending(false)
              }
            }}
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <input
              type="email"
              placeholder="you@library.org"
              value={magicEmail}
              onChange={(e) => setMagicEmail(e.target.value)}
              required
              style={inputStyle}
              className="focus:border-(--t-aurora-edge) focus:bg-(--t-aurora-soft)"
            />
            <button
              type="submit"
              disabled={magicPending || !magicEmail}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: "10px",
                background: "transparent",
                color: T.accent.aurora,
                fontFamily: T.font.sans,
                fontWeight: 500,
                fontSize: "14px",
                border: `1px solid var(--t-aurora-edge)`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                transition: "opacity 150ms, background 150ms",
                opacity: magicPending || !magicEmail ? 0.5 : 1,
              }}
            >
              {magicPending ? "Sending…" : "Send magic link →"}
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
              fontFamily: T.font.sans,
              fontSize: "13px",
              color: T.ink.faint,
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
