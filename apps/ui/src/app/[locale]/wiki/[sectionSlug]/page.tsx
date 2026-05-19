import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"
import { use } from "react"

import WikiSectionLandingPage from "@/components/wiki/WikiSectionLandingPage"
import { isDevelopment } from "@/lib/general-helpers"
import { fetchWikiSections } from "@/lib/strapi-api/content/server"

export const dynamic = "force-static"
export const revalidate = 300
export const dynamicParams = true

export async function generateStaticParams({
  params: { locale },
}: {
  params: { locale: string }
}) {
  if (isDevelopment()) return []
  const result = await fetchWikiSections(locale as Locale)

  return (result.data || []).map((section) => ({
    sectionSlug: section.slug,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; sectionSlug: string }>
}): Promise<Metadata> {
  const { locale, sectionSlug } = await params
  const sections = (await fetchWikiSections(locale as Locale))?.data || []
  const section = sections.find((s) => s.slug === sectionSlug)

  if (!section) return { title: "Section not found" }

  const title = section.name
  const description =
    section.description ??
    `Browse ${section.name} articles in the knowledge hub.`

  const canonical = `/wiki/${sectionSlug}`

  return {
    title,
    description,
    robots: "index, follow",
    alternates: { canonical },
    openGraph: { title, description, type: "website", url: canonical },
    twitter: { card: "summary", title, description },
  }
}

export default function WikiSectionRoute(props: {
  params: Promise<{ locale: string; sectionSlug: string }>
}) {
  const params = use(props.params)
  const locale = params.locale as Locale
  const sectionSlug = params.sectionSlug

  const sections = use(fetchWikiSections(locale))?.data || []
  const section = sections.find((s) => s.slug === sectionSlug)

  if (!section) {
    notFound()
  }

  return (
    <WikiSectionLandingPage
      section={section}
      allSections={sections}
      locale={locale}
    />
  )
}
