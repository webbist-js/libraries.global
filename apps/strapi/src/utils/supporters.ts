import { has, SUPPORTER_MIN_ACCEPTED } from "@repo/access"
import {
  type SupporterEntry,
  type SupportersResponse,
  CONTINENT_COUNTRIES,
} from "@repo/shared-data"

const PROFILE = "api::user-profile.user-profile"
const PAGE_SIZE = 24
const BATCH_SIZE = 500

/** Most Supporters the directory reads; keyset pages of BATCH_SIZE. */
export const SUPPORTERS_MAX = 10_000

const PROFILE_FIELDS = [
  "baUserId",
  "username",
  "firstName",
  "lastName",
  "city",
  "country",
  "profileVisibility",
  "publicPrefs",
  "supporterListed",
]

/**
 * Supporter profiles (earned recognition: at least SUPPORTER_MIN_ACCEPTED
 * accepted contributions, not revoked), read by bounded keyset pages on id.
 */
async function readSupporterProfiles(strapi: any): Promise<any[]> {
  const rows: any[] = []
  let after = 0
  while (rows.length < SUPPORTERS_MAX) {
    const batch = (await strapi.documents(PROFILE).findMany({
      filters: {
        id: { $gt: after },
        acceptedContributions: { $gte: SUPPORTER_MIN_ACCEPTED },
        recognitionRevokedAt: { $null: true },
      },
      fields: PROFILE_FIELDS,
      sort: "id:asc",
      limit: Math.min(BATCH_SIZE, SUPPORTERS_MAX - rows.length),
    })) as any[]
    rows.push(...batch)
    if (batch.length < BATCH_SIZE) break
    after = Number(batch.at(-1).id)
  }

  return rows
}

export function supporterListed(profile: any): boolean {
  return (
    profile.profileVisibility === "public" && profile.supporterListed !== false
  )
}

/** Earned Supporter recognition marks a profile; it never adds trust. */
export async function supporterMark(
  strapi: any,
  profile: any
): Promise<boolean> {
  if (!profile.baUserId || profile.supporterBadgeVisible === false) return false
  const { resolveUserEntitlements } = await import("./entitlement-inputs")
  const entitlements = await resolveUserEntitlements(strapi, profile.baUserId)

  return has(entitlements, "supporter")
}

const numberOrNull = (value: unknown): number | null => {
  if (value == null || value === "") return null
  const n = Number(value)

  return Number.isFinite(n) && n >= 0 ? n : null
}

function countryName(code: string | null): string | null {
  if (!code) return null
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region" }).of(
        code.toUpperCase()
      ) ?? code
    )
  } catch {
    return code
  }
}

/** Directory and aggregates share the session resolver's recognition rule. */
export async function readSupporters(
  strapi: any,
  query: {
    q?: unknown
    country?: unknown
    region?: unknown
    sort?: unknown
    page?: unknown
  } = {}
): Promise<SupportersResponse> {
  const [profiles, config] = await Promise.all([
    readSupporterProfiles(strapi),
    strapi.documents("api::site-config.site-config").findFirst({}),
  ])
  // Explicit projection: no private names, account ids, grants, plans or
  // hidden locations can be searched or serialized, even for the owner.
  const listed: SupporterEntry[] = profiles
    .filter((p) => supporterListed(p) && p.username)
    .map((p) => {
      const showLocation = p.publicPrefs?.showLocation !== false

      return {
        username: p.username,
        displayName:
          [p.firstName, p.lastName].filter(Boolean).join(" ") || p.username,
        initials:
          ((p.firstName?.[0] ?? "") + (p.lastName?.[0] ?? "")).toUpperCase() ||
          p.username.slice(0, 2).toUpperCase(),
        city: showLocation ? (p.city ?? null) : null,
        country: showLocation ? (p.country ?? null) : null,
      }
    })
  const q =
    typeof query.q === "string"
      ? query.q.trim().slice(0, 100).toLowerCase()
      : ""
  const country =
    typeof query.country === "string" ? query.country.slice(0, 100) : ""
  const regionCountries =
    query.region === "americas"
      ? [
          ...CONTINENT_COUNTRIES["north-america"]!,
          ...CONTINENT_COUNTRIES["south-america"]!,
        ]
      : typeof query.region === "string"
        ? CONTINENT_COUNTRIES[query.region]
        : undefined
  const filtered = listed.filter(
    (p) =>
      (!country || p.country === country) &&
      (!regionCountries ||
        (p.country != null &&
          regionCountries.includes(p.country.toUpperCase()))) &&
      (!q ||
        [p.displayName, p.username, p.city, p.country, countryName(p.country)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q))
  )
  // Recognition records no date it was reached, so the directory is by name.
  filtered.sort(
    (a, b) =>
      a.displayName.localeCompare(b.displayName) ||
      a.username.localeCompare(b.username)
  )
  const requested = Number(query.page)
  const page = Math.min(
    Math.max(1, Number.isSafeInteger(requested) ? requested : 1),
    Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  )
  const runningCosts = numberOrNull(config?.monthlyRunningCosts)

  return {
    entries: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: profiles.length,
    listed: listed.length,
    unlisted: profiles.length - listed.length,
    countries: [
      ...new Set(listed.flatMap((p) => (p.country ? [p.country] : []))),
    ].sort(),
    matched: filtered.length,
    page,
    pageSize: PAGE_SIZE,
    costs:
      config?.costMonth && runningCosts != null
        ? {
            month: config.costMonth,
            currency: config.costCurrency ?? "GBP",
            runningCosts,
            supportIncome: numberOrNull(config.monthlySupportIncome),
            breakdown: config.costBreakdown ?? null,
          }
        : null,
    title: config?.supportersTitle ?? null,
    lead: config?.supportersLead ?? null,
  }
}
