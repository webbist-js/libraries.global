import { UpcomingEventsWidget } from "@/components/events/UpcomingEventsWidget"
import GlobalLink from "@/components/global/GlobalLink"
import type { SectionIntro } from "@/components/home/homepage.types"
import SectionHeader from "@/components/home/sections/SectionHeader"
import { T } from "@/lib/design-tokens"
import type { EventSearchHit } from "@/lib/meilisearch"

/** The next few library events anywhere. Left out entirely until there are
 * some: an empty "what's on" says nothing useful. */
export function EventsSection({
  intro,
  events,
}: {
  readonly intro: SectionIntro
  readonly events: readonly EventSearchHit[]
}) {
  if (events.length === 0) return null

  return (
    <section
      aria-labelledby="events-title"
      className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(80px,10vw,140px)] sm:px-8"
    >
      <SectionHeader
        id="events-title"
        intro={intro}
        action={
          <GlobalLink
            href="/events"
            className="font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            See all events
          </GlobalLink>
        }
      />
      <UpcomingEventsWidget events={events} />
    </section>
  )
}

EventsSection.displayName = "EventsSection"

export default EventsSection
