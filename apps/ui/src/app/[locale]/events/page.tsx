import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { use } from "react"

import { EventsProgrammePage } from "@/components/events/EventsProgrammePage"
import type { EventsProgrammeData } from "@/components/events/types"
import GlobalHeader from "@/components/global/GlobalHeader"
import { T } from "@/lib/design-tokens"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Programme — Libraries of the World",
  description:
    "Talks, exhibitions, storytimes, workshops and more — this week at libraries worldwide.",
}

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY

function eventsGet(path: string) {
  return fetch(`${STRAPI}/api/events${path}`, {
    headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
    next: { revalidate: 120 },
  }).then((r) => (r.ok ? r.json() : null))
}

async function fetchProgrammeData(): Promise<EventsProgrammeData> {
  const [stats, providers, categories, topLibraries, heatmap, featured] =
    await Promise.all([
      eventsGet("/stats"),
      eventsGet("/provider-breakdown"),
      eventsGet("/category-breakdown"),
      eventsGet("/top-libraries?limit=10"),
      eventsGet("/heatmap"),
      eventsGet("/featured"),
    ])

  return {
    stats: stats ?? {
      totalEvents: 0,
      totalThisWeek: 0,
      percentFree: 0,
      peakSlot: null,
      peakCount: 0,
    },
    providers: Array.isArray(providers) ? providers : [],
    categories: Array.isArray(categories) ? categories : [],
    topLibraries: Array.isArray(topLibraries) ? topLibraries : [],
    heatmap: Array.isArray(heatmap) ? heatmap : [],
    featured: featured ?? null,
  }
}

export default function EventsPage(props: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = use(props.params)
  const data = use(fetchProgrammeData())

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.space, color: T.ink.base }}
    >
      <GlobalHeader locale={locale as Locale} />
      <EventsProgrammePage data={data} />
    </div>
  )
}
