import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"

import { BetaFooter } from "@/components/beta/BetaFooter"
import LegalDocumentPage from "@/components/legal/LegalDocumentPage"
import { JsonLd } from "@/components/seo/JsonLd"
import { BETA_LEGAL_SLUG } from "@/lib/beta/scope"
import { buildBreadcrumbSchema } from "@/lib/seo/json-ld"
import { absoluteUrl, buildMetadata, SITE_NAME } from "@/lib/seo/metadata"
import {
  fetchLegalDocument,
  fetchLegalDocuments,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

// Draft mode and the beta legal shell depend on this request's cookies/headers.
// These pages must also work when the image is built without CMS credentials.
export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { slug, locale } = await params
  const res = await fetchLegalDocument(slug, locale as Locale)
  const doc = res?.data
  if (!doc) return { title: "Page not found", robots: { index: false } }

  return buildMetadata({
    seo: doc.seo,
    alternateLocales: [locale],
    title: doc.title ?? "Legal",
    description: doc.lead ?? `${doc.title ?? "Legal"} — ${SITE_NAME}.`,
    path: `legal/${slug}`,
    locale,
    image: formatStrapiMediaUrl(doc.seo?.metaImage?.url),
    modifiedTime: doc.updatedAt,
    robots:
      slug === BETA_LEGAL_SLUG || res?.localeFallback
        ? "noindex-follow"
        : "index",
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
  const publicShell = (await headers()).get("x-beta-public-shell") === "true"

  const content = (
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
        dashboard={!publicShell}
        document={doc}
        untranslatedLocale={docRes?.localeFallback ? locale : null}
        documents={slug === BETA_LEGAL_SLUG ? [doc] : navRes.data}
        locale={locale}
      />
      {publicShell && <BetaFooter locale={locale} />}
    </>
  )

  return content
}
