"use client"

// apps/ui/src/app/[locale]/auth/verify-email-sent/_components/VerifyEmailContent.tsx
//
// Sign-up sends the first confirmation email. An unconfirmed sign-in or failed
// link offers an explicit resend rather than sending email automatically.

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"
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
import { useAuthFlow } from "@/app/[locale]/auth/_components/useAuthFlow"
import { useMounted } from "@/hooks/useMounted"
import { authClient } from "@/lib/auth-client"
import {
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

const STATUS_ICONS = [
  "mdi:check-circle-outline",
  "mdi:alert-circle-outline",
] as const

const EmailSchema = (tStatic: ReturnType<typeof useTranslations<"staticUi">>) =>
  z
    .string()
    .trim()
    .min(1, tStatic("auth.enter_your_email_address"))
    .email(tStatic("auth.enter_a_valid_email_address"))

export function VerifyEmailContent({ state }: { state: VerifyEmailState }) {
  const { heading, flowRich, tFlow, lifetime } = useAuthFlow()

  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const tUi = useTranslations("ui")

  usePreloadedIcons(STATUS_ICONS)
  const mounted = useMounted()
  const knownEmail = usePendingEmail()
  const emailWentOut = state === "sent"
  const HEADINGS = {
    sent: {
      icon: "mdi:email-fast-outline",
      tone: "info" as const,
      title: heading("inbox"),
    },
    unverified: {
      icon: "mdi:email-alert-outline",
      tone: "info" as const,
      title: heading("confirm"),
    },
    expired: {
      icon: "mdi:clock-alert-outline",
      tone: "warn" as const,
      title: heading("expired"),
    },
    invalid: {
      icon: "mdi:link-variant-off",
      tone: "warn" as const,
      title: heading("invalid"),
    },
  }

  function subtitleFor(state: VerifyEmailState, email: string | null) {
    switch (state) {
      case "sent":
        return email
          ? flowRich("confirmationSent", email)
          : tStatic(
              "auth.we_sent_a_confirmation_link_to_the_address_you_signed_up_with_open_it_to_finish_creating_your_accoun"
            )
      case "unverified":
        return email
          ? flowRich("confirmBefore", email)
          : tStatic(
              "auth.confirm_your_email_before_signing_in_use_your_original_confirmation_email_or_request_a_new_link_belo"
            )
      case "expired":
        return tFlow("confirmationExpired", {
          duration: lifetime(VERIFICATION_LINK_TTL_SECONDS),
        })
      case "invalid":
        return tStatic(
          "auth.it_may_have_been_copied_only_in_part_if_you_ve_already_confirmed_your_email_sign_in_if_not_send_your"
        )
    }
  }

  const currentHeading = HEADINGS[state]

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
          text: tStatic("auth.too_many_attempts_wait_a_minute_then_try_again"),
        })
      } else if (error) {
        setStatus({
          tone: "error",
          text: tStatic("auth.we_couldn_t_send_the_email_please_try_again"),
        })
      } else {
        setCooldown(RESEND_COOLDOWN)
        // Better Auth answers the same whether or not the address has an
        // account, so only an address from this sign-up is named as sent.
        setStatus({
          tone: "ok",
          text:
            email === knownEmail
              ? flowRich("newLinkSent", email)
              : flowRich("newLinkIfAccount", email),
        })
      }
    } catch {
      setStatus({
        tone: "error",
        text: tStatic("auth.we_couldn_t_send_the_email_please_try_again"),
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
    const parsed = EmailSchema(tStatic).safeParse(emailValue)
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message)

      return
    }
    setFieldError(undefined)
    void send(parsed.data)
  }

  let buttonLabel = emailWentOut
    ? tStatic("auth.resend_the_email")
    : tStatic("auth.send_a_new_link")
  if (pending) buttonLabel = "Sending…"
  else if (cooldown > 0) buttonLabel = `Resend in ${cooldown}s`
  const buttonDisabled = pending || cooldown > 0

  return (
    <>
      <AuthHeading
        layout="utility"
        icon={currentHeading.icon}
        iconTone={currentHeading.tone}
        title={currentHeading.title}
        subtitle={subtitleFor(state, knownEmail)}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {emailWentOut && (
          <AuthInboxHint
            subject={VERIFICATION_EMAIL_SUBJECT}
            detail={tFlow("linkFor", {
              duration: lifetime(VERIFICATION_LINK_TTL_SECONDS),
            })}
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
              <AuthField
                id="email"
                label={tUi("email_address")}
                error={fieldError}
              >
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
            {tStatic(
              "auth.nothing_yet_check_your_spam_or_promotions_folder_emails_can_take_a_few_minutes_to_arrive"
            )}
          </AuthNote>
        )}
      </div>

      {state === "sent" ? (
        <AuthSwitchPrompt
          prompt={tStatic("auth.wrong_address")}
          linkLabel={tExisting("ui.start_again")}
          href="/auth/register"
        />
      ) : (
        <AuthSwitchPrompt
          prompt={
            state === "unverified"
              ? tStatic("auth.used_a_different_address")
              : tStatic("auth.already_confirmed")
          }
          linkLabel={
            state === "unverified"
              ? tStatic("auth.back_to_sign_in")
              : tUi("sign_in")
          }
          href="/auth/signin"
        />
      )}
    </>
  )
}
