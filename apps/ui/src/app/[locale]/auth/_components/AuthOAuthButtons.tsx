"use client"

import { useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"

interface AuthOAuthButtonsProps {
  mode: "signin" | "register"
}

const oauthBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  padding: "10px 14px",
  borderRadius: "10px",
  border: `1px solid ${T.border.hi}`,
  background: T.bg.surface,
  color: T.ink.dim,
  fontSize: "13px",
  fontFamily: T.font.sans,
  fontWeight: 500,
  cursor: "pointer",
  transition: "background 150ms, border-color 150ms",
  textDecoration: "none",
  width: "100%",
} as const

export function AuthOAuthButtons({ mode }: AuthOAuthButtonsProps) {
  const [loading, setLoading] = useState<"google" | null>(null)

  const handleOAuth = async (provider: "google") => {
    setLoading(provider)
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: "/auth/post-signin",
      })
      if (result?.error) {
        toast.error(result.error.message ?? `${provider} sign-in failed`)
        setLoading(null)
      }
      // On success the redirect plugin navigates away — no need to clear loading
    } catch {
      toast.error(`${provider} sign-in failed. Please try again.`)
      setLoading(null)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Google */}
      <div>
        <button
          type="button"
          disabled={loading !== null}
          style={{ ...oauthBtnStyle, opacity: loading ? 0.6 : 1 }}
          className="hover:border-(--t-border-hi) hover:bg-(--t-bg-deep)"
          onClick={() => handleOAuth("google")}
        >
          {/* Google icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {loading === "google" ? "Redirecting…" : "Continue with Google"}
        </button>
      </div>

      {/* Divider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          margin: "4px 0",
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
          {mode === "signin"
            ? "or sign in with email"
            : "or register with email"}
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
    </div>
  )
}
