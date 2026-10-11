"use client"

// apps/ui/src/app/[locale]/auth/magic-link/_components/MagicLinkErrorContent.tsx
//
// A sign-in link that failed lands here (its errorCallbackURL) with Better
// Auth's code in `?error=`. A working link never does: it goes to post-signin.

import { useTranslations as useUiTranslations } from "next-intl"
import { type FormEvent, useState } from "react"
import * as z from "zod"

import { authErrorParts } from "@/app/[locale]/auth/_components/auth-error"
import {
  AuthField,
  AuthHeading,
  authInputClassName,
  authInputStyle,
  AuthPrimaryButton,
  AuthPrimaryLink,
  type AuthStatus,
  AuthStatusMessage,
  AuthSwitchPrompt,
  fieldA11y,
  usePreloadedIcons,
} from "@/app/[locale]/auth/_components/AuthFormParts"
import {
  rememberPendingEmail,
  usePendingEmail,
} from "@/app/[locale]/auth/_components/pending-email"
import { authClient } from "@/lib/auth-client"
import { linkLifetime, MAGIC_LINK_TTL_SECONDS } from "@/lib/auth-links"
import { magicLinkCallbacks } from "@/lib/auth-redirects"

const LIFETIME = linkLifetime(MAGIC_LINK_TTL_SECONDS)

const STATUS_ICONS = ["mdi:alert-circle-outline"] as const

const EmailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .email("Enter a valid email address")

type Failure = "expired" | "used" | "no-account" | "failed"

/** Better Auth's magic-link error codes, grouped by what the reader can do. */
function failureFor(code: string): Failure {
  switch (code) {
    case "EXPIRED_TOKEN":
      return "expired"
    case "INVALID_TOKEN":
      return "used"
    case "new_user_signup_disabled":
      return "no-account"

    default:
      return "failed"
  }
}

const COPY: Record<
  Failure,
  { icon: string; title: string; italic: string; subtitle: string }
> = {
  expired: {
    icon: "mdi:clock-alert-outline",
    title: "That link has",
    italic: "expired.",
    subtitle: `Sign-in links work once, within ${LIFETIME}. Send yourself a new one and open it straight away.`,
  },
  used: {
    icon: "mdi:link-variant-off",
    title: "That link didn’t",
    italic: "work.",
    subtitle:
      "It may have been used already: each sign-in link works once. Send yourself a new one.",
  },
  "no-account": {
    icon: "mdi:account-question-outline",
    title: "No account",
    italic: "yet.",
    subtitle:
      "There’s no account for that email address. Creating one is free and takes a minute.",
  },
  failed: {
    icon: "mdi:alert-circle-outline",
    title: "We couldn’t",
    italic: "sign you in.",
    subtitle:
      "Something went wrong on our side. Send yourself a new link, or sign in with your password.",
  },
}

export function MagicLinkErrorContent({ error }: { error: string }) {
  const failure = failureFor(error)
  const copy = COPY[failure]

  return (
    <>
      <AuthHeading
        layout="utility"
        icon={copy.icon}
        iconTone="warn"
        title={copy.title}
        italic={copy.italic}
        subtitle={copy.subtitle}
      />

      {failure === "no-account" ? (
        <>
          <AuthPrimaryLink href="/auth/register">
            Create an account
          </AuthPrimaryLink>
          <AuthSwitchPrompt
            prompt="Used a different address?"
            linkLabel="Back to sign in"
            href="/auth/signin"
          />
        </>
      ) : (
        <>
          <NewLinkForm />
          <AuthSwitchPrompt
            prompt="Prefer your password?"
            linkLabel="Sign in"
            href="/auth/signin"
          />
        </>
      )}
    </>
  )
}

function NewLinkForm() {
  const tUi = useUiTranslations("ui")

  usePreloadedIcons(STATUS_ICONS)
  const knownEmail = usePendingEmail()
  // null until edited, so the field starts with the address from this tab.
  const [typedEmail, setTypedEmail] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string>()
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<AuthStatus>(null)
  const emailValue = typedEmail ?? knownEmail ?? ""

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = EmailSchema.safeParse(emailValue)
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message)

      return
    }
    setFieldError(undefined)
    setStatus(null)
    setPending(true)
    try {
      // The original destination is gone by now; post-signin still sends a
      // first sign-in to onboarding.
      const { error } = await authClient.signIn.magicLink({
        email: parsed.data,
        ...magicLinkCallbacks("/"),
      })
      if (error) {
        setStatus({
          tone: "error",
          text:
            authErrorParts(error).status === 429
              ? "Too many attempts. Wait a minute, then try again."
              : "We couldn’t send the link. Please try again.",
        })

        return
      }
      rememberPendingEmail(parsed.data)
      globalThis.location.href = "/auth/magic-link-sent"
    } catch {
      setStatus({
        tone: "error",
        text: "We couldn’t send the link. Please try again.",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    // A native submit (before hydration) POSTs to this page instead of
    // putting the email address in a query string.
    <form
      method="post"
      action="/auth/magic-link"
      onSubmit={onSubmit}
      noValidate
      style={{ display: "flex", flexDirection: "column", gap: "20px" }}
    >
      <AuthField id="email" label={tUi("email_address")} error={fieldError}>
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
      <div>
        <AuthPrimaryButton disabled={pending}>
          {pending ? tUi("sending") : "Email me a new link"}
        </AuthPrimaryButton>
        <AuthStatusMessage status={status} />
      </div>
    </form>
  )
}
