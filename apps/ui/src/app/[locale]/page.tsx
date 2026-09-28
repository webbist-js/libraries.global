import type { Metadata } from "next"
import { headers } from "next/headers"
import type { Locale } from "next-intl"

import { LibraryHomePage } from "@/components/home/LibraryHomePage"
import { JsonLd } from "@/components/seo/JsonLd"
import { getSessionSSR } from "@/lib/auth-server"
import { buildWebSiteSchema } from "@/lib/seo/json-ld"
import {
  absoluteUrl,
  buildMetadata,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
} from "@/lib/seo/metadata"
import { fetchHomepage } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await props.params
  // Strapi's homepage `seo` component is optional — fall back to site
  // defaults (the old next-intl `seo.*` keys were unfilled placeholders).
  const seo = (await fetchHomepage(locale as Locale))?.data?.seo

  return buildMetadata({
    absoluteTitle: seo?.metaTitle ?? DEFAULT_TITLE,
    description: seo?.metaDescription ?? DEFAULT_DESCRIPTION,
    path: "",
    locale,
    image: formatStrapiMediaUrl(seo?.metaImage?.url),
  })
}

export default async function HomePage(props: {
  params: Promise<{ locale: string }>
}) {
  const locale = (await props.params).locale as Locale
  const user = (await getSessionSSR(await headers()))?.user
  // Signed in without a loaded profile still counts as a member, on "free"
  const viewerPlan = user ? (user.plan ?? "free") : undefined

  return (
    <>
      <JsonLd
        data={buildWebSiteSchema({
          siteUrl: absoluteUrl("", locale),
          searchUrlTemplate: `${absoluteUrl("index", locale)}?q={search_term_string}`,
        })}
      />
      <LibraryHomePage locale={locale} viewerPlan={viewerPlan} />
    </>
  )
}
