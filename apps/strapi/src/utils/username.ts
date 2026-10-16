const RESERVED = new Set([
  "admin",
  "administrator",
  "moderator",
  "support",
  "staff",
  "librariesglobal",
  "system",
  "root",
  "api",
  "settings",
  "profile",
  "deleted",
])

export function isValidUsername(u: unknown): u is string {
  return (
    typeof u === "string" &&
    /^[a-z0-9_]{3,30}$/.test(u) &&
    !RESERVED.has(u) &&
    !u.startsWith("deleted-")
  )
}

const PG_CLIENTS = new Set(["pg", "postgres", "postgresql"])
const PROFILE = "api::user-profile.user-profile"

/** The sequence the hot-path indexes migration creates and seeds (E1). */
export const CONTRIBUTOR_NUMBER_SEQUENCE =
  "user_profiles_contributor_number_seq"

/** The highest contributor number in use, plus one (1 when there is none). */
async function maxPlusOne(strapi: any): Promise<number> {
  const [top] = (await strapi.db.query(PROFILE).findMany({
    select: ["contributorNumber"],
    where: { contributorNumber: { $notNull: true } },
    orderBy: { contributorNumber: "desc" },
    limit: 1,
  })) as { contributorNumber?: number | null }[]

  return (top?.contributorNumber ?? 0) + 1
}

/**
 * The next `contributorNumber` for a new profile. `count() + 1` let two
 * concurrent sign-ups (or a gap left by an erased account) share a number;
 * on Postgres this draws from a sequence, elsewhere it is max + 1. If the
 * sequence is missing (the migration hasn't run) it warns and falls back.
 */
export async function nextContributorNumber(strapi: any): Promise<number> {
  const client = String(strapi.db?.dialect?.client ?? "").toLowerCase()
  if (PG_CLIENTS.has(client)) {
    try {
      const result = (await strapi.db.connection.raw(
        `SELECT nextval('${CONTRIBUTOR_NUMBER_SEQUENCE}') AS nextval`
      )) as { rows?: { nextval?: unknown }[] }
      const n = Number(result?.rows?.[0]?.nextval)
      if (Number.isInteger(n) && n > 0) return n
    } catch (err) {
      strapi.log.warn(
        `[profile] ${CONTRIBUTOR_NUMBER_SEQUENCE} unavailable; using max + 1:`,
        err
      )
    }
  }

  return maxPlusOne(strapi)
}
