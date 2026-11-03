import {
  type GrantableRole,
  highestRole,
  isGrantableRole,
  MODERATION_QUEUES,
  type RoleGrant,
} from "@repo/access"

export const ROLE_GRANT = "api::role-grant.role-grant"
const PROFILE = "api::user-profile.user-profile"

/** Most Role Grants one user carries into a session or a policy check. */
export const MAX_ACTIVE_GRANTS = 50

const GRANT_PAGE = 200

export type RoleGrantRow = RoleGrant & {
  documentId: string
  baUserId: string
  source: "admin" | "claim" | "application" | "migration" | "team"
  grantedBy: string | null
  reason: string | null
  expiresAt: string | null
}

/**
 * `RoleGrant.locale` is stored as `scopeLocale`: `locale` is a reserved
 * Strapi attribute (i18n overwrites it as private on every content type).
 */
const QUEUES: ReadonlySet<string> = new Set(["all", ...MODERATION_QUEUES])

const isQueue = (v: unknown): v is RoleGrant["queue"] =>
  typeof v === "string" && QUEUES.has(v)

/** `null`, `undefined` and `""` all mean "every locale". */
const normaliseLocale = (locale: unknown): string | null =>
  typeof locale === "string" && locale.length > 0 ? locale : null

/** Unexpired at `now`: no expiry, or one still in the future. */
const unexpiredFilter = (now: Date) => ({
  $or: [
    { expiresAt: { $null: true } },
    { expiresAt: { $gt: now.toISOString() } },
  ],
})

/**
 * The user's unexpired Role Grants, oldest first, at most 50. Rows with a
 * role or queue this code does not know are dropped rather than trusted.
 */
export async function activeGrants(
  strapi: any,
  baUserId: string,
  now: Date = new Date()
): Promise<RoleGrant[]> {
  const rows = (await strapi.documents(ROLE_GRANT as any).findMany({
    filters: { baUserId: { $eq: baUserId }, ...unexpiredFilter(now) },
    fields: ["role", "queue", "scopeLocale", "expiresAt"],
    sort: ["createdAt:asc", "id:asc"],
    limit: MAX_ACTIVE_GRANTS,
  })) as { role?: unknown; queue?: unknown; scopeLocale?: unknown }[]

  return rows.flatMap((row): RoleGrant[] => {
    if (!isGrantableRole(row.role)) return []
    const queue = row.queue ?? "all"
    if (!isQueue(queue)) return []

    return [{ role: row.role, queue, locale: normaliseLocale(row.scopeLocale) }]
  })
}

/**
 * Creates a Role Grant unless the user already holds an unexpired one with
 * the same role, queue and locale. An expired grant does not count: granting
 * again after expiry creates a fresh row.
 */
export async function createGrant(
  strapi: any,
  input: {
    baUserId: string
    role: GrantableRole
    queue?: RoleGrant["queue"]
    locale?: string | null
    source: RoleGrantRow["source"]
    grantedBy?: string | null
    reason?: string | null
    expiresAt?: string | null
  }
): Promise<{ documentId: string; created: boolean }> {
  const queue = input.queue ?? "all"
  const locale = normaliseLocale(input.locale)

  const [existing] = (await strapi.documents(ROLE_GRANT as any).findMany({
    filters: {
      baUserId: { $eq: input.baUserId },
      role: { $eq: input.role },
      queue: { $eq: queue },
      scopeLocale: locale === null ? { $null: true } : { $eq: locale },
      ...unexpiredFilter(new Date()),
    },
    fields: ["documentId"],
    sort: "id:asc",
    limit: 1,
  })) as { documentId: string }[]
  if (existing) return { documentId: existing.documentId, created: false }

  const created = (await strapi.documents(ROLE_GRANT as any).create({
    data: {
      baUserId: input.baUserId,
      role: input.role,
      queue,
      scopeLocale: locale,
      source: input.source,
      grantedBy: input.grantedBy ?? null,
      reason: input.reason ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  })) as { documentId: string }

  return { documentId: created.documentId, created: true }
}

/**
 * Writes the derived `contributorRole` (highest unexpired grant) and
 * `isVerifiedLibrarian` (holds a `verified_librarian` grant) to the user's
 * profile, only when either differs. The role-grant lifecycle is the only
 * caller that should need this.
 */
export async function syncDerivedRole(
  strapi: any,
  baUserId: string
): Promise<void> {
  const [profile] = (await strapi.documents(PROFILE).findMany({
    filters: { baUserId: { $eq: baUserId } },
    fields: ["documentId", "contributorRole", "isVerifiedLibrarian"],
    limit: 1,
  })) as {
    documentId: string
    contributorRole?: string | null
    isVerifiedLibrarian?: boolean | null
  }[]
  if (!profile) return

  const grants = await activeGrants(strapi, baUserId)
  const contributorRole = highestRole(grants)
  const isVerifiedLibrarian = grants.some(
    (g) => g.role === "verified_librarian"
  )
  if (
    profile.contributorRole === contributorRole &&
    !!profile.isVerifiedLibrarian === isVerifiedLibrarian
  )
    return

  await strapi.documents(PROFILE).update({
    documentId: profile.documentId,
    data: { contributorRole, isVerifiedLibrarian },
  })
}

/**
 * Daily: grants that expired in the last 48 hours fire no lifecycle, so
 * re-derive the role of every user who held one.
 */
export async function resyncExpiredRoleGrants(
  strapi: any,
  now: Date = new Date()
): Promise<{ users: number }> {
  const since = new Date(now.getTime() - 48 * 60 * 60 * 1000)
  const users = new Set<string>()
  const expired: { baUserId: string; documentId: string }[] = []
  for (let start = 0; ; start += GRANT_PAGE) {
    const rows = (await strapi.db.query(ROLE_GRANT).findMany({
      where: {
        $and: [
          { expiresAt: { $gte: since.toISOString() } },
          { expiresAt: { $lte: now.toISOString() } },
        ],
      },
      select: ["baUserId", "documentId"],
      orderBy: { id: "asc" },
      offset: start,
      limit: GRANT_PAGE,
    })) as { baUserId?: string | null; documentId: string }[]
    for (const row of rows)
      if (row.baUserId) {
        users.add(row.baUserId)
        expired.push({ baUserId: row.baUserId, documentId: row.documentId })
      }
    if (rows.length < GRANT_PAGE) break
  }

  for (const row of expired) {
    try {
      await strapi.service("api::notification.notification").enqueue({
        baUserId: row.baUserId,
        kind: "staff_update",
        eventKey: `role-expiry:${row.documentId}`,
        title: "A role grant has expired",
        body: "One of your time-limited project roles has expired. Other active grants still apply. Check your current permissions, or contact a project steward if you need the grant renewed.",
        href: "/contribute/membership",
        emailPreference: "transactional",
      })
    } catch (err) {
      strapi.log.warn("[role-grants] Expiry notification failed", err)
    }
  }

  for (const baUserId of users) {
    try {
      await syncDerivedRole(strapi, baUserId)
    } catch (err) {
      strapi.log.warn(`[role-grants] Resync failed for ${baUserId}:`, err)
    }
  }

  return { users: users.size }
}
