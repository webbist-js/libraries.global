import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"

import LegalDocumentPage from "@/components/legal/LegalDocumentPage"
import { JsonLd } from "@/components/seo/JsonLd"
import { isDevelopment } from "@/lib/general-helpers"
import { buildBreadcrumbSchema } from "@/lib/seo/json-ld"
import { absoluteUrl, buildMetadata, SITE_NAME } from "@/lib/seo/metadata"
import {
  fetchLegalDocument,
  fetchLegalDocuments,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

export const dynamic = "force-static"
export const revalidate = 300
export const dynamicParams = true

export async function generateStaticParams({
  params: { locale },
}: {
  params: { locale: string }
}) {
  if (isDevelopment()) return []
  const result = await fetchLegalDocuments(locale as Locale)

  return result.data.flatMap((doc) => (doc.slug ? [{ slug: doc.slug }] : []))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { slug, locale } = await params
  const doc = (await fetchLegalDocument(slug, locale as Locale))?.data
  if (!doc) return { title: "Page not found", robots: { index: false } }

  return buildMetadata({
    title: doc.seo?.metaTitle ?? doc.title ?? "Legal",
    description:
      doc.seo?.metaDescription ??
      doc.lead ??
      `${doc.title ?? "Legal"} — ${SITE_NAME}.`,
    path: `legal/${slug}`,
    locale,
    image: formatStrapiMediaUrl(doc.seo?.metaImage?.url),
    modifiedTime: doc.updatedAt,
  })
}

export default async function LegalDocumentRoute({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale: rawLocale, slug } = await params
  const locale = rawLocale as Locale

  const [docRes, navRes] = await Promise.all([
    fetchLegalDocument(slug, locale),
    fetchLegalDocuments(locale),
  ])
  const doc = docRes?.data
  if (!doc) notFound()

  return (
    <>
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: "Home", url: absoluteUrl("", locale) },
          {
            name: doc.title ?? slug,
            url: absoluteUrl(`legal/${slug}`, locale),
          },
        ])}
      />
      <LegalDocumentPage
        document={doc}
        documents={navRes.data}
        locale={locale}
      />
    </>
  )
}
