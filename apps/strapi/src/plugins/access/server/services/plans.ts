import { notifySessionInvalidated } from "../../../../utils/role-grants"
import { AccessError, isBaUserId, isEmail } from "../utils/admin"

/**
 * Plans: complimentary plans (`entitlement-grant`) and Pro verifications
 * (`pro-verification`), created and revoked by an admin with a reason. Both
 * collections are admin-only (`routes: []`); this is the only code path
 * that writes them besides the Content Manager. Revoking never deletes: it
 * ends the row now and appends who revoked it, when and why, so the
 * history stays. Nothing here touches a Role Grant: money never buys trust.
 */

const ENTITLEMENT_GRANT = "api::entitlement-grant.entitlement-grant"
const PRO_VERIFICATION = "api::pro-verification.pro-verification"
const PROFILE = "api::user-profile.user-profile"

export const LIST_MAX = 100
const REVOKED_MARKER = "Revoked by "

export const PLAN_KEYS = ["supporter", "pro", "team"] as const
export const GRANT_SOURCES = [
  "admin",
  "press",
  "partner",
  "team",
  "grant_funder",
] as const
export const VERIFICATION_KINDS = [
  "library_staff",
  "student",
  "charity",
] as const

export type PlanGrantRow = {
  documentId: string
  baUserId: string
  name: string | null
  plan: string
  source: string | null
  reason: string | null
  grantedBy: string | null
  expiresAt: string | null
  createdAt: string | null
  status: "active" | "expired" | "revoked"
}

export type VerificationRow = {
  documentId: string
  baUserId: string
  name: string | null
  kind: string
  verifiedEmail: string | null
  verifiedAt: string | null
  expiresAt: string | null
  createdAt: string | null
  status: "active" | "expired" | "revoked"
}

const isUnexpired = (expiresAt: string | null | undefined, now: Date) =>
  !expiresAt || new Date(expiresAt).getTime() > now.getTime()

function statusOf(
  row: {
    expiresAt?: string | null
    reason?: string | null
    revokedNote?: string | null
  },
  now: Date
): "active" | "expired" | "revoked" {
  if (isUnexpired(row.expiresAt, now)) return "active"

  return (row.reason ?? row.revokedNote ?? "").includes(REVOKED_MARKER)
    ? "revoked"
    : "expired"
}

