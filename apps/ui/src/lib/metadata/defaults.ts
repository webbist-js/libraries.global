import type { Metadata } from "next"
import type { Locale } from "next-intl"
import type { getTranslations } from "next-intl/server"

import { routing } from "@/lib/navigation"

type TranslateFn = Awaited<ReturnType<typeof getTranslations>>

export function getDefaultMetadata(siteUrl: string, t: TranslateFn) {
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: t("keywords"),
    robots: "index, follow",
    applicationName: "Libraries Global",

    metadataBase: new URL(siteUrl),
  } as Metadata
}

export function getDefaultOgMeta(
  locale: Locale | undefined,
  slug: string | undefined,
  t: TranslateFn
): Metadata["openGraph"] {
  return {
    type: "website",
    locale: locale,
    siteName: "Libraries Global",
    title: t("metaTitle"),
    description: t("metaDescription"),
    images: ["/images/social-card.png"],
    url: [routing.defaultLocale !== locale ? locale : null, slug ?? ""]
      .filter(Boolean)
      .join("/"),
  }
}

export function getDefaultTwitterMeta(t: TranslateFn): Metadata["twitter"] {
  return {
    card: "summary_large_image",
    title: t("metaTitle"),
    description: t("metaDescription"),
    images: ["/images/social-card.png"],
  } as Metadata["twitter"]
}
