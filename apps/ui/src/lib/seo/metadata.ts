import type { Metadata } from "next"

import { SITE_NAME } from "@/lib/constants"
import { getEnvVar } from "@/lib/env-vars"
import { isProduction } from "@/lib/general-helpers"
import { LIVE_LOCALES } from "@/lib/live-locales"
import { routing } from "@/lib/navigation"

/** Brand name used in <title> template, og:site_name and JSON-LD publisher. */
export { SITE_NAME }

export const DEFAULT_TITLE = `${SITE_NAME} — Index of the World's Libraries`

export const DEFAULT_DESCRIPTION =
  "Discover libraries around the world. Search the open atlas by place and type, check opening hours and services, and help improve library records."

export const DEFAULT_SOCIAL_IMAGE = "/images/social-card.png"

export { LIVE_LOCALES }

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
  const flat = plainMetadataText(text)
  if (!flat) return undefined
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(" ")

  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–—-]+$/, "")}…`
}

type RobotsMode = "index" | "noindex" | "noindex-follow"

/** Event descriptions and CMS summaries can contain rich text. */
export function plainMetadataText(
  text: string | null | undefined
): string | undefined {
  if (!text) return undefined
  const entities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  }
  const flat = text
    .slice(0, 20_000)
    .replaceAll(/<[^>]*>/g, " ")
    .replaceAll(
      /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
      (match, entity: string) => {
        if (!entity.startsWith("#"))
          return entities[entity.toLowerCase()] ?? match
        const n = entity.toLowerCase().startsWith("#x")
          ? Number.parseInt(entity.slice(2), 16)
          : Number(entity.slice(1))

        return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match
      }
    )
    .replaceAll(/\s+/g, " ")
    .trim()

  return flat || undefined
}

/** CMS directives can restrict indexing, including `none` and mixed lists. */
export function cmsRobots(value?: string | null): {
  index: boolean
  follow: boolean
} {
  const tokens = value?.toLowerCase().split(/[\s,]+/) ?? []

  return {
    index: !tokens.includes("noindex") && !tokens.includes("none"),
    follow: !tokens.includes("nofollow") && !tokens.includes("none"),
  }
}

/** Keep institution names intact; omit repeated places and the brand when space is tight. */
export function libraryTitle(
  name: string,
  city?: string | null,
  country?: string | null
): { title: string } | { absoluteTitle: string } {
  const places = [city, country].filter((place): place is string =>
    Boolean(
      place?.trim() && !name.toLowerCase().includes(place.trim().toLowerCase())
    )
  )
  const candidates = [
    [name, ...places].join(", "),
    [name, ...(places[0] ? [places[0]] : [])].join(", "),
    name,
  ]
  for (const candidate of candidates) {
    if (`${candidate} / ${SITE_NAME}`.length <= 60) return { title: candidate }
    if (candidate.length <= 60) return { absoluteTitle: candidate }
  }

  return { absoluteTitle: name }
}

export interface BuildMetadataOptions {
  seo?: {
    metaTitle?: string | null
    metaDescription?: string | null
    metaRobots?: string | null
  } | null
  /** Page title — the root layout template appends the brand. */
  title?: string
  /** Use this exact <title> (bypasses the template, e.g. homepage). */
  absoluteTitle?: string
  description?: string | null
  /** Unlocalised path, e.g. "europe/france" or "/journal/news/foo". */
  path?: string
  locale: string
  /** Only verified translations should be declared as alternates. */
  alternateLocales?: readonly string[]
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
 * root layout's wholesale, so the brand and default share image are applied here.
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
  const cmsTitle = plainMetadataText(opts.seo?.metaTitle)
  const pageTitle = cmsTitle ?? plainMetadataText(absoluteTitle ?? title)
  const description =
    clampDescription(opts.seo?.metaDescription) ??
    clampDescription(opts.description) ??
    DEFAULT_DESCRIPTION
  const socialTitle = pageTitle ?? DEFAULT_TITLE
  const canonical = path === undefined ? undefined : localizedPath(path, locale)
  const alternates = (opts.alternateLocales ?? LIVE_LOCALES).filter((l) =>
    LIVE_LOCALES.includes(l)
  )

  const languages =
    path !== undefined && alternates.includes(locale) && alternates.length > 1
      ? {
          ...Object.fromEntries(
            alternates.map((l) => [l, localizedPath(path, l)])
          ),
          ...(alternates.includes(routing.defaultLocale)
            ? { "x-default": localizedPath(path, routing.defaultLocale) }
            : {}),
        }
      : undefined

  const socialImage = image || DEFAULT_SOCIAL_IMAGE
  const images = [
    {
      url: socialImage,
      alt: imageAlt || SITE_NAME,
      ...(!image ? { width: 1200, height: 630 } : {}),
    },
  ]
  const cms = cmsRobots(opts.seo?.metaRobots)
  const index =
    robots === "index" &&
    cms.index &&
    LIVE_LOCALES.includes(locale) &&
    isProduction()
  const follow = robots !== "noindex" && cms.follow

  return {
    ...(absoluteTitle && pageTitle
      ? { title: { absolute: pageTitle } }
      : pageTitle
        ? { title: pageTitle }
        : {}),
    description,
    robots: { index, follow },
    ...(canonical
      ? { alternates: { canonical, ...(languages ? { languages } : {}) } }
      : {}),
    openGraph: {
      siteName: SITE_NAME,
      title: socialTitle,
      description,
      type,
      ...(canonical ? { url: canonical } : {}),
      images,
      ...(type === "article" && publishedTime ? { publishedTime } : {}),
      ...(type === "article" && modifiedTime ? { modifiedTime } : {}),
      ...(type === "article" && authors?.length ? { authors } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [socialImage],
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
