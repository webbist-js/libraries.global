import { normalizePageFullPath } from "@repo/shared-data"
import type { Data } from "@repo/strapi-types"
import type { Metadata } from "next"
import type { Locale } from "next-intl"

import { metaRobots } from "@/lib/metadata/constants"
import { routing } from "@/lib/navigation"
import type { StrapiLocalization } from "@/types/api"
import type { NextMetadataTwitterCard, SocialMetadata } from "@/types/general"

const OPEN_GRAPH_TYPES = [
  "article",
  "book",
  "music.song",
  "music.album",
  "music.playlist",
  "music.radio_station",
  "profile",
  "website",
  "video.tv_show",
  "video.other",
  "video.movie",
  "video.episode",
] as const

type NextMetadataOpenGraphType = (typeof OPEN_GRAPH_TYPES)[number]

function getOpenGraphType(
  value?: string | null
): NextMetadataOpenGraphType | undefined {
  return OPEN_GRAPH_TYPES.find((type) => type === value)
}

export const preprocessSocialMetadata = (
  seo: Data.Component<"shared.seo"> | null | undefined,
  canonicalUrl?: string
): SocialMetadata => {
  const ogSeo = seo?.openGraph
  const ogImage = ogSeo?.ogImage ?? seo?.metaImage
  const twitterImages = ogImage ? [ogImage] : undefined
  const card: NextMetadataTwitterCard = ogImage
    ? "summary_large_image"
    : "summary"

  return {
    twitter: {
      card,
      title: ogSeo?.ogTitle ?? seo?.metaTitle ?? undefined,
      description: ogSeo?.ogDescription ?? seo?.metaDescription ?? undefined,
      images: twitterImages?.map((img) => img?.url),
    },
    openGraph: {
      type: getOpenGraphType(ogSeo?.ogType),
      title: ogSeo?.ogTitle ?? seo?.metaTitle ?? undefined,
      description: ogSeo?.ogDescription ?? seo?.metaDescription ?? undefined,
      url: ogSeo?.ogUrl ?? canonicalUrl ?? undefined,
      images: ogImage
        ? [
            {
              url: ogImage?.url ?? "",
              width: ogImage?.width ?? 0,
              height: ogImage?.height ?? 0,
              alt: ogImage?.alternativeText ?? "",
            },
          ]
        : undefined,
    },
  }
}

export const seoMergeCustomizer = (
  defaultValue: unknown,
  strapiValue: unknown
) => strapiValue ?? defaultValue

export const getMetaRobots = (
  robotsString?: string | Metadata["robots"] | null,
  forbidIndexing?: boolean
) => {
  if (forbidIndexing) {
    return { index: false, follow: false }
  }

  return typeof robotsString === "string"
    ? metaRobots[robotsString.replaceAll(" ", "")]
    : robotsString
}

export const getMetaAlternates = ({
  seo,
  slug,
  locale,
  localizations,
}: {
  seo: Data.Component<"shared.seo"> | null | undefined
  slug: string | null
  locale: Locale
  localizations?: StrapiLocalization[]
}) => {
  const canonicalUrl = seo?.canonicalURL ?? slug ?? ""

  const languages = Array.isArray(localizations)
    ? {
        // Only available languages should be added as alternates
        ...localizations?.reduce((acc, curr) => {
          if (!curr.locale) {
            return acc
          }

          return {
            ...acc,
            [curr.locale]: normalizePageFullPath([canonicalUrl], curr.locale),
          }
        }, {}),
        // If you are on defaultLocale, it should point to the en version too
        ...(locale === routing.defaultLocale
          ? {
              [routing.defaultLocale]: normalizePageFullPath(
                [canonicalUrl],
                routing.defaultLocale
              ),
            }
          : {}),
        // x-default should be added to point to defaultLocale version if exists
        ...(locale === routing.defaultLocale ||
        localizations?.find((lang) => lang.locale === routing.defaultLocale)
          ? {
              "x-default": normalizePageFullPath(
                [canonicalUrl],
                routing.defaultLocale
              ),
            }
          : {}),
      }
    : undefined

  const canonical = canonicalUrl
    ? normalizePageFullPath([canonicalUrl], locale)
    : undefined

  return {
    canonical,
    languages,
  }
}
