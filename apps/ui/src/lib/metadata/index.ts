import type { Data, UID } from "@repo/strapi-types"
import { mergeWith } from "lodash"
import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { getTranslations } from "next-intl/server"

import { getEnvVar } from "@/lib/env-vars"
import { isProduction } from "@/lib/general-helpers"
import {
  getDefaultMetadata,
  getDefaultOgMeta,
  getDefaultTwitterMeta,
} from "@/lib/metadata/defaults"
import {
  getMetaAlternates,
  getMetaRobots,
  preprocessSocialMetadata,
  seoMergeCustomizer,
} from "@/lib/metadata/helpers"
import { fetchHomepage, fetchSeo } from "@/lib/strapi-api/content/server"
import type { StrapiLocalization } from "@/types/api"
import type { SocialMetadata } from "@/types/general"

export async function getMetadataFromStrapi({
  slug,
  locale,
  customMetadata,
  uid = "api::page.page",
}: {
  slug?: string
  locale: Locale
  customMetadata?: Metadata
  // Add more content types here if we want to fetch SEO components for them
  uid?: Extract<UID.ContentType, "api::page.page">
}): Promise<Metadata | null> {
  const t = await getTranslations({ locale, namespace: "seo" })
  const siteUrl = getEnvVar("APP_PUBLIC_URL")
  if (!siteUrl) {
    console.warn("APP_PUBLIC_URL is not defined, cannot generate metadata")

    return null
  }

  const defaultMeta: Metadata = getDefaultMetadata(siteUrl, t)
  const defaultOgMeta: Metadata["openGraph"] = getDefaultOgMeta(locale, slug, t)
  const defaultTwitterMeta: Metadata["twitter"] = getDefaultTwitterMeta(t)

  // skip strapi fetching and return SEO from translations
  if (!slug) {
    return {
      ...defaultMeta,
      openGraph: defaultOgMeta,
      twitter: defaultTwitterMeta,
    }
  }

  try {
    return await fetchAndMapStrapiMetadata(
      locale,
      slug,
      defaultMeta,
      defaultOgMeta,
      defaultTwitterMeta,
      customMetadata,
      uid
    )
  } catch (e: unknown) {
    console.warn(
      `SEO for ${uid} content type ("${slug}") wasn't fetched:`,
      (e as Error)?.message
    )

    return {
      ...defaultMeta,
      openGraph: defaultOgMeta,
      twitter: defaultTwitterMeta,
    }
  }
}

export async function getSingleTypeMetadataFromStrapi({
  locale,
  customMetadata,
  uid,
}: {
  locale: Locale
  customMetadata?: Metadata
  uid: Extract<UID.ContentType, "api::homepage.homepage">
}): Promise<Metadata | null> {
  const t = await getTranslations({ locale, namespace: "seo" })
  const siteUrl = getEnvVar("APP_PUBLIC_URL")
  if (!siteUrl) {
    console.warn("APP_PUBLIC_URL is not defined, cannot generate metadata")

    return null
  }

  const defaultMeta: Metadata = getDefaultMetadata(siteUrl, t)
  const defaultOgMeta: Metadata["openGraph"] = getDefaultOgMeta(
    locale,
    undefined,
    t
  )
  const defaultTwitterMeta: Metadata["twitter"] = getDefaultTwitterMeta(t)

  try {
    if (uid === "api::homepage.homepage") {
      const res = await fetchHomepage(locale)
      if (res == null) {
        return {
          ...defaultMeta,
          openGraph: defaultOgMeta,
          twitter: defaultTwitterMeta,
        }
      }

      const homepageWithLocalizations = res?.data as
        | (typeof res.data & { localizations?: unknown })
        | null
        | undefined

      return mapStrapiMetadata({
        seo: res?.data?.seo,
        localizations: Array.isArray(homepageWithLocalizations?.localizations)
          ? (homepageWithLocalizations.localizations as StrapiLocalization[])
          : undefined,
        locale,
        slug: null,
        defaultMeta,
        defaultOgMeta,
        defaultTwitterMeta,
        customMetadata,
      })
    }
  } catch (e: unknown) {
    console.warn(
      `SEO for ${uid} single type wasn't fetched:`,
      (e as Error)?.message
    )
  }

  return {
    ...defaultMeta,
    openGraph: defaultOgMeta,
    twitter: defaultTwitterMeta,
  }
}

async function fetchAndMapStrapiMetadata(
  locale: Locale,
  slug: string | null,
  defaultMeta: Metadata,
  defaultOgMeta: Metadata["openGraph"],
  defaultTwitterMeta: Metadata["twitter"],
  customMetadata?: Metadata,
  uid: Extract<UID.ContentType, "api::page.page"> = "api::page.page"
) {
  const forbidIndexing = !isProduction()
  const res = await fetchSeo(uid, slug, locale)

  return mapStrapiMetadata({
    seo: res?.data?.seo,
    localizations: Array.isArray(res?.data?.localizations)
      ? (res.data.localizations as StrapiLocalization[])
      : undefined,
    locale,
    slug,
    defaultMeta,
    defaultOgMeta,
    defaultTwitterMeta,
    customMetadata,
    forbidIndexing,
  })
}

function mapStrapiMetadata({
  seo,
  localizations,
  locale,
  slug,
  defaultMeta,
  defaultOgMeta,
  defaultTwitterMeta,
  customMetadata,
  forbidIndexing = !isProduction(),
}: {
  seo: Data.Component<"shared.seo"> | null | undefined
  localizations?: StrapiLocalization[]
  locale: Locale
  slug: string | null
  defaultMeta: Metadata
  defaultOgMeta: Metadata["openGraph"]
  defaultTwitterMeta: Metadata["twitter"]
  customMetadata?: Metadata
  forbidIndexing?: boolean
}) {
  const strapiMeta: Metadata = {
    title: seo?.metaTitle,
    description: seo?.metaDescription,
    keywords: seo?.keywords,
    robots: seo?.metaRobots,
  }

  const robots = getMetaRobots(seo?.metaRobots, forbidIndexing)
  const alternates = getMetaAlternates({
    seo,
    slug,
    locale,
    localizations,
  })
  const strapiSocialMeta: SocialMetadata = preprocessSocialMetadata(
    seo,
    alternates?.canonical
  )

  return {
    ...mergeWith(defaultMeta, strapiMeta, seoMergeCustomizer),
    openGraph: mergeWith(
      defaultOgMeta,
      strapiSocialMeta.openGraph,
      seoMergeCustomizer
    ),
    twitter: mergeWith(
      defaultTwitterMeta,
      strapiSocialMeta.twitter,
      seoMergeCustomizer
    ),
    robots,
    alternates,
    ...customMetadata,
  }
}
