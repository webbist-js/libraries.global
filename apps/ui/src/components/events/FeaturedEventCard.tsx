import { Icon } from "@iconify/react"

import { EVENT_TYPE_META } from "@/components/events/EventTypeChip"
import type { FeaturedEvent } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

// ── Provider colours (match ProviderBreakdownBar) ──────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  eventbrite: "Eventbrite",
  ical: "iCal Feed",
  custom_ical: "iCal Feed",
  ticketsource: "TicketSource",
  wegottickets: "WeGotTickets",
  spydus: "Spydus",
  solus: "Solus",
  aspen: "Aspen",
}

const PROVIDER_COLORS: Record<string, string> = {
  eventbrite: "#f05537",
  ical: "#7fdfff",
  custom_ical: "#7fdfff",
  ticketsource: "#e06060",
  wegottickets: "#d97706",
  spydus: "#b45309",
  solus: "#7e22ce",
  aspen: "#0c6fad",
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function getDateLabel(startTime: string): string {
  const event = new Date(startTime)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const eventDay = new Date(event)
  eventDay.setHours(0, 0, 0, 0)

  if (eventDay.getTime() === today.getTime()) {
    return event.getHours() >= 12 ? "Tonight" : "Today"
  }
  if (eventDay.getTime() === tomorrow.getTime()) return "Tomorrow"

  const diff = Math.round(
    (eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diff > 0 && diff <= 6)
    return event.toLocaleDateString("en-GB", { weekday: "long" })

  return event.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function formatDateBlock(startTime: string): {
  dowMonth: string
  day: string
  yearTime: string
} {
  const d = new Date(startTime)
  const dow = d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()
  const month = d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase()
  const day = String(d.getDate()).padStart(2, "0")
  const year = d.getFullYear()
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  return {
    dowMonth: `${dow} · ${month}`,
    day,
    yearTime: `${year} · ${time}`,
  }
}

function formatPrice(
  isFree: boolean,
  priceMin?: number | null,
  priceMax?: number | null
): string {
  if (isFree) return "Free"
  if (priceMin == null && priceMax == null) return "See website"
  if (priceMin != null && priceMax != null && priceMin !== priceMax)
    return `£${priceMin} – £${priceMax}`
  if (priceMin != null) return `From £${priceMin}`

  return `£${priceMax}`
}

// ── Subcomponents ──────────────────────────────────────────────────────────────

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col gap-1 rounded-xl px-4 py-3"
      style={{
        border: `1px solid ${T.border.line}`,
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: T.ink.faint,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "12px",
          color: T.ink.dim,
          lineHeight: 1.3,
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function FeaturedEventCard({ event }: { event: FeaturedEvent }) {
  const typeMeta = EVENT_TYPE_META[event.eventType] ?? EVENT_TYPE_META.other!
  const linkUrl = event.url
  const { dowMonth, day, yearTime } = formatDateBlock(event.startTime)
  const dateLabel = getDateLabel(event.startTime)
  const priceLabel = formatPrice(event.isFree, event.priceMin, event.priceMax)

  const providerLabel =
    PROVIDER_LABELS[event.sourceProvider ?? ""] ?? event.sourceProvider ?? null
  const providerColor =
    PROVIDER_COLORS[event.sourceProvider ?? ""] ?? T.accent.aurora
  const shortId = event.documentId.slice(-6).toUpperCase()

  // Library breadcrumb
  const libraryLabel = event.libraryName ?? event.libraryEntityRef ?? null
  const cityLabel = event.libraryCity ?? null

  const calUrl = `data:text/calendar;charset=utf8,BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ASUMMARY:${encodeURIComponent(event.title)}%0ADTSTART:${new Date(event.startTime).toISOString().replaceAll(/[-:]/g, "").slice(0, 15)}Z%0AURL:${encodeURIComponent(event.url)}%0AEND:VEVENT%0AEND:VCALENDAR`

  return (
    <div
      className="overflow-hidden rounded-3xl"
      style={{
        border: `1px solid ${T.border.hi}`,
        background: T.bg.deep,
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* ── Left: image panel ─────────────────────────────────────────── */}
        <div className="relative" style={{ minHeight: "340px" }}>
          {event.imageUrl ? (
            <>
              {/* Real image — desaturated slightly to keep the dark aesthetic */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.imageUrl}
                alt={event.title}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ filter: "saturate(0.7) brightness(0.85)" }}
              />
              {/* Vignette — only needed over a photo to darken for text legibility */}
              <div
                className="absolute inset-0"
                style={{
                  background: `
                    linear-gradient(to bottom,
                      rgba(5,8,22,0.72) 0%,
                      rgba(5,8,22,0) 35%,
                      rgba(5,8,22,0) 55%,
                      rgba(5,8,22,0.82) 100%
                    )
                  `,
                }}
              />
            </>
          ) : (
            /* Gradient placeholder — no vignette needed; the dark base is sufficient */
            <div
              className="absolute inset-0"
              style={{
                background: `
                  radial-gradient(ellipse 90% 70% at 20% 30%, rgba(127,223,255,0.13), transparent 60%),
                  radial-gradient(ellipse 70% 90% at 75% 75%, rgba(163,144,255,0.10), transparent 55%),
                  radial-gradient(ellipse 50% 50% at 55% 20%, rgba(232,201,138,0.06), transparent 50%),
                  linear-gradient(160deg, #08101f 0%, #060c1a 60%, #070b1e 100%)
                `,
              }}
            />
          )}

          {/* Right-edge fade into the details panel — always present */}
          <div
            className="absolute inset-y-0 right-0 hidden w-16 lg:block"
            style={{
              background: `linear-gradient(to right, transparent, ${T.bg.deep})`,
            }}
          />

          {/* Top row: featured pill (left) + date block (right) */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-5 sm:p-6">
            {/* Featured · date label pill */}
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".2em",
                textTransform: "uppercase",
                borderColor: "rgba(142,240,179,0.3)",
                background: "rgba(142,240,179,0.08)",
                color: T.accent.ok,
              }}
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: T.accent.ok }}
              />
              Featured · {dateLabel}
            </div>

            {/* Date block */}
            <div className="text-right" style={{ fontFamily: T.font.mono }}>
              <p
                style={{
                  fontSize: "10px",
                  letterSpacing: ".2em",
                  color: T.ink.faint,
                  textTransform: "uppercase",
                }}
              >
                {dowMonth}
              </p>
              <p
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "clamp(3rem, 7vw, 4.5rem)",
                  lineHeight: 0.9,
                  color: T.ink.base,
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                }}
              >
                {day}
              </p>
              <p
                style={{
                  fontSize: "10px",
                  letterSpacing: ".14em",
                  color: T.ink.low,
                  marginTop: "4px",
                }}
              >
                {yearTime}
              </p>
            </div>
          </div>

          {/* Tags — overlaid on image, bottom-left */}
          {event.tags && event.tags.length > 0 ? (
            <div className="absolute bottom-5 left-5 flex flex-wrap gap-1.5 sm:bottom-6 sm:left-6">
              {event.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border px-2.5 py-1"
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: T.ink.dim,
                    borderColor: "rgba(255,255,255,0.14)",
                    background: "rgba(0,0,0,0.35)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* ── Right: details panel ──────────────────────────────────────── */}
        <div
          className="flex flex-col gap-5 p-6 sm:p-8 lg:p-10"
          style={{ background: T.bg.deep }}
        >
          {/* Breadcrumb: type square + label · library · city */}
          <div
            className="flex flex-wrap items-center gap-x-2 gap-y-1"
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".18em",
              textTransform: "uppercase",
            }}
          >
            <span
              className="inline-block size-2 shrink-0 rounded-sm"
              style={{ background: typeMeta.color }}
            />
            <span style={{ color: typeMeta.color }}>{typeMeta.label}</span>

            {libraryLabel ? (
              <>
                <span style={{ color: T.ink.faint }}>·</span>
                <span style={{ color: T.ink.low }}>{libraryLabel}</span>
              </>
            ) : null}

            {cityLabel ? (
              <>
                <span style={{ color: T.ink.faint }}>·</span>
                <span style={{ color: T.ink.faint }}>{cityLabel}</span>
              </>
            ) : null}
          </div>

          {/* Title */}
          <a
            href={`/events/${event.documentId}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <h2
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(1.5rem, 2.6vw, 2.1rem)",
                lineHeight: 1.1,
                letterSpacing: "-0.01em",
                color: T.ink.base,
                fontWeight: 400,
              }}
            >
              {event.title}
            </h2>
          </a>

          {/* Description */}
          {event.description ? (
            <p
              className="line-clamp-3 text-sm leading-relaxed"
              style={{ color: T.ink.low, maxWidth: "48ch" }}
            >
              {event.description}
            </p>
          ) : null}

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-2">
            <MetaCell
              label="Time"
              value={
                event.allDay
                  ? "All day"
                  : `${new Date(event.startTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}${event.timezone ? ` · ${event.timezone}` : ""}`
              }
            />
            <MetaCell label="Venue" value={libraryLabel ?? "See event page"} />
            <MetaCell label="Price" value={priceLabel} />
            <MetaCell label="Format" value={typeMeta.label} />
          </div>

          {/* CTAs + provider attribution */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{
                background: T.ink.base,
                color: T.bg.void,
                textDecoration: "none",
                fontFamily: T.font.sans,
              }}
            >
              Reserve
              <Icon icon="mdi:arrow-right" className="size-4" />
            </a>
            <a
              href={calUrl}
              download="event.ics"
              className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm transition-colors hover:border-(--t-border-hi) hover:text-(--t-ink-base)"
              style={{
                borderColor: T.border.line,
                color: T.ink.dim,
                textDecoration: "none",
                fontFamily: T.font.sans,
              }}
            >
              <Icon icon="mdi:calendar-plus-outline" className="size-4" />
              Add to calendar
            </a>

            {/* Provider attribution */}
            {providerLabel ? (
              <div
                className="ml-auto flex items-center gap-1.5"
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                }}
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: providerColor }}
                />
                Via {providerLabel}
                <span style={{ color: T.ink.faint }}>·</span>
                <span>ID {shortId}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
