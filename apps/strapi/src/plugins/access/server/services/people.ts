import {
  type GrantableRole,
  highestRole,
  isGrantableRole,
  MODERATION_QUEUES,
  type RoleGrant,
} from "@repo/access"

import {
  createGrant,
  MAX_ACTIVE_GRANTS,
  ROLE_GRANT,
} from "../../../../utils/role-grants"
import { acceptedCount } from "../../../content-moderation/server/services/submission-policy"
import { configuredLocales } from "../../../content-moderation/server/utils/locales"
import { summaryOf } from "../../../content-moderation/server/utils/submission-summary"

/**
 * The People page of the access plugin: find a contributor, see their Role
 * Grants (active, expired and revoked), grant a role and revoke one. Admin
 * routes only, behind `plugin::access.manage-roles`.
 *
 * A user-profile is not linked to a users-permissions user or a Better Auth
 * user in Strapi, so the email shown and searched is the one the person's
 * submissions were filed with (stamped from their session by the bridge).
 * Revoking never deletes: it ends the grant now and appends who revoked it,
 * when and why to its `reason`, so the history stays.
 */

const PROFILE = "api::user-profile.user-profile"
const SUBMISSION = "plugin::content-moderation.submission"

export const PEOPLE_MAX = 25
export const REASON_MAX = 500
const Q_MAX = 100
const GRANTS_HISTORY_MAX = 200
const EMAIL_ROWS_MAX = 500
const OPEN_APPLICATIONS_MAX = 20
const REVOKED_MARKER = "Revoked by "

/** Roles a grant may scope to one language. */
const LOCALE_ROLES: ReadonlySet<string> = new Set([
  "moderator",
  "wiki_editor",
  "journal_editor",
])
const GRANT_QUEUES: ReadonlySet<string> = new Set(["all", ...MODERATION_QUEUES])

/** Better Auth ids: URL-safe, bounded. */
const BA_USER_ID = /^[A-Za-z0-9_-]{1,128}$/

export function isBaUserId(v: unknown): v is string {
  return typeof v === "string" && BA_USER_ID.test(v)
}

export type GrantStatus = "active" | "expired" | "revoked"

export type PersonRow = {
  baUserId: string
  documentId: string
  username: string | null
  displayName: string | null
  email: string | null
  contributorRole: string
  activeGrants: number
}

export type GrantRow = {
  documentId: string
  role: string
  queue: string
  locale: string | null
  source: string | null
  grantedBy: string | null
  reason: string | null
  expiresAt: string | null
  createdAt: string | null
  status: GrantStatus
}

type ProfileRow = {
  documentId: string
  baUserId?: string | null
  username?: string | null
  firstName?: string | null
  lastName?: string | null
}

type StoredGrant = {
  documentId: string
  baUserId?: string | null
  role?: string | null
  queue?: string | null
  scopeLocale?: string | null
  source?: string | null
  grantedBy?: string | null
  reason?: string | null
  expiresAt?: string | null
  createdAt?: string | null
}

const PROFILE_FIELDS = [
  "documentId",
  "baUserId",
  "username",
  "firstName",
  "lastName",
]

const clean = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null

function displayNameOf(p: ProfileRow): string | null {
  return clean([p.firstName, p.lastName].filter(Boolean).join(" "))
}

const isUnexpired = (g: StoredGrant, now: Date) =>
  !g.expiresAt || new Date(g.expiresAt).getTime() > now.getTime()

export function grantStatus(
  g: StoredGrant,
  now: Date = new Date()
): GrantStatus {
  if (isUnexpired(g, now)) return "active"

  return (g.reason ?? "").includes(REVOKED_MARKER) ? "revoked" : "expired"
}

