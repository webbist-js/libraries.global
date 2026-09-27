import { notFound } from "next/navigation"
import type { Locale } from "next-intl"

import { redirect } from "@/lib/navigation"
import { fetchLegalDocuments } from "@/lib/strapi-api/content/server"

/** /legal has no page of its own — open the first document. */
export default async function LegalIndexRoute({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const locale = (await params).locale as Locale
  const first = (await fetchLegalDocuments(locale)).data.find((doc) => doc.slug)
  if (!first?.slug) notFound()

  redirect({ href: `/legal/${first.slug}`, locale })
}
