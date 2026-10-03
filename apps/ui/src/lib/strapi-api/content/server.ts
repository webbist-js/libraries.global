import "server-only"

import type { Data, UID } from "@repo/strapi-types"
import { draftMode } from "next/headers"
import type { Locale } from "next-intl"

import type { HomepageContinentSummary } from "@/components/home/homepage.types"
import {
  computeCompleteness,
  type OpeningTimesValue,
} from "@/components/library/library-page.helpers"
import { bridgeUserHeaders } from "@/lib/bridge-user-headers"
import { buildLibraryPath } from "@/lib/library-helpers"
import { logNonBlockingError } from "@/lib/logging"
import { routing } from "@/lib/navigation"
import { PublicStrapiClient } from "@/lib/strapi-api"
import type {
  APIResponse,
  APIResponseCollection,
  StrapiLocalization,
} from "@/types/api"
import type { CustomFetchOptions } from "@/types/general"

type PopulatedPageData = Data.ContentType<"api::page.page"> & {
  localizations?: StrapiLocalization[]
  seo?: Data.Component<"shared.seo"> | null
}

type PopulatedFeaturedLibraryData = Data.ContentType<"api::library.library"> & {
  heroImage?: Data.ContentType<"plugin::upload.file"> | null
  continent?: Data.ContentType<"api::continent.continent"> | null
  country?: Data.ContentType<"api::country.country"> | null
  region?: Data.ContentType<"api::region.region"> | null
}

export type { PopulatedFeaturedLibraryData }

type PopulatedHomepageData = Data.ContentType<"api::homepage.homepage"> & {
  featuredLibraries?: PopulatedFeaturedLibraryData[]
  featuredServices?: Data.ContentType<"api::service.service">[]
  localizations?: StrapiLocalization[]
  seo?: Data.Component<"shared.seo"> | null
}

type PopulatedFooterData = Data.ContentType<"api::footer.footer"> & {
  links?: Data.Component<"utilities.link">[]
  socialLinks?: Data.Component<"shared.social">[]
  sections?: Data.Component<"elements.footer-item">[]
}

// ------ Locale fallback

/** A fetch result, flagged when it's the default-locale stand-in. */
export type WithLocaleFallback<R> = R & { localeFallback: boolean }

/**
 * Fetch `locale`'s version; when it's missing and `locale` isn't the
 * default, fetch the default locale instead and set `localeFallback`, so a
 * page renders the original with a "Not yet translated" line instead of 404.
 */
async function withLocaleFallback<R extends { data?: unknown }>(
  locale: string,
  fetchIn: (locale: Locale) => Promise<R | undefined>,
  defaultLocale: string = routing.defaultLocale
): Promise<WithLocaleFallback<R> | undefined> {
  const res = await fetchIn(locale as Locale)
  if (res?.data || locale === defaultLocale)
    return res ? { ...res, localeFallback: false } : undefined
  const fallback = await fetchIn(defaultLocale as Locale)
  if (fallback?.data) return { ...fallback, localeFallback: true }

  return res ? { ...res, localeFallback: false } : undefined
}

// ------ Page fetching functions

