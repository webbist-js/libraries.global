import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { getTranslations } from "next-intl/server"

import { EventsPageClient } from "@/components/events/EventsPageClient"
import { buildMetadata } from "@/lib/seo/metadata"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "eventListing" })

  return buildMetadata({
    title: t("metaTitle"),
    description: t("lead"),
    path: "events",
    locale,
  })
}

export default function EventsPage() {
  return <EventsPageClient />
}
