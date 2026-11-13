"use client"

// apps/ui/src/app/[locale]/auth/magic-link/_components/MagicLinkErrorContent.tsx
//
// A sign-in link that failed lands here (its errorCallbackURL) with Better
// Auth's code in `?error=`. A working link never does: it goes to post-signin.

import { useTranslations } from "next-intl"
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
import { useAuthFlow } from "@/app/[locale]/auth/_components/useAuthFlow"
import { authClient } from "@/lib/auth-client"
import { MAGIC_LINK_TTL_SECONDS } from "@/lib/auth-links"
import { magicLinkCallbacks } from "@/lib/auth-redirects"

const STATUS_ICONS = ["mdi:alert-circle-outline"] as const

const EmailSchema = (tStatic: ReturnType<typeof useTranslations<"staticUi">>) =>
  z
    .string()
    .trim()
    .min(1, tStatic("auth.enter_your_email_address"))
    .email(tStatic("auth.enter_a_valid_email_address"))

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

export function MagicLinkErrorContent({ error }: { error: string }) {
  const { heading, tFlow, lifetime } = useAuthFlow()

  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const COPY = {
    expired: {
      icon: "mdi:clock-alert-outline",
      title: heading("expired"),
      subtitle: tFlow("magicExpired", {
        duration: lifetime(MAGIC_LINK_TTL_SECONDS),
      }),
    },
    used: {
      icon: "mdi:link-variant-off",
      title: heading("invalid"),
      subtitle: tStatic(
        "auth.it_may_have_been_used_already_each_sign_in_link_works_once_send_yourself_a_new_one"
      ),
    },
    "no-account": {
      icon: "mdi:account-question-outline",
      title: heading("noAccount"),
      subtitle: tStatic(
        "auth.there_s_no_account_for_that_email_address_creating_one_is_free_and_takes_a_minute"
      ),
    },
    failed: {
      icon: "mdi:alert-circle-outline",
      title: heading("failed"),
      subtitle: tStatic(
        "auth.something_went_wrong_on_our_side_send_yourself_a_new_link_or_sign_in_with_your_password"
      ),
    },
  }

  const failure = failureFor(error)
  const copy = COPY[failure]

  return (
    <>
      <AuthHeading
        layout="utility"
        icon={copy.icon}
        iconTone="warn"
        title={copy.title}
        subtitle={copy.subtitle}
      />

      {failure === "no-account" ? (
        <>
          <AuthPrimaryLink href="/auth/register">
            {tExisting("auth.signIn.createAccount")}
          </AuthPrimaryLink>
          <AuthSwitchPrompt
            prompt={tStatic("auth.used_a_different_address")}
            linkLabel={tStatic("auth.back_to_sign_in")}
            href="/auth/signin"
          />
        </>
      ) : (
        <>
          <NewLinkForm />
          <AuthSwitchPrompt
            prompt={tStatic("auth.prefer_your_password")}
            linkLabel={tExisting("ui.sign_in")}
            href="/auth/signin"
          />
        </>
      )}
    </>
  )
}

function NewLinkForm() {
  const tStatic = useTranslations("staticUi")

  const tUi = useTranslations("ui")

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
    const parsed = EmailSchema(tStatic).safeParse(emailValue)
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
              ? tStatic("auth.too_many_attempts_wait_a_minute_then_try_again")
              : tStatic("auth.we_couldn_t_send_the_link_please_try_again"),
        })

        return
      }
      rememberPendingEmail(parsed.data)
      globalThis.location.href = "/auth/magic-link-sent"
    } catch {
      setStatus({
        tone: "error",
        text: tStatic("auth.we_couldn_t_send_the_link_please_try_again"),
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
          {pending ? tUi("sending") : tStatic("auth.email_me_a_new_link")}
        </AuthPrimaryButton>
        <AuthStatusMessage status={status} />
      </div>
    </form>
  )
}
