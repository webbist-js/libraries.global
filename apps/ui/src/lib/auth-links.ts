// apps/ui/src/lib/auth-links.ts
//
// What the auth emails are called and how long their links work. The email
// sender, the Better Auth config and the "check your inbox" pages all read
// these, so a page never describes a subject line or an expiry the email
// doesn't have.

import { SITE_NAME } from "./constants"

/** Email confirmation links (Better Auth `emailVerification.expiresIn`). */
export const VERIFICATION_LINK_TTL_SECONDS = 60 * 60
export const VERIFICATION_EMAIL_SUBJECT = `Confirm your ${SITE_NAME} email address`

/** Password reset links (`emailAndPassword.resetPasswordTokenExpiresIn`). */
export const RESET_LINK_TTL_SECONDS = 60 * 60
export const RESET_EMAIL_SUBJECT = `Reset your ${SITE_NAME} password`

/** Sign-in links (the magicLink plugin's `expiresIn`). */
export const MAGIC_LINK_TTL_SECONDS = 5 * 60
export const MAGIC_LINK_EMAIL_SUBJECT = `Your ${SITE_NAME} sign-in link`

/** A link lifetime in words: "one hour", "2 hours", "5 minutes". */
export function linkLifetime(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) {
    const hours = seconds / 3600

    return hours === 1 ? "one hour" : `${hours} hours`
  }
  const minutes = Math.max(1, Math.round(seconds / 60))

  return minutes === 1 ? "one minute" : `${minutes} minutes`
}
