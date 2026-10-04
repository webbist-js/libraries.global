"use client"

// apps/ui/src/app/[locale]/auth/verify-email-sent/_components/VerifyEmailContent.tsx
//
// Sign-up's second step. The confirmation email has gone out (after sign-up,
// or after signing in to an unconfirmed account), or the link in it failed;
// either way the reader can send themselves a new one.

import { Icon } from "@iconify/react"
import { type FormEvent, useEffect, useState } from "react"
import * as z from "zod"

import {
  AuthField,
  AuthHeading,
  AuthInboxHint,
  authInputClassName,
  authInputStyle,
  AuthNote,
  AuthPrimaryButton,
  AuthSecondaryButton,
  type AuthStatus,
  AuthStatusMessage,
  AuthSwitchPrompt,
  fieldA11y,
  usePreloadedIcons,
} from "@/app/[locale]/auth/_components/AuthFormParts"
import { usePendingEmail } from "@/app/[locale]/auth/_components/pending-email"
import { useMounted } from "@/hooks/useMounted"
import { authClient } from "@/lib/auth-client"
import {
  linkLifetime,
  VERIFICATION_EMAIL_SUBJECT,
  VERIFICATION_LINK_TTL_SECONDS,
} from "@/lib/auth-links"
import {
  POST_SIGNIN_PATH,
  VERIFY_EMAIL_PATH,
  type VerifyEmailState,
} from "@/lib/auth-redirects"
import { T } from "@/lib/design-tokens"

/** Seconds between sends. Better Auth allows three a minute. */
const RESEND_COOLDOWN = 30
const RATE_LIMITED_COOLDOWN = 60

const LIFETIME = linkLifetime(VERIFICATION_LINK_TTL_SECONDS)

const STATUS_ICONS = [
  "mdi:check-circle-outline",
  "mdi:alert-circle-outline",
] as const

const EmailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .email("Enter a valid email address")

const HEADINGS: Record<
  VerifyEmailState,
  { icon: string; tone: "info" | "warn"; title: string; italic: string }
> = {
  sent: {
    icon: "mdi:email-fast-outline",
    tone: "info",
    title: "Check your",
    italic: "inbox.",
  },
  unverified: {
    icon: "mdi:email-alert-outline",
    tone: "info",
    title: "Confirm your",
    italic: "email first.",
  },
  expired: {
    icon: "mdi:clock-alert-outline",
    tone: "warn",
    title: "That link has",
    italic: "expired.",
  },
  invalid: {
    icon: "mdi:link-variant-off",
    tone: "warn",
    title: "That link didn’t",
    italic: "work.",
  },
}

function subtitleFor(state: VerifyEmailState, email: string | null) {
  const to = email ? (
    <strong style={{ color: T.ink.base }}>{email}</strong>
  ) : null

  switch (state) {
    case "sent":
      return to ? (
        <>
          We sent a confirmation link to {to}. Open it to finish creating your
          account.
        </>
      ) : (
        "We sent a confirmation link to the address you signed up with. Open it to finish creating your account."
      )
    case "unverified":
      return to ? (
        <>
          Your account isn&rsquo;t confirmed yet, so we&rsquo;ve sent a new link
          to {to}.
        </>
      ) : (
        "Your account isn’t confirmed yet, so we’ve sent a new link to your email address."
      )
    case "expired":
      return `Confirmation links work for ${LIFETIME}. Send yourself a new one and open it from your inbox.`
    case "invalid":
      return "It may have been copied only in part. If you’ve already confirmed your email, sign in. If not, send yourself a new link."
  }
}

