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
