import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { getTranslations } from "next-intl/server"
import { use } from "react"

import { EventsPageClient } from "@/components/events/EventsPageClient"
import GlobalHeader from "@/components/global/GlobalHeader"
import { T } from "@/lib/design-tokens"
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

export default function EventsPage(props: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = use(props.params)

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale as Locale} />
      <EventsPageClient />
    </div>
  )
}
