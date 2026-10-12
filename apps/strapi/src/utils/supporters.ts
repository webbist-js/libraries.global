import {
  isSupporterPlan,
  TIER_NAMES,
  isPaidMembership,
  selectPaidMembership,
} from "@repo/access"
import {
  type SupporterEntry,
  type SupportersResponse,
  CONTINENT_COUNTRIES,
} from "@repo/shared-data"

const PROFILE = "api::user-profile.user-profile"
const PAGE_SIZE = 24
const BATCH_SIZE = 500

/** Internal reads are paginated; no public endpoint exposes the source rows. */
async function readAll(
  strapi: any,
  uid: string,
  query: Record<string, unknown>
) {
  const rows: any[] = []
  for (let start = 0; ; start += BATCH_SIZE) {
    const batch = await strapi.documents(uid).findMany({
      ...query,
      sort: "id:asc",
      start,
      limit: BATCH_SIZE,
    })
    rows.push(...batch)
    if (batch.length < BATCH_SIZE) return rows
  }
}

export function supporterListed(profile: any): boolean {
  return (
    profile.profileVisibility === "public" && profile.supporterListed !== false
  )
}

/** A paid/complimentary plan changes recognition, never the person's trust. */
export async function supporterMark(
  strapi: any,
  profile: any
): Promise<boolean> {
  if (!profile.baUserId || profile.supporterBadgeVisible === false) return false
  const { resolveUserEntitlements } = await import("./entitlement-inputs")
  const entitlements = await resolveUserEntitlements(strapi, profile.baUserId)

  return isSupporterPlan(entitlements.plan)
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

/** Directory and aggregates share the session resolver's active-plan rules. */
export async function readSupporters(
  strapi: any,
  query: {
    q?: unknown
    country?: unknown
    region?: unknown
    sort?: unknown
    page?: unknown
  } = {},
  now = new Date()
): Promise<SupportersResponse> {
  const unexpired = {
    $or: [
      { expiresAt: { $null: true } },
      { expiresAt: { $gt: now.toISOString() } },
    ],
  }
  const [grants, verifications, members, earned, config, paid] =
    await Promise.all([
      readAll(strapi, "api::entitlement-grant.entitlement-grant", {
        filters: {
          $and: [unexpired, { plan: { $in: ["supporter", "pro", "team"] } }],
        },
        fields: ["baUserId", "plan", "createdAt"],
      }),
      readAll(strapi, "api::pro-verification.pro-verification", {
        filters: unexpired,
        fields: ["baUserId", "verifiedAt", "createdAt"],
      }),
      readAll(strapi, "plugin::access.team-member", {
        filters: { status: "active", team: { status: "active" } },
        fields: ["baUserId", "acceptedAt"],
        populate: { team: { fields: ["status", "expiresAt"] } },
      }),
      readAll(strapi, PROFILE, {
        filters: {
          $or: [
            {
              tier: { $in: TIER_NAMES.slice(TIER_NAMES.indexOf("Archivist")) },
            },
            { earnedProUntil: { $gt: now.toISOString() } },
          ],
        },
        fields: ["baUserId"],
      }),
      strapi.documents("api::site-config.site-config").findFirst({}),
      readAll(strapi, "api::paid-membership.paid-membership", {
        fields: ["baUserId", "membership"],
      }),
    ])

  // Each person counts once, even with several grants or Team seats.
  const eligible = new Map<string, string | null>()
  for (const row of paid) {
    if (
      row.baUserId &&
      isPaidMembership(row.membership) &&
      row.membership.mode ===
        (process.env.BILLING_ENV === "live" ? "live" : "sandbox") &&
      selectPaidMembership([row.membership], now)
    )
      eligible.set(row.baUserId, row.membership.memberSince)
  }
  const activeMembers = members.filter(
    (m) =>
      m.team?.status === "active" &&
      (m.team.expiresAt == null || Date.parse(m.team.expiresAt) > now.getTime())
  )
  for (const row of [
    ...grants,
    ...verifications,
    ...activeMembers,
    ...earned,
  ]) {
    if (!row.baUserId) continue
    const date = row.acceptedAt ?? row.verifiedAt ?? row.createdAt ?? null
    const since = date && Number.isFinite(Date.parse(date)) ? date : null
    const prior = eligible.get(row.baUserId)
    eligible.set(
      row.baUserId,
      prior && (!since || prior < since) ? prior : since
    )
  }
  const ids = [...eligible.keys()]
  const profiles: any[] = []
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    profiles.push(
      ...(await readAll(strapi, PROFILE, {
        filters: { baUserId: { $in: ids.slice(start, start + BATCH_SIZE) } },
        fields: [
          "baUserId",
          "username",
          "firstName",
          "lastName",
          "city",
          "country",
          "profileVisibility",
          "publicPrefs",
          "supporterListed",
        ],
      }))
    )
  }

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
        since: eligible.get(p.baUserId) ?? null,
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
  filtered.sort((a, b) => {
    if (query.sort === "name")
      return (
        a.displayName.localeCompare(b.displayName) ||
        a.username.localeCompare(b.username)
      )
    if (a.since !== b.since) {
      if (!a.since) return 1
      if (!b.since) return -1

      return query.sort === "newest"
        ? b.since.localeCompare(a.since)
        : a.since.localeCompare(b.since)
    }

    return a.username.localeCompare(b.username)
  })
  const requested = Number(query.page)
  const page = Math.min(
    Math.max(1, Number.isSafeInteger(requested) ? requested : 1),
    Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  )
  const runningCosts = numberOrNull(config?.monthlyRunningCosts)

  return {
    entries: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    newThisMonth: filtered
      .filter(
        (p) =>
          p.since &&
          p.since.slice(0, 7) === now.toISOString().slice(0, 7) &&
          Date.parse(p.since) <= now.getTime()
      )
      .sort(
        (a, b) =>
          b.since!.localeCompare(a.since!) ||
          a.username.localeCompare(b.username)
      )
      .slice(0, 4),
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