/** Stored grants as RoleGrants, dropping any this code doesn't know. */
function toRoleGrants(rows: StoredGrant[]): RoleGrant[] {
  return rows.flatMap((g): RoleGrant[] => {
    if (!isGrantableRole(g.role)) return []
    const queue = g.queue ?? "all"
    if (!GRANT_QUEUES.has(queue)) return []

    return [
      {
        role: g.role,
        queue: queue as RoleGrant["queue"],
        locale: clean(g.scopeLocale),
      },
    ]
  })
}

const unexpiredFilter = (now: Date) => ({
  $or: [
    { expiresAt: { $null: true } },
    { expiresAt: { $gt: now.toISOString() } },
  ],
})

export type GrantInput = {
  role: GrantableRole
  queue: RoleGrant["queue"]
  locale: string | null
  reason: string
  expiresAt: string | null
}

/**
 * Checks an admin's grant request: a grantable role; a queue only for a
 * Moderator (default every queue); a configured language only for a
 * Moderator or an editor (none = any language); a reason of 1–500
 * characters; an optional expiry in the future.
 */
export function parseGrantInput(
  body: unknown,
  locales: readonly string[],
  now: Date = new Date()
): { ok: true; value: GrantInput } | { ok: false; message: string } {
  if (!body || typeof body !== "object" || Array.isArray(body))
    return { ok: false, message: "Expected a role to grant." }
  const b = body as Record<string, unknown>
  if (!isGrantableRole(b.role))
    return { ok: false, message: "Choose a role to grant." }
  const role = b.role

  const rawQueue = b.queue ?? null
  let queue: RoleGrant["queue"] = "all"
  if (rawQueue !== null && rawQueue !== "") {
    if (role !== "moderator")
      return { ok: false, message: "Only moderator roles take a queue." }
    if (typeof rawQueue !== "string" || !GRANT_QUEUES.has(rawQueue))
      return { ok: false, message: "Choose a queue from the list." }
    queue = rawQueue as RoleGrant["queue"]
  }

  const rawLocale = b.scopeLocale ?? null
  let locale: string | null = null
  if (rawLocale !== null && rawLocale !== "") {
    if (!LOCALE_ROLES.has(role))
      return {
        ok: false,
        message:
          "Only moderator, Knowledge editor and Journal editor roles take a language.",
      }
    if (typeof rawLocale !== "string" || !locales.includes(rawLocale))
      return { ok: false, message: "Choose a language from the list." }
    locale = rawLocale
  }

  const reason = typeof b.reason === "string" ? b.reason.trim() : ""
  if (!reason) return { ok: false, message: "Say why you're granting it." }
  if (reason.length > REASON_MAX)
    return {
      ok: false,
      message: `Keep the reason to ${REASON_MAX} characters or fewer.`,
    }

  let expiresAt: string | null = null
  if (b.expiresAt !== undefined && b.expiresAt !== null && b.expiresAt !== "") {
    const at =
      typeof b.expiresAt === "string"
        ? new Date(b.expiresAt)
        : new Date(Number.NaN)
    if (Number.isNaN(at.getTime()))
      return { ok: false, message: "The expiry must be a date." }
    if (at.getTime() <= now.getTime())
      return { ok: false, message: "The expiry must be in the future." }
    expiresAt = at.toISOString()
  }

  return { ok: true, value: { role, queue, locale, reason, expiresAt } }
}

/** A revocation reason: required, 1–500 characters. */
export function parseRevokeReason(
  body: unknown
): { ok: true; value: string } | { ok: false; message: string } {
  const b =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {}
  const reason = typeof b.reason === "string" ? b.reason.trim() : ""
  if (!reason) return { ok: false, message: "Say why you're revoking it." }
  if (reason.length > REASON_MAX)
    return {
      ok: false,
      message: `Keep the reason to ${REASON_MAX} characters or fewer.`,
    }

  return { ok: true, value: reason }
}