export default ({ strapi }: { strapi: any }) => {
  const grants = () => strapi.documents(ENTITLEMENT_GRANT as any)
  const verifications = () => strapi.documents(PRO_VERIFICATION as any)
  const people = () => strapi.plugin("access").service("people")

  /**
   * A person from an admin's reference: a Better Auth id with a profile,
   * or an email their submissions were filed from. 404 otherwise.
   */
  async function resolvePerson(ref: unknown): Promise<string> {
    if (
      isBaUserId(ref) &&
      !String(ref).includes("@") &&
      (await people().profile(ref))
    )
      return ref
    if (isEmail(ref)) {
      const id = await people().baUserIdByEmail(ref)
      if (id && (await people().profile(id))) return id
    }
    throw new AccessError(
      404,
      "no_profile",
      "No profile for that id or email. The person needs to have signed in and, for an email, sent a submission."
    )
  }

  async function withNames<T extends { baUserId: string }>(
    rows: T[]
  ): Promise<(T & { name: string | null })[]> {
    const names = await people().namesOf(rows.map((r) => r.baUserId))

    return rows.map((r) => ({ ...r, name: names.get(r.baUserId) ?? null }))
  }

  return {
    async listGrants(q = ""): Promise<PlanGrantRow[]> {
      const now = new Date()
      const query = q.trim()
      const ids = query
        ? [
            ...(isBaUserId(query) && !query.includes("@") ? [query] : []),
            ...(isEmail(query)
              ? [await people().baUserIdByEmail(query)].filter(Boolean)
              : []),
          ]
        : []
      if (query && ids.length === 0) return []
      const rows = (await grants().findMany({
        filters: ids.length ? { baUserId: { $in: ids } } : {},
        fields: [
          "documentId",
          "baUserId",
          "plan",
          "source",
          "reason",
          "grantedBy",
          "expiresAt",
          "createdAt",
        ],
        sort: [{ createdAt: "desc" }, { id: "desc" }],
        limit: LIST_MAX,
      })) as any[]

      return withNames(
        rows.map((r) => ({
          documentId: r.documentId,
          baUserId: String(r.baUserId ?? ""),
          plan: String(r.plan ?? "pro"),
          source: r.source ?? null,
          reason: r.reason ?? null,
          grantedBy: r.grantedBy ?? null,
          expiresAt: r.expiresAt ?? null,
          createdAt: r.createdAt ?? null,
          status: statusOf(r, now),
        }))
      )
    },

    async createGrant(
      input: {
        person: unknown
        plan: unknown
        source?: unknown
        reason: string
        expiresAt: string | null
      },
      adminId: string | number
    ): Promise<PlanGrantRow> {
      const baUserId = await resolvePerson(input.person)
      if (!(PLAN_KEYS as readonly unknown[]).includes(input.plan))
        throw new AccessError(
          400,
          "invalid_plan",
          "Choose supporter, pro or team."
        )
      const source =
        input.source === undefined ||
        input.source === null ||
        input.source === ""
          ? "admin"
          : input.source
      if (!(GRANT_SOURCES as readonly unknown[]).includes(source))
        throw new AccessError(
          400,
          "invalid_source",
          "Choose a source from the list."
        )
      const row = (await grants().create({
        data: {
          baUserId,
          plan: input.plan,
          source,
          reason: input.reason,
          expiresAt: input.expiresAt,
          grantedBy: `admin:${adminId}`,
        },
      })) as any
      await notifySessionInvalidated(strapi, baUserId)
      strapi.log.info(
        `[access] admin:${adminId} granted plan ${String(input.plan)} to ${baUserId}`
      )
      const [withName] = await withNames([
        {
          documentId: row.documentId,
          baUserId,
          plan: String(input.plan),
          source: String(source),
          reason: input.reason,
          grantedBy: `admin:${adminId}`,
          expiresAt: input.expiresAt,
          createdAt: row.createdAt ?? null,
          status: "active" as const,
        },
      ])

      return withName
    },

    async revokeGrant(
      documentId: string,
      reason: string,
      adminId: string | number
    ): Promise<void> {
      const row = (await grants().findOne({
        documentId,
        fields: ["documentId", "baUserId", "reason", "expiresAt"],
      })) as any
      if (!row) throw new AccessError(404, "not_found", "Grant not found.")
      const now = new Date()
      if (!isUnexpired(row.expiresAt, now))
        throw new AccessError(409, "ended", "This grant has already ended.")
      const line = `${REVOKED_MARKER}admin:${adminId} on ${now.toISOString()}: ${reason}`
      await grants().update({
        documentId,
        data: {
          expiresAt: now.toISOString(),
          reason: row.reason ? `${row.reason}\n${line}` : line,
        },
      })
      if (row.baUserId) await notifySessionInvalidated(strapi, row.baUserId)
      strapi.log.info(
        `[access] admin:${adminId} revoked plan grant ${documentId}`
      )
    },

    async listVerifications(q = ""): Promise<VerificationRow[]> {
      const now = new Date()
      const query = q.trim()
      const ids = query
        ? [
            ...(isBaUserId(query) && !query.includes("@") ? [query] : []),
            ...(isEmail(query)
              ? [await people().baUserIdByEmail(query)].filter(Boolean)
              : []),
          ]
        : []
      const rows = (await verifications().findMany({
        filters: ids.length
          ? { baUserId: { $in: ids } }
          : query && isEmail(query)
            ? { verifiedEmail: { $eqi: query } }
            : query
              ? { baUserId: { $eq: "__none__" } }
              : {},
        fields: [
          "documentId",
          "baUserId",
          "kind",
          "verifiedEmail",
          "verifiedAt",
          "expiresAt",
          "createdAt",
        ],
        sort: [{ createdAt: "desc" }, { id: "desc" }],
        limit: LIST_MAX,
      })) as any[]

      return withNames(
        rows.map((r) => ({
          documentId: r.documentId,
          baUserId: String(r.baUserId ?? ""),
          kind: String(r.kind ?? ""),
          verifiedEmail: r.verifiedEmail ?? null,
          verifiedAt: r.verifiedAt ?? null,
          expiresAt: r.expiresAt ?? null,
          createdAt: r.createdAt ?? null,
          status: statusOf({ expiresAt: r.expiresAt, reason: null }, now),
        }))
      )
    },

    async createVerification(
      input: {
        person: unknown
        kind: unknown
        verifiedEmail?: unknown
        expiresAt: string | null
      },
      adminId: string | number
    ): Promise<VerificationRow> {
      const baUserId = await resolvePerson(input.person)
      if (!(VERIFICATION_KINDS as readonly unknown[]).includes(input.kind))
        throw new AccessError(
          400,
          "invalid_kind",
          "Choose a verification kind."
        )
      const verifiedEmail =
        typeof input.verifiedEmail === "string" && input.verifiedEmail.trim()
          ? input.verifiedEmail.trim().toLowerCase()
          : isEmail(input.person)
            ? String(input.person).trim().toLowerCase()
            : null
      if (verifiedEmail && !isEmail(verifiedEmail))
        throw new AccessError(
          400,
          "invalid_email",
          "The verified email is not valid."
        )
      const row = (await verifications().create({
        data: {
          baUserId,
          kind: input.kind,
          verifiedEmail,
          verifiedAt: new Date().toISOString(),
          expiresAt: input.expiresAt,
        },
      })) as any
      await notifySessionInvalidated(strapi, baUserId)
      strapi.log.info(
        `[access] admin:${adminId} verified ${baUserId} as ${String(input.kind)}`
      )
      const [withName] = await withNames([
        {
          documentId: row.documentId,
          baUserId,
          kind: String(input.kind),
          verifiedEmail,
          verifiedAt: row.verifiedAt ?? null,
          expiresAt: input.expiresAt,
          createdAt: row.createdAt ?? null,
          status: "active" as const,
        },
      ])

      return withName
    },

    /**
     * Ends a verification now. The collection has no reason field, so the
     * reason is logged and the row's expiry is set; the person's session
     * refreshes within the minute.
     */
    async revokeVerification(
      documentId: string,
      reason: string,
      adminId: string | number
    ): Promise<void> {
      const row = (await verifications().findOne({
        documentId,
        fields: ["documentId", "baUserId", "expiresAt"],
      })) as any
      if (!row)
        throw new AccessError(404, "not_found", "Verification not found.")
      const now = new Date()
      if (!isUnexpired(row.expiresAt, now))
        throw new AccessError(
          409,
          "ended",
          "This verification has already ended."
        )
      await verifications().update({
        documentId,
        data: { expiresAt: now.toISOString() },
      })
      if (row.baUserId) await notifySessionInvalidated(strapi, row.baUserId)
      strapi.log.info(
        `[access] admin:${adminId} revoked verification ${documentId}: ${reason}`
      )
    },

    /** Does a profile exist for this id (used by the admin UI's lookups). */
    async hasProfile(baUserId: string): Promise<boolean> {
      const [row] = (await strapi.documents(PROFILE).findMany({
        filters: { baUserId: { $eq: baUserId } },
        fields: ["documentId"],
        limit: 1,
      })) as { documentId: string }[]

      return !!row
    },
  }
}
