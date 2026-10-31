// apps/ui/src/app/[locale]/events/[documentId]/page.tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import { use } from "react"

import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import { MainContent } from "@/components/ds/MainContent"
import { EventDetailPage } from "@/components/events/EventDetailPage"
import GlobalLink from "@/components/global/GlobalLink"
import { buildMetadata, SITE_NAME } from "@/lib/seo/metadata"

export const revalidate = 300
export const dynamicParams = true

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY

function eventsGet(path: string) {
  return fetch(`${STRAPI}/api/events${path}`, {
    headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
    next: { revalidate: 300 },
  }).then((r) => (r.ok ? r.json() : null))
}

async function fetchEventData(documentId: string) {
  const [event, related] = await Promise.all([
    eventsGet(`/event/${documentId}`),
    eventsGet(`/event/${documentId}/related`),
  ])

  return { event, related: Array.isArray(related) ? related : [] }
}

async function fetchLibraryName(
  entityRef: string | null | undefined
): Promise<string | null> {
  if (!entityRef) return null
  const res = await fetch(
    `${STRAPI}/api/libraries?filters[entityRef][$eq]=${entityRef}&fields=name&pagination[limit]=1`,
    {
      headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
      next: { revalidate: 3600 },
    }
  )
  if (!res.ok) return null
  const json = (await res.json()) as {
    data?: { name: string }[]
  }

  return json.data?.[0]?.name ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; documentId: string }>
}): Promise<Metadata> {
  const { locale, documentId } = await params
  const event = (await eventsGet(`/event/${documentId}`)) as {
    title?: string | null
    description?: string | null
    imageUrl?: string | null
    startTime?: string | null
  } | null
  if (!event) return { title: "Event not found", robots: { index: false } }

  const title = event.title ?? "Library event"
  const when = event.startTime
    ? new Date(event.startTime).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null

  return buildMetadata({
    title,
    description:
      event.description ??
      `${title}${when ? ` — ${when}` : ""}. Library event listing on ${SITE_NAME}.`,
    path: `events/${documentId}`,
    locale,
    type: "article",
    image: event.imageUrl,
    imageAlt: title,
  })
}

export default function EventPage(props: {
  params: Promise<{ locale: string; documentId: string }>
}) {
  const ui = useTranslations("ui"),
    workspace = useTranslations("communityDashboard")
  const { documentId } = use(props.params)
  const { event, related } = use(fetchEventData(documentId))

  if (!event) notFound()

  const libraryName = use(fetchLibraryName(event.libraryEntityRef))

  return (
    <DashboardPage
      title={event.title}
      className="dashboard-events-detail"
      navigationFooter={
        <DashboardSidebarCta
          title={workspace("eventsTitle")}
          body={workspace("eventsBody")}
          action={{ label: workspace("eventsAction"), href: "/staff" }}
          secondary={{
            label: workspace("learnMore"),
            href: "/knowledge?section=events",
          }}
        />
      }
      navigation={
        <GlobalLink href="/events" className="dashboard-navigation-link">
          ← {ui("events")}
        </GlobalLink>
      }
      toolbar={
        <RecordToolbar
          items={[
            { label: ui("events"), href: "/events" },
            { label: event.title },
          ]}
        />
      }
    >
      <MainContent className="relative z-10 flex-1 pt-4">
        <EventDetailPage
          event={event}
          related={related}
          libraryName={libraryName}
        />
      </MainContent>
    </DashboardPage>
  )
}
