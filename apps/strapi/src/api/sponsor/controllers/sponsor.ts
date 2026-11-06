import { factories } from "@strapi/strapi"

const SPONSOR = "api::sponsor.sponsor"

/** Hard ceiling for the public list; the client cannot raise it. */
export const ACKNOWLEDGEMENT_LIMIT = 100
/** Display order: founding first, bespoke agreements last. */
export const SPONSOR_TIERS = [
  "founding",
  "service",
  "community",
  "custom",
] as const
export type SponsorTier = (typeof SPONSOR_TIERS)[number]

type SponsorRow = {
  organisationName?: string | null
  tier?: string | null
  website?: string | null
  acknowledgement?: string | null
  logo?: {
    url?: string | null
    alternativeText?: string | null
    width?: number | null
    height?: number | null
  } | null
}

export type SponsorAcknowledgement = {
  name: string
  tier: SponsorTier
  website: string | null
  acknowledgement: string | null
  logo: {
    url: string
    alternativeText: string | null
    width: number | null
    height: number | null
  } | null
}

/** Only absolute http(s) links without embedded credentials are served. */
export function publicWebsite(value: unknown): string | null {
  if (typeof value !== "string") return null
  const raw = value.trim()
  if (!raw || raw.length > 500) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    if (url.username || url.password) return null

    return url.toString()
  } catch {
    return null
  }
}

const dimension = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null

export function projectAcknowledgement(
  row: SponsorRow,
  tier: SponsorTier
): SponsorAcknowledgement | null {
  const name =
    typeof row.organisationName === "string" ? row.organisationName.trim() : ""
  if (!name) return null
  const text =
    typeof row.acknowledgement === "string"
      ? row.acknowledgement.trim().slice(0, 500)
      : ""
  const logoUrl = typeof row.logo?.url === "string" ? row.logo.url : ""

  return {
    name,
    tier,
    website: publicWebsite(row.website),
    acknowledgement: text || null,
    logo: logoUrl
      ? {
          url: logoUrl,
          alternativeText:
            typeof row.logo?.alternativeText === "string"
              ? row.logo.alternativeText
              : null,
          width: dimension(row.logo?.width),
          height: dimension(row.logo?.height),
        }
      : null,
  }
}

/** A calendar date in UTC, matching Strapi's `date` attribute format. */
const isoDate = (now: Date) => now.toISOString().slice(0, 10)

export default factories.createCoreController(SPONSOR, ({ strapi }) => ({
  /**
   * Published sponsors who consented to recognition and whose term covers
   * today. One bounded read per tier keeps the tier order exact without
   * loading more than the ceiling.
   */
  async acknowledgements(ctx) {
    const today = isoDate(new Date())
    const data: SponsorAcknowledgement[] = []
    for (const tier of SPONSOR_TIERS) {
      const remaining = ACKNOWLEDGEMENT_LIMIT - data.length
      if (remaining <= 0) break
      const rows = (await strapi.documents(SPONSOR).findMany({
        status: "published",
        filters: {
          tier: { $eq: tier },
          recognitionConsent: { $eq: true },
          $and: [
            {
              $or: [
                { termStart: { $null: true } },
                { termStart: { $lte: today } },
              ],
            },
            {
              $or: [{ termEnd: { $null: true } }, { termEnd: { $gte: today } }],
            },
          ],
        },
        fields: ["organisationName", "tier", "website", "acknowledgement"],
        populate: {
          logo: { fields: ["url", "alternativeText", "width", "height"] },
        },
        sort: ["organisationName:asc", "id:asc"],
        limit: remaining,
      } as never)) as unknown as SponsorRow[]
      for (const row of rows.slice(0, remaining)) {
        const item = projectAcknowledgement(row, tier)
        if (item) data.push(item)
      }
    }

    ctx.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600")
    ctx.body = { data, meta: { limit: ACKNOWLEDGEMENT_LIMIT } }
  },
}))
