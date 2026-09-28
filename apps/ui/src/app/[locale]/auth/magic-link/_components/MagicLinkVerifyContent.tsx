"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { UseSearchParamsWrapper } from "@/components/helpers/UseSearchParamsWrapper"
import { T } from "@/lib/design-tokens"

/** Better Auth's magic-link error codes, in plain words. */
const ERROR_COPY: Record<string, string> = {
  INVALID_TOKEN:
    "This sign-in link isn't valid. It may have been used already.",
  EXPIRED_TOKEN: "This sign-in link has expired.",
  new_user_signup_disabled:
    "There's no account for that email address yet. Create an account first.",
  failed_to_create_session: "We couldn't sign you in. Please try again.",
}

function describeError(error: string): string {
  if (ERROR_COPY[error]) return ERROR_COPY[error]
  try {
    return decodeURIComponent(error)
  } catch {
    return error
  }
}

export function MagicLinkVerifyContent() {
  return (
    <UseSearchParamsWrapper>
      <SuspensedMagicLinkVerifyContent />
    </UseSearchParamsWrapper>
  )
}

function SuspensedMagicLinkVerifyContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const error = searchParams.get("error")
  const [countdown, setCountdown] = useState(2)

  // If no error, auto-redirect to home after a short delay
  useEffect(() => {
    if (error) return

    if (countdown <= 0) {
      router.replace("/")

      return
    }

    const timer = setTimeout(() => {
      setCountdown((c) => c - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [error, countdown, router])

  return (
    <div
      className="w-full max-w-md rounded-2xl p-10"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.hi}`,
      }}
    >
      {error ? (
        <>
          {/* Error icon */}
          <div
            className="mb-6 flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: "rgba(255,138,138,.10)",
              border: `1px solid rgba(255,138,138,.25)`,
              fontSize: "24px",
            }}
            aria-hidden="true"
          >
            ✕
          </div>

          {/* Heading */}
          <h1
            className="mb-3 text-3xl"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 400,
              color: T.ink.base,
              lineHeight: 1.2,
            }}
          >
            Link verification failed
          </h1>

          {/* Error message */}
          <p
            className="mb-2 text-base leading-relaxed"
            style={{ fontFamily: T.font.sans, color: T.ink.dim }}
          >
            {describeError(error)}
          </p>

          <p
            className="mb-8 text-sm"
            style={{ fontFamily: T.font.sans, color: T.ink.low }}
          >
            Sign-in links expire after 5 minutes and can only be used once.
            Please request a new link to continue.
          </p>
        </>
      ) : (
        <>
          {/* Loading icon */}
          <div
            className="mb-6 flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              background: T.accent.chip,
              border: `1px solid ${T.border.hi}`,
              fontSize: "24px",
            }}
            aria-hidden="true"
          >
            ✓
          </div>

          {/* Heading */}
          <h1
            className="mb-3 text-3xl"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 400,
              color: T.ink.base,
              lineHeight: 1.2,
            }}
          >
            Signed in successfully
          </h1>

          {/* Body */}
          <p
            className="mb-2 text-base leading-relaxed"
            style={{ fontFamily: T.font.sans, color: T.ink.dim }}
          >
            Your sign-in was verified. Redirecting you now…
          </p>

          <p
            className="mb-8 text-sm"
            style={{ fontFamily: T.font.sans, color: T.ink.low }}
          >
            You will be redirected in {countdown} second
            {countdown !== 1 ? "s" : ""}.
          </p>
        </>
      )}

      {/* Divider */}
      <div className="mb-6 h-px w-full" style={{ background: T.border.line }} />

      {/* Back to sign in */}
      <GlobalLink
        href="/auth/signin"
        className="text-sm transition-colors"
        style={{
          fontFamily: T.font.sans,
          fontSize: "13px",
          color: T.accent.primary,
          textDecoration: "none",
        }}
      >
        ← Back to sign in and request a new link
      </GlobalLink>
    </div>
  )
}
