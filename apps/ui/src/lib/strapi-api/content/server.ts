import "server-only"

import type { Data, UID } from "@repo/strapi-types"
import { draftMode } from "next/headers"
import type { Locale } from "next-intl"

import type { HomepageContinentSummary } from "@/components/home/homepage.types"
import { logNonBlockingError } from "@/lib/logging"
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

type PopulatedNavbarData = Data.ContentType<"api::navbar.navbar"> & {
  links?: Data.Component<"utilities.link">[]
  logoImage?: Data.Component<"utilities.image-with-link"> | null
}

type PopulatedFooterData = Data.ContentType<"api::footer.footer"> & {
  links?: Data.Component<"utilities.link">[]
  socialLinks?: Data.Component<"shared.social">[]
  sections?: Data.Component<"elements.footer-item">[]
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
            populate: ["heroImage", "continent", "country", "region"],
          },
          featuredServices: true,
          seo: true,
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

// ------ Navbar fetching functions

export async function fetchNavbar(locale: Locale) {
  try {
    return (await PublicStrapiClient.fetchOne("api::navbar.navbar", undefined, {
      locale,
    })) as APIResponse<PopulatedNavbarData>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching navbar for locale '${locale}'`,
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
  services?: Data.ContentType<"api::service.service">[]
  amenities?: Data.ContentType<"api::amenity.amenity">[]
  accessibility?: Data.ContentType<"api::accessibility.accessibility">[]
  seo?: LibrarySeoData | null
}

export async function fetchLibrary(slug: string, locale: Locale) {
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

// Legacy aliases — continent detail page uses these names
export type ContinentEditorialBlock = EditorialBlock
export type ContinentCtaBanner = CtaBanner
export type ContinentSection = PageSection

// ── Continent ─────────────────────────────────────────────────────────────────

export type PopulatedContinentData =
  Data.ContentType<"api::continent.continent"> & {
    quickLinks?: QuickLink[]
    libraryCount?: number
    regionCount?: number
    countries?: {
      name: string
      slug: string
      capitalCity?: string | null
    }[]
    featuredLibraries?: PopulatedFeaturedLibraryData[]
    sections?: PageSection[]
  }

// ── Country ───────────────────────────────────────────────────────────────────

export type PopulatedCountryData = Data.ContentType<"api::country.country"> & {
  heroImage?: Data.ContentType<"plugin::upload.file"> | null
  heroTagline?: string | null
  featured?: boolean | null
  continent?: { name: string; slug: string; code?: string | null } | null
  regions?: {
    name: string
    slug: string
    summary?: string | null
    typeLabel?: string | null
  }[]
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
  sections?: PageSection[]
  libraryCount?: number
  regionCount?: number
}

// ── Region ────────────────────────────────────────────────────────────────────

export type AreaSummary = {
  name: string
  slug: string
  summary?: string | null
  typeLabel?: string | null
}

export type PopulatedRegionData = Data.ContentType<"api::region.region"> & {
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
  sections?: PageSection[]
  libraryCount?: number
  areaCount?: number
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

export type BlogArticleSummary = {
  documentId: string
  title?: string | null
  slug?: string | null
  summary?: string | null
  category?: string | null
  author?: string | null
  authorBio?: string | null
  authorAvatar?: MediaItem | null
  tags?: string[] | null
  featured?: boolean | null
  publishedAt?: string | null
  updatedAt?: string | null
  heroImage?: MediaItem | null
}

export type BlogArticleDetail = BlogArticleSummary & {
  body?: ArticleBodyBlock[] | null
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

export async function fetchBlogArticle(slug: string, locale: Locale) {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      populate: { heroImage: true } as any,

      fields: [
        "title",
        "slug",
        "summary",
        "category",
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

export async function fetchAllBlogArticleSlugs(locale: Locale) {
  try {
    return (await PublicStrapiClient.fetchAPI("/blog-articles/slugs", {
      locale,
      status: "published",
    })) as { data: { slug: string; locale?: string | null }[] }
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
  subTopics?: unknown | null
}

export type WikiArticleStatus =
  | "stable"
  | "beta"
  | "experimental"
  | "draft"
  | "deprecated"

export type WikiNavArticle = {
  documentId: string
  title?: string | null
  slug?: string | null
  priority?: number | null
  articleStatus?: WikiArticleStatus | null
}

export type WikiNavCategory = {
  documentId: string
  name?: string | null
  slug?: string | null
  order?: number | null
  articles?: WikiNavArticle[]
}

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
  category?: WikiCategorySummary | null
  articleStatus?: WikiArticleStatus | null
}

export type WikiArticleDetail = WikiArticleSummary & {
  githubPath?: string | null
  body?: ArticleBodyBlock[] | null
  relatedArticles?: WikiArticleSummary[] | null
  seo?: LibrarySeoData | null
}

export type WikiLandingData = {
  heroEyebrow?: string | null
  heroTitle?: string | null
  heroText?: string | null
  version?: string | null
  quickStartCards?: WikiArticleSummary[] | null
  featuredArticle?: WikiArticleSummary | null
  featuredCategories?: WikiCategorySummary[] | null
  seo?: LibrarySeoData | null
}

export async function fetchWikiLanding(locale: Locale) {
  const dm = await draftMode()
  try {
    return (await PublicStrapiClient.fetchAPI("/wiki-landing", {
      locale,
      status: dm.isEnabled ? "draft" : "published",
    })) as APIResponse<WikiLandingData>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching wiki landing for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })
  }
}

export async function fetchWikiArticle(slug: string, locale: Locale) {
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

export async function fetchPopularWikiArticles(locale: Locale) {
  const dm = await draftMode()
  try {
    return (await PublicStrapiClient.fetchAPI("/wiki-articles", {
      locale,
      status: dm.isEnabled ? "draft" : "published",

      populate: {
        heroImage: true,
        category: { fields: ["name", "slug"] },
      } as any,

      fields: [
        "title",
        "slug",
        "summary",
        "author",
        "featured",
        "priority",
        "publishedAt",
        "updatedAt",
      ] as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sort: ["priority:asc", "publishedAt:desc"] as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pagination: { pageSize: 12 } as any,
    })) as APIResponseCollection<WikiArticleSummary>
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching popular wiki articles for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return { data: [] }
  }
}

export async function fetchAllWikiArticleSlugs(locale: Locale) {
  try {
    return (await PublicStrapiClient.fetchAPI("/wiki-articles/slugs", {
      locale,
      status: "published",
    })) as {
      data: {
        slug: string
        locale?: string | null
        category?: { slug?: string | null } | null
      }[]
    }
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching all wiki article slugs for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return { data: [] }
  }
}

export async function fetchWikiNavigation(locale: Locale) {
  try {
    return (await PublicStrapiClient.fetchAPI("/wiki-categories/nav", {
      locale,
      status: "published",
    })) as { data: WikiNavCategory[] }
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching wiki navigation for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return { data: [] }
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