export async function fetchPage(
  slug: string,
  locale: Locale,
  requestInit?: RequestInit,
  options?: CustomFetchOptions
) {
  const dm = await draftMode()

  try {
    return (await PublicStrapiClient.fetchOneBySlug(
      "api::page.page",
      slug,
      {
        locale,
        status: dm.isEnabled ? "draft" : "published",
      },
      requestInit,
      options
    )) as APIResponse<PopulatedPageData>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching page '${slug}' for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

export async function fetchAllPages(
  // eslint-disable-next-line @typescript-eslint/default-param-last
  uid: Extract<UID.ContentType, "api::page.page"> = "api::page.page",
  locale: Locale
) {
  try {
    return await PublicStrapiClient.fetchAll(uid, {
      locale,
      fields: ["slug", "locale", "updatedAt", "createdAt"],
      populate: {},
      status: "published",
    })
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching all pages for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return { data: [] }
  }
}

// ------ SEO fetching functions

export async function fetchSeo(
  // eslint-disable-next-line @typescript-eslint/default-param-last
  uid: Extract<UID.ContentType, "api::page.page"> = "api::page.page",
  slug: string | null,
  locale: Locale
) {
  try {
    return (await PublicStrapiClient.fetchOneBySlug(uid, slug, {
      locale,
    })) as APIResponse<PopulatedPageData>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching SEO for '${uid}' with slug '${slug}' for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

// ------ Homepage fetching functions

/** Editable homepage section copy (flat `homepage.*` components). */
const HOMEPAGE_SECTION_POPULATE = Object.fromEntries(
  [
    "journeysIntro",
    "journeys",
    "featuredIntro",
    "communityBand",
    "communitySteps",
    "tasksIntro",
    "atlasBand",
    "plansIntro",
    "coverageIntro",
    "stewardBand",
    "journalIntro",
    "finalCta",
    "finalBenefits",
    "openIntro",
    "openLinks",
  ].map((key) => [key, true])
)

export async function fetchHomepage(locale: Locale) {
  const dm = await draftMode()

  try {
    return (await PublicStrapiClient.fetchOne(
      "api::homepage.homepage",
      undefined,
      {
        locale,
        status: dm.isEnabled ? "draft" : "published",
        populate: {
          featuredLibraries: {
            // Only what the featured cards show, not whole library records.
            fields: [
              "name",
              "slug",
              "summary",
              "city",
              "libraryType",
              "openingTimes",
            ],
            populate: {
              heroImage: {
                fields: [
                  "url",
                  "alternativeText",
                  "width",
                  "height",
                  "formats",
                ],
              },
              continent: { fields: ["slug", "name"] },
              country: { fields: ["slug", "name"] },
              region: { fields: ["slug", "name"] },
            },
          },
          featuredServices: true,
          seo: true,
          ...HOMEPAGE_SECTION_POPULATE,
        },
      } as Parameters<typeof PublicStrapiClient.fetchOne>[2]
    )) as APIResponse<PopulatedHomepageData>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching homepage for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

export async function fetchHomepageContinents(locale: Locale) {
  const dm = await draftMode()

  try {
    return (await PublicStrapiClient.fetchAPI("/homepage/continents", {
      locale,
      status: dm.isEnabled ? "draft" : "published",
    })) as APIResponseCollection<HomepageContinentSummary>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching homepage continents for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

// ------ Library fetching functions

export type LibrarySeoData = {
  metaTitle?: string | null
  metaDescription?: string | null
  metaImage?: { url?: string | null } | null
  openGraph?: {
    ogTitle?: string | null
    ogDescription?: string | null
    ogImage?: { url?: string | null } | null
    ogUrl?: string | null
    ogType?: string | null
  } | null
  keywords?: string | null
  metaRobots?: string | null
  canonicalURL?: string | null
  structuredData?: Record<string, unknown> | null
}

export type PopulatedLibraryData = Data.ContentType<"api::library.library"> & {
  heroImage?: Data.ContentType<"plugin::upload.file"> | null
  continent?: Data.ContentType<"api::continent.continent"> | null
  country?: Data.ContentType<"api::country.country"> | null
  region?: Data.ContentType<"api::region.region"> | null
  area?: Data.ContentType<"api::area.area"> | null
  services?: Data.ContentType<"api::service.service">[]
  amenities?: Data.ContentType<"api::amenity.amenity">[]
  accessibility?: Data.ContentType<"api::accessibility.accessibility">[]
  seo?: LibrarySeoData | null
}

/** A library in `locale`, or the default-locale version flagged `localeFallback`. */
export async function fetchLibrary(slug: string, locale: Locale) {
  return withLocaleFallback(locale, (l) => fetchLibraryIn(slug, l))
}

async function fetchLibraryIn(slug: string, locale: Locale) {
  const dm = await draftMode()

  try {
    return (await PublicStrapiClient.fetchOneBySlug(
      "api::library.library",
      slug,
      {
        locale,
        status: dm.isEnabled ? "draft" : "published",
        populate: {
          heroImage: true,
          continent: true,
          country: true,
          region: true,
          area: true,
          services: { fields: ["name", "summary", "category", "icon"] },
          amenities: { fields: ["name", "summary", "category", "icon"] },
          accessibility: { fields: ["name", "summary", "category", "icon"] },
          seo: { populate: ["metaImage", "openGraph"] },
        },
      } as Parameters<typeof PublicStrapiClient.fetchOneBySlug>[2]
    )) as APIResponse<PopulatedLibraryData>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching library '${slug}' for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

type LibraryPathData = {
  slug: string
  locale?: string | null
  continent?: { slug: string } | null
  country?: { slug: string } | null
  region?: { slug: string } | null
}

/**
 * The paths of the featured ("pillar") libraries only: the set worth
 * prerendering at build time. Everything else renders on first request
 * (`dynamicParams = true`).
 */
export async function fetchFeaturedLibraryPaths(
  locale: Locale
): Promise<{ data: LibraryPathData[] }> {
  try {
    const result = await PublicStrapiClient.fetchAll("api::library.library", {
      locale,
      fields: ["slug", "locale"],
      filters: { featured: true },
      populate: {
        continent: { fields: ["slug"] },
        country: { fields: ["slug"] },
        region: { fields: ["slug"] },
      },
      status: "published",
    } as Parameters<typeof PublicStrapiClient.fetchAll>[1])

    return result as { data: LibraryPathData[] }
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching featured library paths for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return { data: [] }
  }
}

export async function fetchAllLibraries(
  locale: Locale
): Promise<{ data: LibraryPathData[] }> {
  try {
    const result = await PublicStrapiClient.fetchAll("api::library.library", {
      locale,
      fields: ["slug", "locale", "updatedAt"],
      populate: {
        continent: { fields: ["slug"] },
        country: { fields: ["slug"] },
        region: { fields: ["slug"] },
      },
      status: "published",
    } as Parameters<typeof PublicStrapiClient.fetchAll>[1])

    return result as { data: LibraryPathData[] }
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching all libraries for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return { data: [] }
  }
}

// ------ Continent fetching functions

// ── Shared component types ────────────────────────────────────────────────────

export type StatCard = {
  id?: number | null
  label: string
  value?: string | null
  icon?: string | null
  note?: string | null
  isComputed?: boolean | null
}

export type QuickLink = {
  id?: number | null
  label: string
  href: string
  icon?: IconHubValue | null
  description?: string | null
}

export type SpotlightCard = {
  id?: string | number | null
  eyebrow?: string | null
  title?: string | null
  summary?: string | null
  image?: { url?: string | null; alternativeText?: string | null } | null
  ctaLabel?: string | null
  ctaUrl?: string | null
  theme?: "default" | "heritage" | "digital" | "science" | "archive" | null
}

export type MapConfig = {
  centerLat?: number | null
  centerLng?: number | null
  defaultZoom?: number | null
  boundingBoxNE?: string | null
  boundingBoxSW?: string | null
  mapStyle?: "standard" | "satellite" | "topo" | null
}

export type IconHubValue = {
  iconData?: string | null // raw SVG path markup
  iconName?: string | null // iconify identifier, e.g. "mdi:book-open-variant"
  width?: number | null
  height?: number | null
  color?: string | null
}

export type HighlightCard = {
  id?: number | null
  eyebrow?: string | null
  title: string
  summary?: string | null
  icon?: IconHubValue | null
  ctaLabel?: string | null
  ctaUrl?: string | null
}

// ── Section component types (shared across continent/country/region) ──────────

export type EditorialBlock = {
  __component: "sections.editorial-block"
  id: number
  eyebrow?: string | null
  title: string
  body?: unknown
  image?: { url?: string | null; alternativeText?: string | null } | null
  imagePosition?: "left" | "right" | null
  primaryCtaLabel?: string | null
  primaryCtaUrl?: string | null
  secondaryCtaLabel?: string | null
  secondaryCtaUrl?: string | null
}

export type CtaBanner = {
  __component: "sections.cta-banner"
  id: number
  title: string
  subtitle?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
}

export type PageSection = EditorialBlock | CtaBanner

// ── Location page fields (shared across continent/country/region) ─────────────

/** Published-library count per `libraryType`, largest first (computed by Strapi). */
export type LibraryTypeCount = { type: string; count: number }

/**
 * Programmatic by default: copy and metadata are derived from data. These are
 * the only CMS-authored fields, and every one is optional.
 */
type LocationCmsFields = {
  /** Optional hand-written context (country/continent only). Rendered only when set. */
  about?: unknown
  /** Optional overrides for the generated title/description/image. */
  seo?: Data.Component<"shared.seo"> | null
  libraryTypeCounts?: LibraryTypeCount[]
}

// ── Child locations (computed by Strapi) ─────────────────────────────────────

export type LatLng = { lat: number; lng: number }

/** A country or region listed on its parent's page, with its library tally. */
export type LocationChildCount = {
  /** Published libraries in this child. */
  libraryCount?: number
  /** Its map centre, else the mean position of its libraries. */
  center?: LatLng | null
}

// ── Continent ─────────────────────────────────────────────────────────────────

export type PopulatedContinentData = Omit<
  Data.ContentType<"api::continent.continent">,
  "countries"
> & {
  quickLinks?: QuickLink[]
  libraryCount?: number
  regionCount?: number
  countries?: ({
    name: string
    slug: string
    capitalCity?: string | null
    iso2?: string | null
  } & LocationChildCount)[]
  featuredLibraries?: PopulatedFeaturedLibraryData[]
} & LocationCmsFields

// ── Country ───────────────────────────────────────────────────────────────────

export type PopulatedCountryData = Omit<
  Data.ContentType<"api::country.country">,
  "regions"
> & {
  heroImage?: Data.ContentType<"plugin::upload.file"> | null
  heroTagline?: string | null
  featured?: boolean | null
  continent?: { name: string; slug: string; code?: string | null } | null
  regions?: ({
    name: string
    slug: string
    summary?: string | null
    typeLabel?: string | null
  } & LocationChildCount)[]
  nationalLibrary?: {
    name: string
    slug: string
    summary?: string | null
    libraryType?: string | null
    operationalStatus?: string | null
    heroImage?: { url?: string | null; alternativeText?: string | null } | null
  } | null
  featuredLibraries?: PopulatedFeaturedLibraryData[]
  quickLinks?: QuickLink[]
  mapConfig?: MapConfig | null
  libraryCount?: number
  regionCount?: number
} & LocationCmsFields

// ── Region ────────────────────────────────────────────────────────────────────

export type AreaSummary = {
  name: string
  slug: string
  summary?: string | null
  typeLabel?: string | null
}

export type PopulatedRegionData = Omit<
  Data.ContentType<"api::region.region">,
  "libraries"
> & {
  heroImage?: Data.ContentType<"plugin::upload.file"> | null
  heroTagline?: string | null
  featured?: boolean | null
  continent?: { name: string; slug: string; code?: string | null } | null
  country?: {
    name: string
    slug: string
    capitalCity?: string | null
    regionTypeLabel?: string | null
    continent?: { name: string; slug: string; code?: string | null } | null
  } | null
  areas?: AreaSummary[]
  featuredLibraries?: PopulatedFeaturedLibraryData[]
  quickLinks?: QuickLink[]
  mapConfig?: MapConfig | null
  libraryCount?: number
  areaCount?: number
  /** Up to 100 of the region's libraries, featured first. */
  libraries?: RegionLibrary[]
  /** Map centre, else the mean position of its libraries. */
  center?: LatLng | null
  /** The other regions of its country, for the "Nearby" card. */
  siblings?: RegionSibling[]
} & LocationCmsFields

/** A library row on its region's page. */
export type RegionLibrary = {
  documentId: string
  name: string
  slug: string
  libraryType?: string | null
  city?: string | null
  district?: string | null
  summary?: string | null
  openingTimes?: OpeningTimesValue | null
  timezone?: string | null
  location?: {
    lat?: number | string | null
    lng?: number | string | null
  } | null
  website?: string | null
  phone?: string | null
  email?: string | null
  streetAddress?: string | null
  operationalStatus?: string | null
  featured?: boolean | null
  heroImage?: {
    url?: string | null
    alternativeText?: string | null
    formats?: { small?: { url?: string | null } | null } | null
  } | null
  accessibility?: { documentId: string }[] | null
  services?: { documentId: string }[] | null
  amenities?: { documentId: string }[] | null
}

export type RegionSibling = {
  name: string
  slug: string
  typeLabel?: string | null
  libraryCount: number
  center?: LatLng | null
}

// ── Area ──────────────────────────────────────────────────────────────────────

export type PopulatedAreaData = {
  id: number
  documentId: string
  name: string
  slug: string
  shortName?: string | null
  typeLabel?: string | null
  summary?: string | null
  mapConfig?: MapConfig | null
  region?: {
    name: string
    slug: string
    typeLabel?: string | null
    country?: {
      name: string
      slug: string
      regionTypeLabel?: string | null
      continent?: { name: string; slug: string; code?: string | null } | null
    } | null
  } | null
  country?: { name: string; slug: string } | null
  libraries?: {
    name: string
    slug: string
    summary?: string | null
    libraryType?: string | null
    operationalStatus?: string | null
    heroImage?: { url?: string | null; alternativeText?: string | null } | null
  }[]
  libraryCount?: number
  seo?: {
    metaTitle?: string | null
    metaDescription?: string | null
    metaImage?: { url?: string | null } | null
  } | null
}

export async function fetchContinent(slug: string, locale: Locale) {
  const dm = await draftMode()
  try {
    // Uses a custom public route (/continents/detail/:slug) that bypasses
    // Strapi role permissions — the standard /continents CRUD endpoint
    // requires explicit public permissions to be set in the admin panel.
    return (await PublicStrapiClient.fetchAPI(
      `/continents/detail/${encodeURIComponent(slug)}`,
      {
        locale,
        status: dm.isEnabled ? "draft" : "published",
      }
    )) as APIResponse<PopulatedContinentData>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching continent '${slug}' for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

export async function fetchAllContinents(locale: Locale) {
  try {
    const result = await PublicStrapiClient.fetchAPI("/continents/slugs", {
      locale,
      status: "published",
    })

    return result as { data: { slug: string; locale?: string | null }[] }
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching all continents for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return { data: [] }
  }
}

export async function fetchAllCountries(locale: Locale) {
  try {
    const result = await PublicStrapiClient.fetchAPI("/countries/slugs", {
      locale,
      status: "published",
    })

    return result as {
      data: {
        slug: string
        locale?: string | null
        continent?: { slug: string } | null
      }[]
    }
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching all countries for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return { data: [] }
  }
}

export async function fetchAllRegions(locale: Locale) {
  try {
    const result = await PublicStrapiClient.fetchAPI("/regions/slugs", {
      locale,
      status: "published",
    })

    return result as {
      data: {
        slug: string
        locale?: string | null
        country?: { slug: string } | null
        continent?: { slug: string } | null
      }[]
    }
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching all regions for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return { data: [] }
  }
}

export async function fetchCountry(slug: string, locale: Locale) {
  const dm = await draftMode()
  try {
    return (await PublicStrapiClient.fetchAPI(
      `/countries/detail/${encodeURIComponent(slug)}`,
      {
        locale,
        status: dm.isEnabled ? "draft" : "published",
      }
    )) as APIResponse<PopulatedCountryData>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching country '${slug}' for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

export async function fetchRegion(slug: string, locale: Locale) {
  const dm = await draftMode()
  try {
    return (await PublicStrapiClient.fetchAPI(
      `/regions/detail/${encodeURIComponent(slug)}`,
      {
        locale,
        status: dm.isEnabled ? "draft" : "published",
      }
    )) as APIResponse<PopulatedRegionData>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching region '${slug}' for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

export async function fetchArea(slug: string, locale: Locale) {
  const dm = await draftMode()
  try {
    return (await PublicStrapiClient.fetchAPI(
      `/areas/detail/${encodeURIComponent(slug)}`,
      {
        locale,
        status: dm.isEnabled ? "draft" : "published",
      }
    )) as APIResponse<PopulatedAreaData>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching area '${slug}' for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

// ------ Places by documentId (moderation review links)

export type PlaceKind = "library" | "country" | "region" | "area"

/** A place's name and where to open it; `href` null when it has no page. */
export type PlaceLink = { name: string | null; href: string | null }

const PLACE_UID = {
  library: "api::library.library",
  country: "api::country.country",
  region: "api::region.region",
  area: "api::area.area",
} as const

const SLUG_ONLY = { fields: ["slug"] }
const COUNTRY_WITH_CONTINENT = {
  fields: ["slug", "name"],
  populate: { continent: SLUG_ONLY },
}
const REGION_WITH_PARENTS = {
  fields: ["slug", "name"],
  populate: { continent: SLUG_ONLY, country: COUNTRY_WITH_CONTINENT },
}
const PLACE_POPULATE: Record<PlaceKind, Record<string, unknown>> = {
  library: { continent: SLUG_ONLY, country: SLUG_ONLY, region: SLUG_ONLY },
  country: { continent: SLUG_ONLY },
  region: { continent: SLUG_ONLY, country: COUNTRY_WITH_CONTINENT },
  area: { region: REGION_WITH_PARENTS },
}

type SlugRef = { slug?: string | null; name?: string | null } | null
type PlaceRow = {
  name?: string | null
  slug?: string | null
  continent?: SlugRef
  country?: (SlugRef & { continent?: SlugRef }) | null
  region?:
    | (SlugRef & {
        continent?: SlugRef
        country?: (SlugRef & { continent?: SlugRef }) | null
      })
    | null
}

async function readPlace(
  kind: PlaceKind,
  documentId: string,
  status: "published" | "draft"
): Promise<PlaceRow | null> {
  const res = (await PublicStrapiClient.fetchMany(
    PLACE_UID[kind],
    {
      filters: { documentId: { $eq: documentId } },
      fields: ["name", "slug"],
      populate: PLACE_POPULATE[kind],
      status,
      pagination: { pageSize: 1 },
    } as never,
    // A record just created by an approval: never a cached miss.
    { next: { revalidate: 0 } }
  )) as { data?: PlaceRow[] }

  return res.data?.[0] ?? null
}

/** `/{continent}/{country}/{region}` for a region row, when every slug is known. */
function regionPath(region: NonNullable<PlaceRow["region"]>): string | null {
  const continent = region.continent?.slug ?? region.country?.continent?.slug
  const country = region.country?.slug
  if (!continent || !country || !region.slug) return null

  return `/${continent}/${country}/${region.slug}`
}

/**
 * A library, country, region or area by documentId: its name and public
 * page. An area has no page of its own, so it links to its region's. An
 * unpublished library links to the Index editor when it has a slug.
 */
export async function fetchPlaceLink(
  kind: PlaceKind,
  documentId: string
): Promise<PlaceLink | null> {
  try {
    const row = await readPlace(kind, documentId, "published")
    if (!row) {
      if (kind !== "library") return null
      const draft = await readPlace(kind, documentId, "draft")
      if (!draft) return null

      return {
        name: draft.name ?? null,
        href: draft.slug
          ? `/contribute/index/${encodeURIComponent(draft.slug)}`
          : null,
      }
    }
    const name = row.name ?? null
    switch (kind) {
      case "library":
        return { name, href: buildLibraryPath(row) }
      case "country":
        return {
          name,
          href:
            row.continent?.slug && row.slug
              ? `/${row.continent.slug}/${row.slug}`
              : null,
        }
      case "region":
        return { name, href: regionPath(row) }

      default:
        return { name, href: row.region ? regionPath(row.region) : null }
    }
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching ${kind} '${documentId}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return null
  }
}

export async function fetchAllAreaSlugs(locale: Locale) {
  try {
    const result = await PublicStrapiClient.fetchAPI("/areas/slugs", {
      locale,
      status: "published",
    })

    return result as {
      data: {
        slug: string
        locale?: string | null
        region?: { slug: string } | null
        country?: { slug: string } | null
      }[]
    }
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching all area slugs for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return { data: [] }
  }
}

// ------ Blog fetching functions

export type MediaItem = {
  url: string
  alternativeText?: string | null
  width?: number | null
  height?: number | null
}

export type ContentRichText = {
  __component: "content.rich-text"
  id: number
  body?: unknown
}

export type ContentImageBlock = {
  __component: "content.image-block"
  id: number
  image?: MediaItem | null
  caption?: string | null
  fullWidth?: boolean | null
}

export type ContentCodeBlock = {
  __component: "content.code-block"
  id: number
  code: string
  language?: string | null
  filename?: string | null
}

export type ContentQuoteBlock = {
  __component: "content.quote-block"
  id: number
  quote: string
  attribution?: string | null
  source?: string | null
}

export type ContentCallout = {
  __component: "content.callout"
  id: number
  type: "info" | "warning" | "tip" | "note"
  title?: string | null
  body: string
}

export type ArticleBodyBlock =
  | ContentRichText
  | ContentImageBlock
  | ContentCodeBlock
  | ContentQuoteBlock
  | ContentCallout

export type CategorySummary = {
  documentId: string
  name: string
  slug: string
}

export type BlogSection = {
  documentId: string
  name: string
  slug: string
}

export type BlogArticleSummary = {
  documentId: string
  title?: string | null
  slug?: string | null
  summary?: string | null
  category?: CategorySummary | null
  section?: BlogSection | null
  author?: string | null
  authorTitle?: string | null
  authorBio?: string | null
  authorAvatar?: MediaItem | null
  featured?: boolean | null
  publishedAt?: string | null
  updatedAt?: string | null
  heroImage?: MediaItem | null
}

export type BlogArticleDetail = BlogArticleSummary & {
  body?: ArticleBodyBlock[] | null
  relatedArticles?: BlogArticleSummary[] | null
  seo?: LibrarySeoData | null
}

export type BlogLandingData = {
  heroEyebrow?: string | null
  heroTitle?: string | null
  heroText?: string | null
  featuredArticle?: BlogArticleSummary | null
  sections?: PageSection[] | null
  seo?: LibrarySeoData | null
}

export async function fetchBlogLanding(locale: Locale) {
  const dm = await draftMode()
  try {
    return (await PublicStrapiClient.fetchAPI("/blog-landing", {
      locale,
      status: dm.isEnabled ? "draft" : "published",
    })) as APIResponse<BlogLandingData>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching blog landing for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

/** A Journal article in `locale`, or the default-locale version flagged `localeFallback`. */
export async function fetchBlogArticle(slug: string, locale: Locale) {
  return withLocaleFallback(locale, (l) => fetchBlogArticleIn(slug, l))
}

async function fetchBlogArticleIn(slug: string, locale: Locale) {
  const dm = await draftMode()
  try {
    return (await PublicStrapiClient.fetchAPI(
      `/blog-articles/detail/${encodeURIComponent(slug)}`,
      {
        locale,
        status: dm.isEnabled ? "draft" : "published",
      }
    )) as APIResponse<BlogArticleDetail>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching blog article '${slug}' for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

export async function fetchRecentBlogArticles(locale: Locale) {
  const dm = await draftMode()
  try {
    return (await PublicStrapiClient.fetchAPI("/blog-articles", {
      locale,
      status: dm.isEnabled ? "draft" : "published",

      populate: {
        heroImage: true,
        section: { fields: ["name", "slug"] },
        category: { fields: ["name", "slug"] },
      } as any,

      fields: [
        "title",
        "slug",
        "summary",
        "author",
        "featured",
        "publishedAt",
        "updatedAt",
      ] as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sort: ["publishedAt:desc"] as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pagination: { pageSize: 24 } as any,
    })) as APIResponseCollection<BlogArticleSummary>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching recent blog articles for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return { data: [] }
  }
}

export async function fetchBlogArticlesBySection(
  sectionSlug: string,
  locale: Locale,
  page = 1,
  pageSize = 24
) {
  const dm = await draftMode()
  try {
    return (await PublicStrapiClient.fetchAPI("/blog-articles", {
      locale,
      status: dm.isEnabled ? "draft" : "published",
      filters: { section: { slug: { $eq: sectionSlug } } } as any,
      populate: {
        heroImage: true,
        section: { fields: ["name", "slug"] },
        category: { fields: ["name", "slug"] },
      } as any,
      fields: [
        "title",
        "slug",
        "summary",
        "author",
        "featured",
        "publishedAt",
        "updatedAt",
      ] as any,
      sort: ["publishedAt:desc"] as any,
      pagination: { page, pageSize } as any,
    })) as APIResponseCollection<BlogArticleSummary> & {
      meta: {
        pagination: {
          page: number
          pageSize: number
          pageCount: number
          total: number
        }
      }
    }
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching blog articles for section '${sectionSlug}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return {
      data: [],
      meta: { pagination: { page: 1, pageSize, pageCount: 1, total: 0 } },
    }
  }
}

export async function fetchBlogSections() {
  try {
    return (await PublicStrapiClient.fetchAPI("/blog-sections", {
      fields: ["name", "slug", "description"] as any,
      sort: ["name:asc"] as any,
      pagination: { pageSize: 50 } as any,
    })) as APIResponseCollection<BlogSection>
  } catch (e: unknown) {
    logNonBlockingError({
      message: "Error fetching blog sections",
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return { data: [] }
  }
}

export async function fetchAllBlogArticleSlugs(locale: Locale) {
  try {
    return (await PublicStrapiClient.fetchAPI("/blog-articles/slugs", {
      locale,
      status: "published",
    })) as {
      data: {
        slug: string
        locale?: string | null
        section?: { slug?: string | null } | null
      }[]
    }
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching all blog article slugs for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return { data: [] }
  }
}

// ------ Wiki fetching functions

export type WikiCategorySummary = {
  documentId: string
  name?: string | null
  slug?: string | null
  description?: string | null
  icon?: IconHubValue | null
  order?: number | null
  tagLabel?: string | null
}

export type WikiSection = {
  documentId: string
  name: string
  label?: string | null
  slug: string
  description?: string | null
  order?: number | null
}

export type WikiArticleStatus =
  | "stable"
  | "beta"
  | "experimental"
  | "draft"
  | "deprecated"

export type WikiArticleSummary = {
  documentId: string
  title?: string | null
  slug?: string | null
  summary?: string | null
  author?: string | null
  featured?: boolean | null
  priority?: number | null
  publishedAt?: string | null
  updatedAt?: string | null
  heroImage?: MediaItem | null
  section?: WikiSection | null
  category?: CategorySummary | null
  articleStatus?: WikiArticleStatus | null
  /** Docs section keys from the editor, home first. */
  docsSections?: string[] | null
}

export type WikiContributor = {
  documentId: string
  username?: string | null
  avatar?: { url?: string | null } | null
}

export type WikiArticleDetail = WikiArticleSummary & {
  body?: ArticleBodyBlock[] | null
  contributors?: WikiContributor[] | null
  relatedArticles?: WikiArticleSummary[] | null
  seo?: LibrarySeoData | null
}

/** Knowledge (wiki) sections in their display order, for pickers. */
export async function fetchWikiSections() {
  try {
    return (await PublicStrapiClient.fetchAPI("/wiki-sections", {
      fields: ["name", "label", "slug", "order"] as any,
      sort: ["order:asc", "name:asc"] as any,
      pagination: { pageSize: 50 } as any,
    })) as APIResponseCollection<WikiSection>
  } catch (e: unknown) {
    logNonBlockingError({
      message: "Error fetching wiki sections",
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return { data: [] }
  }
}

/** A Knowledge article in `locale`, or the default-locale version flagged `localeFallback`. */
export async function fetchWikiArticle(slug: string, locale: Locale) {
  return withLocaleFallback(locale, (l) => fetchWikiArticleIn(slug, l))
}

async function fetchWikiArticleIn(slug: string, locale: Locale) {
  const dm = await draftMode()
  try {
    return (await PublicStrapiClient.fetchAPI(
      `/wiki-articles/detail/${encodeURIComponent(slug)}`,
      {
        locale,
        status: dm.isEnabled ? "draft" : "published",
      }
    )) as APIResponse<WikiArticleDetail>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching wiki article '${slug}' for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

export type DocsWikiArticle = WikiArticleSummary & { body?: unknown }

/**
 * Every published wiki article with its body — the /knowledge front door maps
 * these into the fixed docs taxonomy and derives reading time from the body.
 */
export async function fetchDocsWikiArticles(locale: Locale) {
  // draftMode() throws outside a request scope (generateStaticParams) —
  // fall back to published, which is what static params want anyway.
  let isDraft = false
  try {
    isDraft = (await draftMode()).isEnabled
  } catch {
    isDraft = false
  }
  try {
    return (await PublicStrapiClient.fetchAPI("/wiki-articles", {
      locale,
      status: isDraft ? "draft" : "published",

      populate: {
        section: { fields: ["name", "slug"] },
        category: { fields: ["name", "slug"] },
        body: { populate: "*" },
      } as any,

      fields: [
        "title",
        "slug",
        "summary",
        "author",
        "publishedAt",
        "updatedAt",
        "docsSections",
      ] as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sort: ["updatedAt:desc"] as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pagination: { pageSize: 100 } as any,
    })) as APIResponseCollection<DocsWikiArticle>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching docs wiki articles for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return { data: [] }
  }
}

// ------ Legal document fetching functions

export type LegalDocumentNavItem = {
  documentId: string
  title?: string | null
  navLabel?: string | null
  slug?: string | null
  order?: number | null
}

export type LegalSection = {
  id: number
  heading: string
  inShort?: string | null
  /** Strapi blocks JSON. */
  body?: unknown[] | null
}

export type LegalRevision = {
  id: number
  version: string
  /** Date-only ISO string, e.g. "2026-09-01". */
  date: string
  summary: string
  changesUrl?: string | null
}

export type LegalDocumentDetail = LegalDocumentNavItem & {
  heroTitle?: string | null
  lead?: string | null
  updatedAt?: string | null
  publishedAt?: string | null
  summaryPoints?: { id: number; text: string }[] | null
  sections?: LegalSection[] | null
  revisions?: LegalRevision[] | null
  seo?: LibrarySeoData | null
}

/** draftMode() throws outside a request scope (generateStaticParams). */
async function isDraftRequest() {
  try {
    return (await draftMode()).isEnabled
  } catch {
    return false
  }
}

/**
 * Every legal document's tab label and slug, in display order. Pass `status`
 * to skip the draft-mode check (the root layout's footer always wants
 * published documents).
 */
export async function fetchLegalDocuments(
  locale: Locale,
  status?: "draft" | "published"
) {
  try {
    return (await PublicStrapiClient.fetchAPI("/legal-documents/nav", {
      locale,
      status: status ?? ((await isDraftRequest()) ? "draft" : "published"),
    })) as APIResponseCollection<LegalDocumentNavItem>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching legal documents for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return { data: [] }
  }
}

export async function fetchLegalDocument(slug: string, locale: Locale) {
  try {
    return (await PublicStrapiClient.fetchAPI(
      `/legal-documents/detail/${encodeURIComponent(slug)}`,
      {
        locale,
        status: (await isDraftRequest()) ? "draft" : "published",
      }
    )) as APIResponse<LegalDocumentDetail>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching legal document '${slug}' for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

// ------ Footer fetching functions

export async function fetchFooter(locale: Locale) {
  try {
    return (await PublicStrapiClient.fetchOne("api::footer.footer", undefined, {
      locale,
    })) as APIResponse<PopulatedFooterData>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching footer for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

// ------ Change history (content-moderation plugin)

export type HistorySource =
  | "submission"
  | "admin"
  | "api_token"
  | "import"
  | "system"
export type HistoryActorKind = "contributor" | "admin" | "token" | "system"
export type HistoryAction =
  | "create"
  | "update"
  | "publish"
  | "unpublish"
  | "delete"

/** Who made a change. `username` only when their activity is public. */
export interface HistoryActor {
  kind: HistoryActorKind | (string & {})
  username: string | null
}

/** One field of a Change Batch. Values only for `library.history`. */
export interface LibraryHistoryField {
  field: string
  previous?: unknown
  next?: unknown
}

/** One Change Batch: every field one write changed. */
export interface LibraryHistoryBatch {
  batchId: string
  changedAt: string
  action: HistoryAction | (string & {})
  source: HistorySource | (string & {})
  actor: HistoryActor
  fields: LibraryHistoryField[]
  submissionDocumentId: string | null
}

export interface HistoryMeta {
  page: number
  pageSize: number
  total: number
}

export interface LibraryHistoryPage {
  data: LibraryHistoryBatch[]
  meta: HistoryMeta
}

export interface LibraryHistoryStats {
  /** Oldest first, one entry per month of the window. */
  months: {
    month: string
    batches: number
    fields: number
    contributors: number
  }[]
  byField: { field: string; count: number }[]
  byAction: { action: string; count: number }[]
  /** `YYYY-MM` months in which `lastVerifiedAt` changed. */
  verificationEvents: string[]
}

export type ArticleHistoryKind =
  | "created"
  | "edited"
  | "translated"
  | "published"
  | "unpublished"
  | "deleted"

/** One Article Change. No values, ever. */
export interface ArticleHistoryItem {
  changedAt: string
  kind: ArticleHistoryKind | (string & {})
  locale: string
  actor: HistoryActor
  editSummary: string | null
}

export interface ArticleHistoryPage {
  data: ArticleHistoryItem[]
  meta: HistoryMeta
}

export const HISTORY_PAGE_SIZE = 20

const historyBase = () =>
  `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/content-moderation`

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

const str = (v: unknown): string | null => (typeof v === "string" ? v : null)
const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback

function toActor(v: unknown): HistoryActor {
  const a = isObject(v) ? v : {}

  return { kind: str(a.kind) ?? "system", username: str(a.username) }
}

function toMeta(v: unknown, fallbackPage: number, count: number): HistoryMeta {
  const m = isObject(v) ? v : {}

  return {
    page: num(m.page, fallbackPage),
    pageSize: num(m.pageSize, HISTORY_PAGE_SIZE),
    total: num(m.total, count),
  }
}

/**
 * A batch as the UI may show it. Values are kept only when they were asked
 * for: a public read never carries them, even if Strapi sent some.
 */
function toBatch(v: unknown, values: boolean): LibraryHistoryBatch | null {
  if (!isObject(v)) return null
  const batchId = str(v.batchId)
  const changedAt = str(v.changedAt)
  if (!batchId || !changedAt) return null
  const fields = (Array.isArray(v.fields) ? v.fields : []).flatMap((f) => {
    if (!isObject(f) || typeof f.field !== "string") return []
    const out: LibraryHistoryField = { field: f.field }
    if (values && "previous" in f) out.previous = f.previous
    if (values && "next" in f) out.next = f.next

    return [out]
  })

  return {
    batchId,
    changedAt,
    action: str(v.action) ?? "update",
    source: str(v.source) ?? "system",
    actor: toActor(v.actor),
    fields,
    submissionDocumentId: str(v.submissionDocumentId),
  }
}

function logHistoryError(message: string, e: unknown) {
  logNonBlockingError({
    message,
    error: {
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    },
  })
}

/**
 * One page of a library's Change Batches, newest first, or null when
 * Strapi can't answer. `values` asks for previous → next and is honoured
 * only with a `user`, whose bridge headers carry the service secret; the
 * caller decides it from the session's `library.history` entitlement.
 * Without values no secret is sent and the read is cached.
 */
export async function fetchLibraryHistory(
  documentId: string,
  {
    page = 1,
    values,
    user,
  }: {
    page?: number
    values: boolean
    user?: { id: string; email: string; name?: string | null } | null
  }
): Promise<LibraryHistoryPage | null> {
  const withValues = values && !!user
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(HISTORY_PAGE_SIZE),
  })
  if (withValues) qs.set("values", "1")
  try {
    const res = await fetch(
      `${historyBase()}/libraries/${encodeURIComponent(documentId)}/history?${qs}`,
      withValues
        ? { headers: bridgeUserHeaders(user), cache: "no-store" }
        : { next: { revalidate: 300 } }
    )
    if (!res.ok) return null
    const json = (await res.json()) as { data?: unknown; meta?: unknown }
    const data = (Array.isArray(json.data) ? json.data : []).flatMap((b) => {
      const batch = toBatch(b, withValues)

      return batch ? [batch] : []
    })

    return { data, meta: toMeta(json.meta, page, data.length) }
  } catch (e: unknown) {
    logHistoryError(`Error fetching history for library '${documentId}'`, e)

    return null
  }
}

/**
 * A library's change counts for the last 24 months, or null when Strapi
 * can't answer. Accepts the stats bare or wrapped in `{ data }`.
 */
export async function fetchLibraryHistoryStats(
  documentId: string
): Promise<LibraryHistoryStats | null> {
  try {
    const res = await fetch(
      `${historyBase()}/libraries/${encodeURIComponent(documentId)}/history/stats?months=24`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return null
    const json = (await res.json()) as unknown
    const raw =
      isObject(json) && isObject(json.data)
        ? json.data
        : isObject(json)
          ? json
          : {}
    if (!Array.isArray(raw.months)) return null

    return {
      months: raw.months.flatMap((m) =>
        isObject(m) && typeof m.month === "string"
          ? [
              {
                month: m.month,
                batches: num(m.batches),
                fields: num(m.fields),
                contributors: num(m.contributors),
              },
            ]
          : []
      ),
      byField: (Array.isArray(raw.byField) ? raw.byField : []).flatMap((f) =>
        isObject(f) && typeof f.field === "string"
          ? [{ field: f.field, count: num(f.count) }]
          : []
      ),
      byAction: (Array.isArray(raw.byAction) ? raw.byAction : []).flatMap(
        (a) =>
          isObject(a) && typeof a.action === "string"
            ? [{ action: a.action, count: num(a.count) }]
            : []
      ),
      verificationEvents: (Array.isArray(raw.verificationEvents)
        ? raw.verificationEvents
        : []
      ).filter((m): m is string => typeof m === "string"),
    }
  } catch (e: unknown) {
    logHistoryError(
      `Error fetching history stats for library '${documentId}'`,
      e
    )

    return null
  }
}

/**
 * The latest Article Changes of a Knowledge (`wiki`) or Journal (`blog`)
 * article, or null when Strapi can't answer.
 */
export async function fetchArticleHistory(
  kind: "wiki" | "blog",
  documentId: string
): Promise<ArticleHistoryPage | null> {
  try {
    const res = await fetch(
      `${historyBase()}/articles/${kind}/${encodeURIComponent(documentId)}/history?page=1&pageSize=${HISTORY_PAGE_SIZE}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return null
    const json = (await res.json()) as { data?: unknown; meta?: unknown }
    const data = (Array.isArray(json.data) ? json.data : []).flatMap((r) => {
      if (!isObject(r)) return []
      const changedAt = str(r.changedAt)
      if (!changedAt) return []

      return [
        {
          changedAt,
          kind: str(r.kind) ?? "edited",
          locale: str(r.locale) || routing.defaultLocale,
          actor: toActor(r.actor),
          editSummary: str(r.editSummary),
        },
      ]
    })

    return { data, meta: toMeta(json.meta, 1, data.length) }
  } catch (e: unknown) {
    logHistoryError(`Error fetching history for ${kind} '${documentId}'`, e)

    return null
  }
}

/**
 * How many people follow a library, from the public, anonymous count
 * route. Null when the count can't be read, so the page can leave it out.
 */
export async function fetchLibraryFollowerCount(
  documentId: string | null | undefined
): Promise<number | null> {
  if (!documentId) return null
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  try {
    const res = await fetch(
      `${strapiUrl}/api/libraries/${encodeURIComponent(documentId)}/followers`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return null
    const json = (await res.json()) as { data?: { followers?: unknown } }
    const n = json.data?.followers

    return typeof n === "number" && Number.isFinite(n) ? n : null
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching follower count for library '${documentId}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return null
  }
}

// ── Homepage: community proof + contribution opportunities ────────────────────

export type HomepageStats = {
  libraries: number
  countries: number
  contributors: number
  contributionsThisMonth: number
}

/** Live community counts from the custom `/homepage/stats` route. */
export async function fetchHomepageStats(): Promise<HomepageStats | null> {
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  try {
    const res = await fetch(`${strapiUrl}/api/homepage/stats`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: HomepageStats }

    return json.data ?? null
  } catch (e: unknown) {
    logNonBlockingError({
      message: "Error fetching homepage stats",
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return null
  }
}

export type IncompleteLibrary = {
  documentId: string
  slug: string
  name: string
  place: string
  percent: number
  /** `computeCompleteness` section keys that aren't filled yet. */
  missing: string[]
}

type IncompleteLibraryEntry = {
  documentId: string
  slug?: string | null
  name?: string | null
  city?: string | null
  region?: { name?: string | null } | null
  country?: { name?: string | null } | null
} & Parameters<typeof computeCompleteness>[0]

/** The library fields `computeCompleteness` and the task card read. */
const INCOMPLETE_LIBRARY_FIELDS = [
  "slug",
  "name",
  "city",
  "completeness",
  "openingTimes",
  "streetAddress",
  "location",
  "description",
  "summary",
  "foundedYear",
  "openedYear",
  "website",
  "phone",
  "email",
]

/**
 * Published libraries with gaps, least complete first — the raw material for
 * "help complete the map" tasks on the homepage and the contribute hub.
 * Strapi keeps a `completeness` integer on each library, so the least
 * complete hundred come back in one page instead of a name-sorted sample.
 */
export async function fetchIncompleteLibraries(): Promise<IncompleteLibrary[]> {
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  try {
    const params = new URLSearchParams({
      status: "published",
      "pagination[pageSize]": "100",
      "sort[0]": "completeness:asc",
      "sort[1]": "name:asc",
      ...Object.fromEntries(
        INCOMPLETE_LIBRARY_FIELDS.map((field, i) => [`fields[${i}]`, field])
      ),
      "populate[heroImage][fields][0]": "url",
      "populate[accessibility][fields][0]": "name",
      "populate[services][fields][0]": "name",
      "populate[amenities][fields][0]": "name",
      "populate[collectionStats]": "true",
      "populate[country][fields][0]": "name",
      "populate[region][fields][0]": "name",
    })
    const res = await fetch(`${strapiUrl}/api/libraries?${params}`, {
      next: { revalidate: 300, tags: ["strapi", "library"] },
      headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
    })
    if (!res.ok) return []
    const json = (await res.json()) as { data?: IncompleteLibraryEntry[] }

    return (json.data ?? [])
      .filter((entry) => entry.slug && entry.name)
      .map((entry) => {
        const { filled, total, sections } = computeCompleteness(entry)

        return {
          documentId: entry.documentId,
          slug: entry.slug!,
          name: entry.name!,
          place: [entry.city, entry.region?.name, entry.country?.name]
            .filter(Boolean)
            .join(", "),
          percent: Math.round((filled / total) * 100),
          missing: sections.filter((s) => !s.filled).map((s) => s.key),
        }
      })
      .filter((record) => record.missing.length > 0)
      .sort((a, b) => a.percent - b.percent)
  } catch (e: unknown) {
    logNonBlockingError({
      message: "Error fetching incomplete libraries",
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return []
  }
}

// ── Index editor ───────────────────────────────────────────────────────────

export type LibraryForEditing = Record<string, unknown> & {
  documentId: string
  slug?: string | null
  name?: string | null
  entityRef?: string | null
  continent?: { documentId: string; name?: string | null } | null
  country?: { documentId: string; name?: string | null } | null
  region?: { documentId: string; name?: string | null } | null
  area?: { documentId: string; name?: string | null } | null
  services?: { documentId: string }[] | null
  amenities?: { documentId: string }[] | null
  accessibility?: { documentId: string }[] | null
  socialLinks?:
    | { platform: string; url: string; label?: string | null }[]
    | null
  heroImage?: MediaItem | null
}

/**
 * A published library with everything the Index editor prefills: the atlas
 * hierarchy, facility relations, social links, hours and the hero image.
 * A missing translation falls back to the default locale (`localeFallback`).
 */
export async function fetchLibraryForEditing(slug: string, locale: Locale) {
  return withLocaleFallback(locale, (l) => fetchLibraryForEditingIn(slug, l))
}

async function fetchLibraryForEditingIn(slug: string, locale: Locale) {
  try {
    return (await PublicStrapiClient.fetchOneBySlug(
      "api::library.library",
      slug,
      {
        locale,
        status: "published",
        populate: {
          heroImage: { fields: ["url", "alternativeText"] },
          continent: { fields: ["name", "slug"] },
          country: { fields: ["name", "slug"] },
          region: { fields: ["name", "slug"] },
          area: { fields: ["name", "slug"] },
          services: { fields: ["name"] },
          amenities: { fields: ["name"] },
          accessibility: { fields: ["name"] },
          socialLinks: true,
        },
      } as Parameters<typeof PublicStrapiClient.fetchOneBySlug>[2]
    )) as APIResponse<LibraryForEditing>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching library '${slug}' for editing`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

// ── Knowledge editor ───────────────────────────────────────────────────────

export type ArticleForEditing = {
  documentId: string
  slug: string
  locale?: string | null
  title?: string | null
  summary?: string | null
  body?: unknown
  docsSections?: unknown
  section?: { slug?: string | null } | null
  topics?:
    | { documentId: string; name?: string | null; slug?: string | null }[]
    | null
  libraries?:
    | { documentId: string; name?: string | null; slug?: string | null }[]
    | null
  localizations?: { locale?: string | null }[] | null
  contributors?: { username?: string | null }[] | null
  updatedAt?: string | null
}

/**
 * One Knowledge or Journal article with everything the editor prefills:
 * body, taxonomy, tags and which languages it already exists in.
 */
export async function fetchArticleForEditing(
  kind: "knowledge" | "journal",
  slug: string,
  locale: Locale
) {
  const path = kind === "knowledge" ? "/wiki-articles" : "/blog-articles"
  try {
    const res = (await PublicStrapiClient.fetchAPI(path, {
      locale,
      status: "published",
      filters: { slug: { $eq: slug } } as any,
      populate: {
        body: { populate: "*" },
        section: { fields: ["name", "slug"] },
        topics: { fields: ["name", "slug"] },
        libraries: { fields: ["name", "slug"] },
        localizations: { fields: ["locale"] },
        contributors: { fields: ["username"] },
      } as any,
      pagination: { pageSize: 1 } as any,
    })) as APIResponseCollection<ArticleForEditing>

    return res.data?.[0] ?? null
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching ${kind} article '${slug}' for editing`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return null
  }
}
