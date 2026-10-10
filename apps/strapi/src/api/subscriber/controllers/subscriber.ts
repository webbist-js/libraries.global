/**
 * subscriber controller
 *
 * Collection and export require the UI's service secret. Beta requests and
 * newsletter consent are stored separately, with account attribution only
 * for newsletters. Core CRUD routes are not exposed.
 */

import { factories } from "@strapi/strapi"

import {
  bridgeBaUserId,
  isValidServiceSecret,
} from "../../../utils/service-secret"
import { subscriberRateLimiter } from "../rate-limit"

const SUBSCRIBER = "api::subscriber.subscriber"
const MAX_EMAIL_LENGTH = 254
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Allow collection fields only; identity and consent evidence are server-written. */
function emailOf(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null
  const keys = Object.keys(body)
  if (keys.some((key) => !["email", "type", "source", "locale"].includes(key)))
    return null
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

    const type = ctx.request.body.type ?? "newsletter"
    if (!["beta_waitlist", "newsletter"].includes(type))
      return ctx.badRequest("Invalid subscriber type")
    const source =
      type === "beta_waitlist"
        ? "beta_landing"
        : (ctx.request.body.source ?? "footer")
    if (
      !["beta_landing", "footer", "journal"].includes(source) ||
      (type === "newsletter" && source === "beta_landing")
    )
      return ctx.badRequest("Invalid source")
    const locale = ctx.request.body.locale ?? "en"
    if (!["en", "cs"].includes(locale)) return ctx.badRequest("Invalid locale")
    const baUserId =
      type === "newsletter" &&
      headers["x-ba-user-email"]?.toLowerCase() === email
        ? bridgeBaUserId(ctx)
        : null

    if (!subscriberRateLimiter.take(clientIp(ctx))) {
      ctx.set?.("Retry-After", "3600")

      return ctx.tooManyRequests(
        "Too many sign-ups from this address; try later"
      )
    }

    const filters = { email: { $eqi: email }, type }
    // Prefer a record with consent over a held legacy duplicate.
    const existing =
      (await strapi.documents(SUBSCRIBER).findFirst({
        filters: { ...filters, consentedAt: { $notNull: true } } as never,
      })) ??
      (await strapi
        .documents(SUBSCRIBER)
        .findFirst({ filters: filters as never }))
    if (!existing) {
      try {
        await strapi.documents(SUBSCRIBER).create({
          data: {
            email,
            type,
            source,
            state: "active",
            communicationLocale: locale,
            baUserId,
            consentedAt: new Date().toISOString(),
            consentVersion: `${type}-${source}-2026-10-10`,
            message:
              type === "beta_waitlist"
                ? "Requested beta access only. No newsletter."
                : source === "journal"
                  ? "Agreed to receive new Journal articles by email, at most monthly."
                  : `Signed up via the website footer on ${new Date().toISOString()}`,
          } as never,
        })
      } catch (error: any) {
        if (error?.code !== "23505" && error?.cause?.code !== "23505")
          throw error
        // A concurrent collection already saved this purpose. Other write failures propagate.
      }
    } else if (
      !existing.consentedAt &&
      existing.state !== "unsubscribed" &&
      existing.state !== "suppressed"
    ) {
      // This explicit submission supplies new consent; the old message remains evidence.
      try {
        await strapi.documents(SUBSCRIBER).update({
          documentId: existing.documentId,
          data: {
            type,
            source,
            state: "active",
            communicationLocale: locale,
            baUserId,
            consentedAt: new Date().toISOString(),
            consentVersion: `${type}-${source}-2026-10-10`,
          } as never,
        })
      } catch (error: any) {
        if (error?.code !== "23505" && error?.cause?.code !== "23505")
          throw error
      }
    } else if (baUserId && existing.state === "active" && !existing.baUserId) {
      await strapi.documents(SUBSCRIBER).update({
        documentId: existing.documentId,
        data: { baUserId } as never,
      })
    }

    // The same answer whether or not the address was already known.
    return ctx.send({ ok: true })
  },
  async export(ctx: any) {
    if (!isValidServiceSecret(ctx.request?.headers?.["x-service-secret"]))
      return ctx.unauthorized("Invalid service secret")
    ctx.set?.("Cache-Control", "private, no-store")
    const type = ctx.query?.type
    if (!["beta_waitlist", "newsletter"].includes(type))
      return ctx.badRequest("Choose a subscriber type")
    const page = Math.max(
      1,
      Math.min(10000, Math.floor(Number(ctx.query.page) || 1))
    )
    const rows = await strapi.documents(SUBSCRIBER).findMany({
      filters: {
        type,
        state: "active",
        consentedAt: { $notNull: true },
        ...(type === "beta_waitlist" ? { invitedAt: { $null: true } } : {}),
      } as never,
      // documentId is an implicit Strapi field omitted from schema sort types.
      sort: ["createdAt:asc", "documentId:asc"] as never,
      start: (page - 1) * 500,
      limit: 500,
    })

    return ctx.send({
      data: rows.map((row) => ({
        email: row.email,
        type: row.type,
        locale: row.communicationLocale,
        consentedAt: row.consentedAt,
        consentVersion: row.consentVersion,
        documentId: row.documentId,
      })),
    })
  },
}))