export function VerifyEmailContent({ state }: { state: VerifyEmailState }) {
  usePreloadedIcons(STATUS_ICONS)
  const mounted = useMounted()
  const knownEmail = usePendingEmail()
  const emailWentOut = state === "sent" || state === "unverified"
  const heading = HEADINGS[state]

  // null until edited, so the field starts with the address from this tab.
  const [typedEmail, setTypedEmail] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string>()
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<AuthStatus>(null)
  // The email has only just gone out, so a resend waits a moment.
  const [cooldown, setCooldown] = useState(emailWentOut ? RESEND_COOLDOWN : 0)

  // After a failed link, show the address being sent to, even a known one.
  const askForEmail = !emailWentOut || !knownEmail
  const emailValue = typedEmail ?? knownEmail ?? ""

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)

    return () => clearTimeout(timer)
  }, [cooldown])

  const send = async (email: string) => {
    setPending(true)
    setStatus(null)
    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: POST_SIGNIN_PATH,
      })
      if (error?.status === 429) {
        setCooldown(RATE_LIMITED_COOLDOWN)
        setStatus({
          tone: "error",
          text: "Too many attempts. Wait a minute, then try again.",
        })
      } else if (error) {
        setStatus({
          tone: "error",
          text: "We couldn’t send the email. Please try again.",
        })
      } else {
        setCooldown(RESEND_COOLDOWN)
        // Better Auth answers the same whether or not the address has an
        // account, so only an address from this sign-up is named as sent.
        setStatus({
          tone: "ok",
          text:
            email === knownEmail ? (
              <>
                New link sent to <strong>{email}</strong>.
              </>
            ) : (
              <>
                If <strong>{email}</strong> has an account, a new link is on its
                way.
              </>
            ),
        })
      }
    } catch {
      setStatus({
        tone: "error",
        text: "We couldn’t send the email. Please try again.",
      })
    } finally {
      setPending(false)
    }
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!askForEmail && knownEmail) {
      void send(knownEmail)

      return
    }
    const parsed = EmailSchema.safeParse(emailValue)
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message)

      return
    }
    setFieldError(undefined)
    void send(parsed.data)
  }

  let buttonLabel = emailWentOut ? "Resend the email" : "Send a new link"
  if (pending) buttonLabel = "Sending…"
  else if (cooldown > 0) buttonLabel = `Resend in ${cooldown}s`
  const buttonDisabled = pending || cooldown > 0

  return (
    <>
      <AuthHeading
        icon={heading.icon}
        iconTone={heading.tone}
        title={heading.title}
        italic={heading.italic}
        subtitle={subtitleFor(state, knownEmail)}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {emailWentOut && (
          <AuthInboxHint
            subject={VERIFICATION_EMAIL_SUBJECT}
            detail={`The link works for ${LIFETIME}.`}
          />
        )}

        {/* A native submit (before hydration) POSTs to this page instead of
            putting the email address in a query string. */}
        <form
          method="post"
          action={VERIFY_EMAIL_PATH}
          onSubmit={onSubmit}
          noValidate
        >
          {askForEmail && (
            <div style={{ marginBottom: "16px" }}>
              <AuthField id="email" label="Email address" error={fieldError}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.org"
                  value={emailValue}
                  onChange={(e) => setTypedEmail(e.target.value)}
                  style={authInputStyle}
                  className={authInputClassName}
                  {...fieldA11y("email", fieldError)}
                />
              </AuthField>
            </div>
          )}

          {emailWentOut ? (
            <AuthSecondaryButton
              type="submit"
              disabled={buttonDisabled || !mounted}
            >
              <Icon
                icon="mdi:refresh"
                width={20}
                aria-hidden="true"
                style={{ color: T.accent.primary }}
              />
              {buttonLabel}
            </AuthSecondaryButton>
          ) : (
            <AuthPrimaryButton disabled={buttonDisabled}>
              {buttonLabel}
            </AuthPrimaryButton>
          )}

          <AuthStatusMessage status={status} />
        </form>

        {emailWentOut && (
          <AuthNote>
            Nothing yet? Check your spam or promotions folder. Emails can take a
            few minutes to arrive.
          </AuthNote>
        )}
      </div>

      {state === "sent" ? (
        <AuthSwitchPrompt
          prompt="Wrong address?"
          linkLabel="Start again"
          href="/auth/register"
        />
      ) : (
        <AuthSwitchPrompt
          prompt={
            state === "unverified"
              ? "Used a different address?"
              : "Already confirmed?"
          }
          linkLabel={state === "unverified" ? "Back to sign in" : "Sign in"}
          href="/auth/signin"
        />
      )}
    </>
  )
}
