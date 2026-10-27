import { Clock, MapPin } from "lucide-react"

import { EventTypeChip } from "@/components/events/EventTypeChip"
import { PriceBadge } from "@/components/events/PriceBadge"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { EventSearchHit } from "@/lib/meilisearch"

/** A formatter in the event's own time zone, so times read as they will at
 * the library. An unknown zone falls back to UTC. */
function formatterFor(timeZone: string, options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone })
  } catch {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" })
  }
}

function partsOf(event: EventSearchHit) {
  const start = new Date(event.startTime)
  const part = (options: Intl.DateTimeFormatOptions) =>
    formatterFor(event.timezone, options).format(start)

  return {
    weekday: part({ weekday: "short" }),
    day: part({ day: "numeric" }),
    month: part({ month: "short" }),
    longDate: part({ weekday: "long", day: "numeric", month: "long" }),
    time: event.allDay
      ? "All day"
      : part({ hour: "2-digit", minute: "2-digit", timeZoneName: "short" }),
  }
}

function placeOf(event: EventSearchHit): string | null {
  const place = [event.library_name, event.library_city]
    .filter(Boolean)
    .join(", ")

  return place || null
}

/** Upcoming events as cards: a date tile, type and price, title, time in the
 * library's own zone, and where. Renders nothing without events. */
export function UpcomingEventsWidget({
  events,
}: {
  readonly events: readonly EventSearchHit[]
}) {
  if (events.length === 0) return null

  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,290px),1fr))] gap-4 p-0">
      {events.map((event) => {
        const { weekday, day, month, longDate, time } = partsOf(event)
        const place = placeOf(event)

        return (
          <li key={event.documentId}>
            <GlobalLink
              href={`/events/${event.documentId}`}
              className="group flex h-full gap-4 rounded-[20px] border bg-white p-4 no-underline transition-colors hover:border-(--t-accent-primary)"
              style={{ borderColor: T.border.line }}
            >
              <span
                aria-hidden="true"
                className="flex w-[60px] shrink-0 flex-col items-center justify-center self-start rounded-[14px] py-2.5"
                style={{ background: T.bg.space, color: T.ink.dim }}
              >
                <span className="text-sm font-semibold">{month}</span>
                <span
                  className="text-[28px] leading-none"
                  style={{
                    fontFamily: T.font.sans,
                    fontWeight: 500,
                    color: T.ink.base,
                  }}
                >
                  {day}
                </span>
                <span className="mt-0.5 text-sm">{weekday}</span>
              </span>

              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex flex-wrap gap-1.5">
                  <EventTypeChip type={event.eventType} size="xs" />
                  <PriceBadge
                    isFree={event.isFree}
                    priceMin={event.priceMin}
                    priceMax={event.priceMax}
                    size="xs"
                  />
                </span>
                <h3
                  className="type-card-title m-0 line-clamp-2 transition-colors group-hover:text-(--t-accent-primary)"
                  style={{
                    color: T.ink.base,
                  }}
                >
                  {event.title}
                </h3>
                <span
                  className="mt-auto flex items-center gap-1.5 pt-1 text-sm"
                  style={{ color: T.ink.dim }}
                >
                  <Clock
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                    strokeWidth={1.8}
                  />
                  <time dateTime={event.startTime}>
                    <span className="sr-only">{longDate}, </span>
                    {time}
                  </time>
                </span>
                {place ? (
                  <span
                    className="flex min-w-0 items-start gap-1.5 text-sm leading-[1.4]"
                    style={{ color: T.ink.dim }}
                  >
                    <MapPin
                      aria-hidden="true"
                      className="mt-[2px] size-3.5 shrink-0"
                      strokeWidth={1.8}
                    />
                    <span className="line-clamp-2">{place}</span>
                  </span>
                ) : null}
              </span>
            </GlobalLink>
          </li>
        )
      })}
    </ul>
  )
}

UpcomingEventsWidget.displayName = "UpcomingEventsWidget"

export default UpcomingEventsWidget
