import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { use } from "react"

import { EventsPageClient } from "@/components/events/EventsPageClient"
import GlobalHeader from "@/components/global/GlobalHeader"
import { T } from "@/lib/design-tokens"
import { buildMetadata } from "@/lib/seo/metadata"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return buildMetadata({
    title: "Library events",
    description:
      "Author talks, exhibitions, classes, storytime and archive tours, gathered from library calendars and ticketing sites.",
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
