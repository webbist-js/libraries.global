import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { use } from "react"

import LibraryDetailPage from "@/components/library/LibraryDetailPage"
import { isDevelopment } from "@/lib/general-helpers"
import {
  fetchAllLibraries,
  fetchLibrary,
  fetchNavbar,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

export const dynamic = "force-static"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const library = (await fetchLibrary(slug, locale as Locale))?.data

  if (!library) return { title: "Library not found" }

  const seo = library.seo

  const title = seo?.metaTitle ?? library.name
  const description =
    seo?.metaDescription ??
    library.summary ??
    `Explore ${library.name} — opening hours, services, amenities and accessibility information.`

  const heroImageUrl = library.heroImage?.url
    ? formatStrapiMediaUrl(library.heroImage.url)
    : undefined
  const ogImageUrl = seo?.metaImage?.url
    ? formatStrapiMediaUrl(seo.metaImage.url)
    : heroImageUrl

  return {
    title,
    description,
    ...(seo?.keywords ? { keywords: seo.keywords } : {}),
    ...(seo?.metaRobots ? { robots: seo.metaRobots } : {}),
    ...(seo?.canonicalURL
      ? { alternates: { canonical: seo.canonicalURL } }
      : {}),
    openGraph: {
      title: seo?.openGraph?.ogTitle ?? title,
      description: seo?.openGraph?.ogDescription ?? description,
      type: (seo?.openGraph?.ogType as "website") ?? "website",
      ...(ogImageUrl ? { images: [{ url: ogImageUrl }] } : {}),
    },
    ...(seo?.structuredData
      ? {
          other: {
            "application/ld+json": JSON.stringify(seo.structuredData),
          },
        }
      : {}),
  }
}
export const revalidate = 300
export const dynamicParams = true

export async function generateStaticParams({
  params: { locale },
}: {
  params: { locale: string }
}) {
  if (isDevelopment()) {
    return [
      {
        continent: "europe",
        country: "england",
        region: "london",
        slug: "british-library",
      },
    ]
  }

  const results = await fetchAllLibraries(locale as Locale)

  return (
    results?.data
      .filter(
        (library) =>
          library.continent?.slug &&
          library.country?.slug &&
          library.region?.slug
      )
      .map((library) => ({
        continent: library.continent!.slug,
        country: library.country!.slug,
        region: library.region!.slug,
        slug: library.slug,
      })) ?? []
  )
}

export default function LibraryPage(props: {
  params: Promise<{
    locale: string
    continent: string
    country: string
    region: string
    slug: string
  }>
}) {
  const params = use(props.params)
  const locale = params.locale as Locale
  const slug = params.slug

  const libraryPromise = fetchLibrary(slug, locale)
  const navbarPromise = fetchNavbar(locale)

  const library = use(libraryPromise)?.data
  const navbar = use(navbarPromise)?.data

  return (
    <LibraryDetailPage
      library={library ?? null}
      navbar={navbar}
      locale={locale}
    />
  )
}
