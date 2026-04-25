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

const tabBtnStyle = (active: boolean) => ({
  flex: 1,
  padding: "8px",
  borderRadius: "8px",
  border: "none",
  background: active ? "rgba(255,255,255,.08)" : "transparent",
  color: active ? T.ink.base : T.ink.faint,
  fontFamily: T.font.mono,
  fontSize: "9px",
  letterSpacing: ".16em",
  textTransform: "uppercase" as const,
  cursor: "pointer",
  transition: "background 150ms, color 150ms",
})

const PasswordFormSchema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
})

const MagicLinkFormSchema = z.object({
  email: z.string().min(1).email(),
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
  const callbackUrl = searchParams.get("callbackUrl") ?? "/"
  const { signInMutation } = useUserMutations()
  const [tab, setTab] = useState<"password" | "magic">("password")
  const [magicLinkPending, setMagicLinkPending] = useState(false)

  const passwordForm = useForm<z.infer<typeof PasswordFormSchema>>({
    resolver: zodResolver(PasswordFormSchema),
    defaultValues: { email: "", password: "" },
  })

  const magicLinkForm = useForm<z.infer<typeof MagicLinkFormSchema>>({
    resolver: zodResolver(MagicLinkFormSchema),
    defaultValues: { email: "" },
  })

  const onPasswordSubmit = passwordForm.handleSubmit(async (values) => {
    signInMutation.mutate(values, {
      onSuccess: () => {
        globalThis.location.href = callbackUrl
      },
      onError: (error) => {
        const msg = error instanceof Error ? error.message : "Sign in failed"
        const display = msg.includes("identifier or password")
          ? "Incorrect email or password."
          : msg
        toast.error(display)
      },
    })
  })

  const onMagicLinkSubmit = magicLinkForm.handleSubmit(async (values) => {
    setMagicLinkPending(true)
    try {
      const result = await authClient.signIn.magicLink({
        email: values.email,
        callbackURL: callbackUrl,
      })
      if (result.error) {
        toast.error(result.error.message ?? "Failed to send magic link")

        return
      }
      globalThis.location.href = "/auth/magic-link-sent"
    } catch {
      toast.error("Failed to send magic link. Please try again.")
    } finally {
      setMagicLinkPending(false)
    }
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
          <AuthOAuthButtons mode="signin" />

          {/* Tab switcher */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              padding: "4px",
              borderRadius: "10px",
              background: "rgba(255,255,255,.04)",
              border: `1px solid ${T.border.line}`,
              marginBottom: "16px",
            }}
          >
            <button
              type="button"
              style={tabBtnStyle(tab === "password")}
              onClick={() => setTab("password")}
            >
              Password
            </button>
            <button
              type="button"
              style={tabBtnStyle(tab === "magic")}
              onClick={() => setTab("magic")}
            >
              Magic Link
            </button>
          </div>

          {/* Password tab */}
          {tab === "password" && (
            <form
              onSubmit={onPasswordSubmit}
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
                  {...passwordForm.register("email")}
                />
                {passwordForm.formState.errors.email && (
                  <p
                    style={{
                      fontSize: "11px",
                      color: T.accent.danger,
                      marginTop: "4px",
                    }}
                  >
                    {passwordForm.formState.errors.email.message}
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
                  {...passwordForm.register("password")}
                />
                {passwordForm.formState.errors.password && (
                  <p
                    style={{
                      fontSize: "11px",
                      color: T.accent.danger,
                      marginTop: "4px",
                    }}
                  >
                    {passwordForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  signInMutation.isPending ||
                  passwordForm.formState.isSubmitting
                }
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
                  opacity:
                    signInMutation.isPending ||
                    passwordForm.formState.isSubmitting
                      ? 0.6
                      : 1,
                }}
              >
                {signInMutation.isPending ? "Signing in…" : "Sign in →"}
              </button>
            </form>
          )}

          {/* Magic link tab */}
          {tab === "magic" && (
            <form
              onSubmit={onMagicLinkSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div>
                <label style={labelStyle} htmlFor="magic-email">
                  <span>Email address</span>
                  <span style={{ color: T.accent.aurora, fontSize: "9px" }}>
                    *
                  </span>
                </label>
                <input
                  id="magic-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@library.org"
                  style={inputStyle}
                  className="focus:border-[rgba(127,223,255,.4)] focus:bg-[rgba(127,223,255,.03)]"
                  {...magicLinkForm.register("email")}
                />
                {magicLinkForm.formState.errors.email && (
                  <p
                    style={{
                      fontSize: "11px",
                      color: T.accent.danger,
                      marginTop: "4px",
                    }}
                  >
                    {magicLinkForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <p
                style={{
                  fontSize: "12px",
                  color: T.ink.faint,
                  lineHeight: "1.6",
                  margin: "0",
                }}
              >
                We&apos;ll send a one-time sign-in link to your inbox. No
                password required.
              </p>

              <button
                type="submit"
                disabled={
                  magicLinkPending || magicLinkForm.formState.isSubmitting
                }
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
                  opacity:
                    magicLinkPending || magicLinkForm.formState.isSubmitting
                      ? 0.6
                      : 1,
                }}
              >
                {magicLinkPending ? "Sending link…" : "Send sign-in link →"}
              </button>
            </form>
          )}

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
