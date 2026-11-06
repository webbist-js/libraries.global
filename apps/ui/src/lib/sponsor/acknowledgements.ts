/** Display order, matching GET /api/sponsors/acknowledgements. */
export const SPONSOR_TIERS = [
  "founding",
  "service",
  "community",
  "custom",
] as const
export type SponsorTier = (typeof SPONSOR_TIERS)[number]

/** The public cap the CMS route enforces; the page never shows more. */
export const SPONSOR_ACKNOWLEDGEMENT_LIMIT = 100

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

/** "unavailable" means the CMS could not be read, not that nobody is listed. */
export type SponsorAcknowledgements =
  | { status: "ok"; sponsors: SponsorAcknowledgement[] }
  | { status: "unavailable"; sponsors: [] }

const isTier = (value: unknown): value is SponsorTier =>
  SPONSOR_TIERS.includes(value as SponsorTier)

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null

/** Absolute http(s) only: a CMS value never becomes a script or relative link. */
export function sponsorWebsite(value: unknown): string | null {
  const raw = text(value, 500)
  if (!raw) return null
  try {
    const url = new URL(raw)

    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
      ? url.toString()
      : null
  } catch {
    return null
  }
}

const size = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : null

/** Re-validates the CMS payload: unknown rows are dropped, never rendered. */
export function normaliseSponsorAcknowledgements(
  payload: unknown
): SponsorAcknowledgement[] {
  const rows = (payload as { data?: unknown } | null)?.data
  if (!Array.isArray(rows)) return []

  return rows.slice(0, SPONSOR_ACKNOWLEDGEMENT_LIMIT).flatMap((row) => {
    const value = row as Record<string, unknown> | null
    const name = text(value?.name, 160)
    if (!name || !isTier(value?.tier)) return []
    const logo = value?.logo as Record<string, unknown> | null | undefined
    const logoUrl =
      typeof logo?.url === "string" &&
      (logo.url.startsWith("/uploads/") || logo.url.startsWith("https://"))
        ? logo.url
        : null

    return [
      {
        name,
        tier: value.tier,
        website: sponsorWebsite(value.website),
        acknowledgement: text(value.acknowledgement, 500),
        logo: logoUrl
          ? {
              url: logoUrl,
              alternativeText: text(logo?.alternativeText, 300),
              width: size(logo?.width),
              height: size(logo?.height),
            }
          : null,
      },
    ]
  })
}

/** Whole pounds in the reader's locale, always with "£" (not "£GB"). Used for the API price note. */
export function formatSponsorAmount(pence: number, locale: string) {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : locale, {
    style: "currency",
    currency: "GBP",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(pence / 100)
}
