import type { Metadata } from "next"

import { getEnvVar } from "@/lib/env-vars"
import { routing } from "@/lib/navigation"

/**
 * Brand name used in <title> template, og:site_name and JSON-LD publisher.
 *
 * NOTE: the visible header/footer brand is "Libraries of the World" while
 * metadata has always used "Libraries Global" (matches the libraries.global
 * domain). Keep this the single source of truth — change it here once the
 * intended brand is confirmed.
 */
export const SITE_NAME = "Libraries Global"

export const DEFAULT_TITLE = `${SITE_NAME} — Index of the World's Libraries`

export const DEFAULT_DESCRIPTION =
  "A complete, searchable atlas of every significant library on earth. Browse by continent, country, region, type and status."

/** X/Twitter handle — unverified; remove if the account does not exist. */
export const TWITTER_SITE = "@LibrariesGlobal"

/**
 * Locales whose content is actually published. `routing.locales` also lists
 * `cs` (starter-template scaffolding), but only English content exists, so we
 * don't emit hreflang alternates or sitemap entries for other locales.
 * Add a locale here once its content is live.
 */
export const LIVE_LOCALES: readonly string[] = [routing.defaultLocale]

const FALLBACK_SITE_URL = "https://libraries.global"

/** Absolute site origin without trailing slash. */
export function getSiteUrl(): string {
  const raw =
    getEnvVar("APP_PUBLIC_URL") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    FALLBACK_SITE_URL

  return raw.replace(/\/+$/, "")
}

/**
 * Locale-aware pathname matching next-intl's `localePrefix: "as-needed"`:
 * the default locale is unprefixed, others get `/{locale}`.
 * `path` may be given with or without a leading slash; "" means the homepage.
 */
export function localizedPath(path: string, locale: string): string {
  const clean = path.replace(/^\/+/, "").replace(/\/+$/, "")
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`
  const full = `${prefix}/${clean}`.replace(/\/+$/, "")

  return full === "" ? "/" : full
}

/** Absolute URL for a locale-aware path. */
export function absoluteUrl(path: string, locale: string): string {
  const p = localizedPath(path, locale)

  return p === "/" ? `${getSiteUrl()}/` : `${getSiteUrl()}${p}`
}

/** Collapse whitespace and clamp to ~160 chars on a word boundary. */
export function clampDescription(
  text: string | null | undefined,
  max = 160
): string | undefined {
  if (!text) return undefined
  const flat = text.replaceAll(/\s+/g, " ").trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(" ")

  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–—-]+$/, "")}…`
}

type RobotsMode = "index" | "noindex" | "noindex-follow"

export interface BuildMetadataOptions {
  /** Page title — the root layout template appends the brand. */
  title?: string
  /** Use this exact <title> (bypasses the template, e.g. homepage). */
  absoluteTitle?: string
  description?: string | null
  /** Unlocalised path, e.g. "europe/france" or "/blog/news/foo". */
  path?: string
  locale: string
  /** Absolute (or metadataBase-relative) image URL. */
  image?: string | null
  imageAlt?: string | null
  type?: "website" | "article" | "profile"
  robots?: RobotsMode
  publishedTime?: string | null
  modifiedTime?: string | null
  authors?: string[]
}

/**
 * One place to build page metadata: title, description, locale-aware
 * canonical (+ hreflang only when more than one locale is live), robots,
 * Open Graph and Twitter card. Child `openGraph`/`twitter` objects replace the
 * root layout's wholesale, so siteName / twitter:site are re-applied here.
 */
export function buildMetadata(opts: BuildMetadataOptions): Metadata {
  const {
    title,
    absoluteTitle,
    path,
    locale,
    image,
    imageAlt,
    type = "website",
    robots = "index",
    publishedTime,
    modifiedTime,
    authors,
  } = opts
  const description = clampDescription(opts.description) ?? DEFAULT_DESCRIPTION
  const socialTitle = absoluteTitle ?? title ?? DEFAULT_TITLE
  const canonical = path === undefined ? undefined : localizedPath(path, locale)

  const languages =
    path !== undefined && LIVE_LOCALES.length > 1
      ? {
          ...Object.fromEntries(
            LIVE_LOCALES.map((l) => [l, localizedPath(path, l)])
          ),
          "x-default": localizedPath(path, routing.defaultLocale),
        }
      : undefined

  const images = image
    ? [{ url: image, ...(imageAlt ? { alt: imageAlt } : {}) }]
    : undefined

  return {
    ...(absoluteTitle
      ? { title: { absolute: absoluteTitle } }
      : title
        ? { title }
        : {}),
    description,
    robots:
      robots === "index"
        ? { index: true, follow: true }
        : { index: false, follow: robots === "noindex-follow" },
    ...(canonical
      ? { alternates: { canonical, ...(languages ? { languages } : {}) } }
      : {}),
    openGraph: {
      siteName: SITE_NAME,
      title: socialTitle,
      description,
      type,
      ...(canonical ? { url: canonical } : {}),
      ...(images ? { images } : {}),
      ...(type === "article" && publishedTime ? { publishedTime } : {}),
      ...(type === "article" && modifiedTime ? { modifiedTime } : {}),
      ...(type === "article" && authors?.length ? { authors } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      site: TWITTER_SITE,
      title: socialTitle,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

/** Metadata for routes that must never be indexed (auth, forms, dashboards). */
export function privateMetadata(title?: string): Metadata {
  return {
    ...(title ? { title } : {}),
    robots: { index: false, follow: false },
  }
}