export default ({ strapi }: { strapi: any }) => {
  const profiles = () => strapi.documents(PROFILE)
  const grants = () => strapi.documents(ROLE_GRANT as any)
  const submissions = () => strapi.documents(SUBMISSION)

  /** The latest email each user's submissions were filed with. */
  async function emailsOf(ids: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    if (ids.length === 0) return out
    const rows = (await submissions().findMany({
      filters: { submittedByUserId: { $in: ids } },
      fields: ["submittedByUserId", "submittedByEmail"],
      sort: [{ createdAt: "desc" }, { id: "desc" }],
      limit: EMAIL_ROWS_MAX,
    })) as { submittedByUserId?: string; submittedByEmail?: string }[]
    for (const r of rows) {
      const email = clean(r.submittedByEmail)
      if (r.submittedByUserId && email && !out.has(r.submittedByUserId))
        out.set(r.submittedByUserId, email)
    }

    return out
  }

  /** Each user's unexpired grants. */
  async function activeGrantsOf(
    ids: string[]
  ): Promise<Map<string, RoleGrant[]>> {
    const out = new Map<string, RoleGrant[]>()
    if (ids.length === 0) return out
    const rows = (await grants().findMany({
      filters: { baUserId: { $in: ids }, ...unexpiredFilter(new Date()) },
      fields: ["baUserId", "role", "queue", "scopeLocale"],
      sort: [{ createdAt: "asc" }, { id: "asc" }],
      limit: ids.length * MAX_ACTIVE_GRANTS,
    })) as StoredGrant[]
    for (const r of rows) {
      if (!r.baUserId) continue
      const list = out.get(r.baUserId) ?? []
      list.push(...toRoleGrants([r]))
      out.set(r.baUserId, list)
    }

    return out
  }

  async function toRows(found: ProfileRow[]): Promise<PersonRow[]> {
    const ids = found.flatMap((p) => (p.baUserId ? [p.baUserId] : []))
    const [emails, held] = await Promise.all([
      emailsOf(ids),
      activeGrantsOf(ids),
    ])

    return found.flatMap((p): PersonRow[] => {
      if (!p.baUserId) return []
      const active = held.get(p.baUserId) ?? []

      return [
        {
          baUserId: p.baUserId,
          documentId: p.documentId,
          username: clean(p.username),
          displayName: displayNameOf(p),
          email: emails.get(p.baUserId) ?? null,
          contributorRole: highestRole(active),
          activeGrants: active.length,
        },
      ]
    })
  }

  async function profileOf(baUserId: string): Promise<ProfileRow | null> {
    const [p] = (await profiles().findMany({
      filters: { baUserId: { $eq: baUserId } },
      fields: [...PROFILE_FIELDS, "contributorRole", "isVerifiedLibrarian"],
      limit: 1,
    })) as ProfileRow[]

    return p ?? null
  }

  return {
    /**
     * The Better Auth id whose submissions were last filed from `email`, or
     * null. Plans and Teams accept an email where an admin has no id.
     */
    async baUserIdByEmail(email: string): Promise<string | null> {
      const needle = email.trim().toLowerCase()
      if (!needle || needle.length > 254) return null
      const rows = (await submissions().findMany({
        filters: { submittedByEmail: { $eqi: needle } },
        fields: ["submittedByUserId"],
        sort: [{ createdAt: "desc" }, { id: "desc" }],
        limit: 1,
      })) as { submittedByUserId?: string }[]

      return rows[0]?.submittedByUserId ?? null
    },

    /** The profile row for a Better Auth id, or null. */
    async profile(baUserId: string): Promise<ProfileRow | null> {
      return profileOf(baUserId)
    },

    /** Display names for several Better Auth ids (one query). */
    async namesOf(ids: string[]): Promise<Map<string, string>> {
      const out = new Map<string, string>()
      const unique = [...new Set(ids.filter(Boolean))]
      if (unique.length === 0) return out
      const rows = (await profiles().findMany({
        filters: { baUserId: { $in: unique } },
        fields: PROFILE_FIELDS,
        limit: unique.length,
      })) as ProfileRow[]
      for (const p of rows)
        if (p.baUserId)
          out.set(
            p.baUserId,
            displayNameOf(p) ?? (p.username ? `@${p.username}` : p.baUserId)
          )

      return out
    },

    /**
     * Up to 25 people. With `q`: every word must match a username, first or
     * last name, and profiles whose submissions were filed from a matching
     * email are added. Without: the people who most recently got a role.
     */
    async search(q: string): Promise<PersonRow[]> {
      const query = q.trim().slice(0, Q_MAX)
      let found: ProfileRow[]
      if (!query) {
        const recent = (await grants().findMany({
          filters: unexpiredFilter(new Date()),
          fields: ["baUserId"],
          sort: [{ createdAt: "desc" }, { id: "desc" }],
          limit: PEOPLE_MAX * 8,
        })) as StoredGrant[]
        const ids = [
          ...new Set(recent.flatMap((g) => (g.baUserId ? [g.baUserId] : []))),
        ].slice(0, PEOPLE_MAX)
        if (ids.length === 0) return []
        const rows = (await profiles().findMany({
          filters: { baUserId: { $in: ids } },
          fields: PROFILE_FIELDS,
          limit: PEOPLE_MAX,
        })) as ProfileRow[]
        const order = new Map(ids.map((id, i) => [id, i]))
        found = rows.sort(
          (a, b) =>
            (order.get(a.baUserId ?? "") ?? 0) -
            (order.get(b.baUserId ?? "") ?? 0)
        )
      } else {
        const words = query.split(/\s+/).filter(Boolean).slice(0, 5)
        const byName = (await profiles().findMany({
          filters: {
            $and: words.map((w) => ({
              $or: ["username", "firstName", "lastName"].map((k) => ({
                [k]: { $containsi: w },
              })),
            })),
          },
          fields: PROFILE_FIELDS,
          sort: [{ username: "asc" }, { id: "asc" }],
          limit: PEOPLE_MAX,
        })) as ProfileRow[]

        let byEmail: ProfileRow[] = []
        if (byName.length < PEOPLE_MAX && query.length >= 3) {
          const rows = (await submissions().findMany({
            filters: { submittedByEmail: { $containsi: query } },
            fields: ["submittedByUserId"],
            sort: [{ createdAt: "desc" }, { id: "desc" }],
            limit: EMAIL_ROWS_MAX,
          })) as { submittedByUserId?: string }[]
          const seen = new Set(byName.map((p) => p.baUserId))
          const ids = [
            ...new Set(
              rows.flatMap((r) =>
                r.submittedByUserId && !seen.has(r.submittedByUserId)
                  ? [r.submittedByUserId]
                  : []
              )
            ),
          ].slice(0, PEOPLE_MAX - byName.length)
          if (ids.length > 0)
            byEmail = (await profiles().findMany({
              filters: { baUserId: { $in: ids } },
              fields: PROFILE_FIELDS,
              limit: ids.length,
            })) as ProfileRow[]
        }
        found = [...byName, ...byEmail].slice(0, PEOPLE_MAX)
      }

      return toRows(found)
    },

    /**
     * One person: profile, every grant (newest first, with its status),
     * accepted-submission count, open Role Applications and the configured
     * languages the Add role form offers. Null when there is no profile.
     */
    async person(baUserId: string) {
      const profile = (await profileOf(baUserId)) as
        | (ProfileRow & {
            contributorRole?: string | null
            isVerifiedLibrarian?: boolean | null
          })
        | null
      if (!profile) return null
      const now = new Date()

      const [rows, emails, accepted, open, locales] = await Promise.all([
        grants().findMany({
          filters: { baUserId: { $eq: baUserId } },
          fields: [
            "documentId",
            "role",
            "queue",
            "scopeLocale",
            "source",
            "grantedBy",
            "reason",
            "expiresAt",
            "createdAt",
          ],
          sort: [{ createdAt: "desc" }, { id: "desc" }],
          limit: GRANTS_HISTORY_MAX,
        }) as Promise<StoredGrant[]>,
        emailsOf([baUserId]),
        acceptedCount(strapi, baUserId),
        submissions().findMany({
          filters: {
            submittedByUserId: { $eq: baUserId },
            submissionType: { $eq: "role_application" },
            status: { $in: ["pending", "needs_info"] },
          },
          fields: [
            "documentId",
            "status",
            "submissionType",
            "fields",
            "createdAt",
          ],
          sort: [{ createdAt: "desc" }, { id: "desc" }],
          limit: OPEN_APPLICATIONS_MAX,
        }) as Promise<Record<string, any>[]>,
        configuredLocales(strapi),
      ])

      const grantRows: GrantRow[] = rows.map((g) => ({
        documentId: g.documentId,
        role: String(g.role ?? ""),
        queue: g.queue ?? "all",
        locale: clean(g.scopeLocale),
        source: g.source ?? null,
        grantedBy: g.grantedBy ?? null,
        reason: g.reason ?? null,
        expiresAt: g.expiresAt ?? null,
        createdAt: g.createdAt ?? null,
        status: grantStatus(g, now),
      }))
      const active = toRoleGrants(rows.filter((g) => isUnexpired(g, now)))

      return {
        baUserId,
        documentId: profile.documentId,
        username: clean(profile.username),
        displayName: displayNameOf(profile),
        email: emails.get(baUserId) ?? null,
        contributorRole: highestRole(active),
        isVerifiedLibrarian: active.some(
          (g) => g.role === "verified_librarian"
        ),
        acceptedCount: accepted,
        grants: grantRows,
        openApplications: open.map((s) => ({
          documentId: String(s.documentId),
          status: String(s.status),
          summary: summaryOf(s as any),
          createdAt: s.createdAt ?? null,
        })),
        locales,
      }
    },

    /**
     * Grants a role from the admin. `exists` when the person already holds
     * an unexpired grant with the same role, queue and language.
     */
    async grant(
      baUserId: string,
      input: GrantInput,
      adminId: string | number
    ): Promise<
      | { ok: true; documentId: string }
      | { ok: false; error: "no_profile" | "exists" }
    > {
      if (!(await profileOf(baUserId)))
        return { ok: false, error: "no_profile" }
      const { documentId, created } = await createGrant(strapi, {
        baUserId,
        role: input.role,
        queue: input.queue,
        locale: input.locale,
        source: "admin",
        grantedBy: `admin:${adminId}`,
        reason: input.reason,
        expiresAt: input.expiresAt,
      })

      return created ? { ok: true, documentId } : { ok: false, error: "exists" }
    },

    /**
     * Ends a grant now. The row stays: `reason` gains "Revoked by
     * admin:<id> on <ISO date>: <reason>". The role-grant lifecycle
     * re-derives the holder's role and refreshes their session.
     */
    async revoke(
      documentId: string,
      reason: string,
      adminId: string | number
    ): Promise<
      | { ok: true; baUserId: string | null }
      | { ok: false; error: "not_found" | "ended" }
    > {
      const g = (await grants().findOne({
        documentId,
        fields: ["documentId", "baUserId", "reason", "expiresAt"],
      })) as StoredGrant | null
      if (!g) return { ok: false, error: "not_found" }
      const now = new Date()
      if (!isUnexpired(g, now)) return { ok: false, error: "ended" }
      const line = `${REVOKED_MARKER}admin:${adminId} on ${now.toISOString()}: ${reason}`
      await grants().update({
        documentId,
        data: {
          expiresAt: now.toISOString(),
          reason: g.reason ? `${g.reason}\n${line}` : line,
        },
      })

      return { ok: true, baUserId: g.baUserId ?? null }
    },
  }
}
