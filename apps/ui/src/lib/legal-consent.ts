/**
 * The numbered version of the terms of use and privacy notice a new account
 * agrees to. Every sign-up path sends it. The server refuses to create an
 * account without it, then records it with the time of acceptance. Bump it
 * when a legal document changes in a way people must re-accept.
 */
export const TERMS_VERSION = "1.2"

/** Shown next to every way of creating an account. */
export const MINIMUM_ACCOUNT_AGE = 18
