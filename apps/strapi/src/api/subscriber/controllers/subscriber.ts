/**
 * subscriber controller
 *
 * `POST /subscribers` is the newsletter sign-up. Only the UI's
 * `/api/newsletter` route calls it (with the bridge secret and the client's
 * address in `X-Forwarded-For`); it accepts exactly `{ email }`, dedupes
 * case-insensitively, writes the `message` itself and limits sign-ups per
 * client IP. The core create/update/delete routes are not exposed.
 */

import { factories } from "@strapi/strapi"

import { isValidServiceSecret } from "../../../utils/service-secret"
import { subscriberRateLimiter } from "../rate-limit"

const SUBSCRIBER = "api::subscriber.subscriber"
const MAX_EMAIL_LENGTH = 254
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** The email from a body that is exactly `{ email: string }`, else null. */
function emailOf(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null
  const keys = Object.keys(body)
  if (keys.length !== 1 || keys[0] !== "email") return null
  const raw = (body as { email?: unknown }).email
  if (typeof raw !== "string") return null
  const email = raw.trim().toLowerCase()
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return null
  if (!EMAIL.test(email)) return null

  return email
}

/**
 * The client address. `X-Forwarded-For` is trusted here because the bridge
 * secret proves the request came from the UI server, which sets it to the
 * browser's address; the first entry is the originating client.
 */
function clientIp(ctx: any): string {
  const headers = ctx.request?.headers ?? ctx.request?.header ?? {}
  const forwarded = headers["x-forwarded-for"]
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(",")[0]
    ?.trim()

  return first || ctx.request?.ip || "unknown"
}

export default factories.createCoreController(SUBSCRIBER, ({ strapi }) => ({
  async subscribe(ctx: any) {
    const headers = ctx.request?.headers ?? ctx.request?.header ?? {}
    if (!isValidServiceSecret(headers["x-service-secret"])) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const email = emailOf(ctx.request?.body)
    if (!email)
      return ctx.badRequest("Body must be { email } with a valid address")

    if (!subscriberRateLimiter.take(clientIp(ctx))) {
      return ctx.tooManyRequests(
        "Too many sign-ups from this address; try later"
      )
    }

    const existing = await strapi
      .documents(SUBSCRIBER)
      .findFirst({ filters: { email: { $eqi: email } } as never })
    if (!existing) {
      await strapi.documents(SUBSCRIBER).create({
        data: {
          email,
          message: `Signed up via the website footer on ${new Date().toISOString()}`,
        } as never,
      })
    }

    // The same answer whether or not the address was already known.
    return ctx.send({ ok: true })
  },
}))
