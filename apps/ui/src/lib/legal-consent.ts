/**
 * The version of the terms of use and privacy notice a new account agrees to,
 * as the date they were published. Every sign-up path sends it, and the server
 * refuses to create an account without it, then records it with the time of
 * acceptance. Bump it when a legal document changes in a way people must
 * re-accept.
 */
export const TERMS_VERSION = "2026-09-27"

/** Shown next to every way of creating an account. */
export const MINIMUM_ACCOUNT_AGE = 18
