import { safeRedirectPath } from "./safe-redirect"

/** Decides "onboarding or destination" for every sign-in path. */
export const POST_SIGNIN_PATH = "/auth/post-signin"

/** Shows a magic link's error (`?error=<code>`). */
export const MAGIC_LINK_ERROR_PATH = "/auth/magic-link"

/**
 * The `callbackURL` and `errorCallbackURL` for `authClient.signIn.magicLink`.
 *
 * A verified link must land on post-signin, which sends a user who has never
 * onboarded to onboarding; going straight to the destination skipped it.
 *
 * Better Auth's verify endpoint runs `decodeURIComponent` on the callback once
 * before redirecting, so `next` is encoded twice: after that decode the
 * post-signin page still receives one encoded value, and a destination that
 * contains `&` survives intact.
 */
export function magicLinkCallbacks(callbackUrl: string | null | undefined): {
  callbackURL: string
  errorCallbackURL: string
} {
  const next = safeRedirectPath(callbackUrl)
  const callbackURL =
    next === "/"
      ? POST_SIGNIN_PATH
      : `${POST_SIGNIN_PATH}?next=${encodeURIComponent(encodeURIComponent(next))}`

  return { callbackURL, errorCallbackURL: MAGIC_LINK_ERROR_PATH }
}

/**
 * The `callbackURL` for `authClient.signIn.email`. Better Auth uses it twice:
 * the client follows it after a successful sign-in. It must pass post-signin,
 * or a first sign-in skips onboarding. The callback is not decoded before
 * redirecting, so `next` is encoded once. Unconfirmed accounts request a
 * verification resend separately.
 */
export function signInCallbackURL(callbackUrl: string | null | undefined) {
  const next = safeRedirectPath(callbackUrl)

  return next === "/"
    ? POST_SIGNIN_PATH
    : `${POST_SIGNIN_PATH}?next=${encodeURIComponent(next)}`
}

/** "Check your inbox" after sign-up; also explains a failed confirmation link. */
export const VERIFY_EMAIL_PATH = "/auth/verify-email-sent"

/**
 * What the confirmation page shows (`?state=`): the email just went out after
 * sign-up, or after signing in to an unconfirmed account, or the link failed.
 */
export const VERIFY_EMAIL_STATES = [
  "sent",
  "unverified",
  "expired",
  "invalid",
] as const

export type VerifyEmailState = (typeof VERIFY_EMAIL_STATES)[number]

export function parseVerifyEmailState(value: unknown): VerifyEmailState {
  return VERIFY_EMAIL_STATES.find((state) => state === value) ?? "sent"
}

/**
 * A failed confirmation link comes back to its callback (post-signin) with
 * `?error=`: `token_expired`, `invalid_token` or `user_not_found`. Returns the
 * confirmation page that explains it, or null when there's no error.
 */
export function verifyLinkErrorPath(error: string | null | undefined) {
  if (!error) return null
  const state: VerifyEmailState =
    error === "token_expired" ? "expired" : "invalid"

  return `${VERIFY_EMAIL_PATH}?state=${state}`
}
