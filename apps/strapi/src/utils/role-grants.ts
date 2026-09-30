import {
  GRANTABLE_ROLES,
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

const MIGRATION_STORE = { type: "core", name: "role-grants" } as const
const MIGRATION_KEY = "role-grants-migrated-v1"
const MIGRATION_PAGE = 200
const INVALIDATE_TIMEOUT_MS = 3000

export type RoleGrantRow = RoleGrant & {
  documentId: string
  baUserId: string
  source: "admin" | "claim" | "application" | "migration"
  grantedBy: string | null
  reason: string | null
  expiresAt: string | null
}

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
    fields: ["role", "queue", "locale", "expiresAt"],
    sort: ["createdAt:asc", "id:asc"],
    limit: MAX_ACTIVE_GRANTS,
  })) as { role?: unknown; queue?: unknown; locale?: unknown }[]

  return rows.flatMap((row): RoleGrant[] => {
    if (!isGrantableRole(row.role)) return []
    const queue = row.queue ?? "all"
    if (!isQueue(queue)) return []

    return [{ role: row.role, queue, locale: normaliseLocale(row.locale) }]
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
      locale: locale === null ? { $null: true } : { $eq: locale },
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
      locale,
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

/** Grants for one legacy profile; true when at least one was created. */
async function migrateProfile(
  strapi: any,
  profile: {
    baUserId?: string | null
    contributorRole?: string | null
    isVerifiedLibrarian?: boolean | null
  }
): Promise<boolean> {
  if (!profile.baUserId || !isGrantableRole(profile.contributorRole))
    return false
  const roles: GrantableRole[] = [profile.contributorRole]
  if (
    profile.isVerifiedLibrarian &&
    profile.contributorRole !== "verified_librarian"
  )
    roles.push("verified_librarian")

  let createdAny = false
  for (const role of roles) {
    const { created } = await createGrant(strapi, {
      baUserId: profile.baUserId,
      role,
      source: "migration",
      reason: "Backfilled from user-profile.contributorRole",
    })
    createdAny ||= created
  }

  return createdAny
}

/**
 * One-off backfill: a global grant for every profile whose legacy
 * `contributorRole` is above reader, plus a `verified_librarian` grant where
 * the profile is flagged verified under a higher role (otherwise the derived
 * `isVerifiedLibrarian` would drop). Guarded by a core-store flag, and
 * idempotent anyway through `createGrant`.
 */
export async function migrateContributorRolesToGrants(
  strapi: any
): Promise<{ migrated: number }> {
  const store = strapi.store(MIGRATION_STORE)
  if (await store.get({ key: MIGRATION_KEY })) return { migrated: 0 }

  let migrated = 0
  for (let start = 0; ; start += MIGRATION_PAGE) {
    const profiles = (await strapi.documents(PROFILE).findMany({
      filters: { contributorRole: { $in: [...GRANTABLE_ROLES] } },
      fields: ["baUserId", "contributorRole", "isVerifiedLibrarian"],
      sort: "id:asc",
      start,
      limit: MIGRATION_PAGE,
    })) as {
      baUserId?: string | null
      contributorRole?: string | null
      isVerifiedLibrarian?: boolean | null
    }[]

    for (const profile of profiles) {
      if (await migrateProfile(strapi, profile)) migrated += 1
    }
    if (profiles.length < MIGRATION_PAGE) break
  }

  await store.set({
    key: MIGRATION_KEY,
    value: { migratedAt: new Date().toISOString(), migrated },
  })
  strapi.log.info(`[role-grants] Backfilled grants for ${migrated} profiles`)

  return { migrated }
}

/**
 * Tells the Next app to drop its cached session profile for this user, so a
 * role change shows within one request rather than the 60 s TTL. Best
 * effort: skipped without config, logs and returns on any failure.
 */
export async function notifySessionInvalidated(
  strapi: any,
  baUserId: string
): Promise<void> {
  const base = process.env.APP_PUBLIC_URL
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!base || !secret) return

  try {
    const res = await fetch(
      new URL("/api/internal/session/invalidate", base).toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Secret": secret,
        },
        body: JSON.stringify({ baUserId }),
        signal: AbortSignal.timeout(INVALIDATE_TIMEOUT_MS),
      }
    )
    if (!res.ok)
      strapi.log.warn(
        `[role-grants] Session invalidation returned ${res.status}`
      )
  } catch (err) {
    strapi.log.warn("[role-grants] Session invalidation failed:", err)
  }
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
  for (let start = 0; ; start += MIGRATION_PAGE) {
    const rows = (await strapi.documents(ROLE_GRANT as any).findMany({
      filters: {
        $and: [
          { expiresAt: { $gte: since.toISOString() } },
          { expiresAt: { $lte: now.toISOString() } },
        ],
      },
      fields: ["baUserId"],
      sort: "id:asc",
      start,
      limit: MIGRATION_PAGE,
    })) as { baUserId?: string | null }[]
    for (const row of rows) if (row.baUserId) users.add(row.baUserId)
    if (rows.length < MIGRATION_PAGE) break
  }

  for (const baUserId of users) {
    try {
      await syncDerivedRole(strapi, baUserId)
      void notifySessionInvalidated(strapi, baUserId)
    } catch (err) {
      strapi.log.warn(`[role-grants] Resync failed for ${baUserId}:`, err)
    }
  }

  return { users: users.size }
}
