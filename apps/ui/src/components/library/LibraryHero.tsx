"use client"

import Image from "next/image"

import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  open_now: {
    label: "Open Now",
    dot: "bg-emerald-400",
    badge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  },
  closed: {
    label: "Closed",
    dot: "bg-white/30",
    badge: "border-white/10 bg-white/[0.06] text-white/50",
  },
  temporarily_closed: {
    label: "Temporarily Closed",
    dot: "bg-amber-400",
    badge: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  },
  permanently_closed: {
    label: "Permanently Closed",
    dot: "bg-red-400",
    badge: "border-red-500/30 bg-red-500/15 text-red-300",
  },
  seasonal: {
    label: "Seasonal",
    dot: "bg-sky-400",
    badge: "border-sky-500/30 bg-sky-500/15 text-sky-300",
  },
  appointment_only: {
    label: "By Appointment",
    dot: "bg-violet-400",
    badge: "border-violet-500/30 bg-violet-500/15 text-violet-300",
  },
  planned: {
    label: "Planned",
    dot: "bg-blue-400",
    badge: "border-blue-500/30 bg-blue-500/15 text-blue-300",
  },
  unknown: {
    label: "Status Unknown",
    dot: "bg-white/30",
    badge: "border-white/10 bg-white/6 text-white/40",
  },
} as const

// ── Real-time open/closed logic ───────────────────────────────────────────────

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const
const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

type TimeframeEntry = { startTime: string; endTime: string }
type DayEntry = { day: string; enabled: boolean; timeframes: TimeframeEntry[] }

const to12h = (time: string): string => {
  const [h = 0, m = 0] = time.split(":").map(Number)
  const suffix = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12

  return `${hour}:${m.toString().padStart(2, "0")} ${suffix}`
}

const toMinutes = (time: string): number => {
  const [h = 0, m = 0] = time.split(":").map(Number)

  return h * 60 + m
}

type RealtimeStatus = {
  isOpenNow: boolean
  hoursText: string | null // "9:00 AM — 5:00 PM" when open
  nextOpenText: string | null // "Opens tomorrow at 9:00 AM" when closed
}

function getRealtimeStatus(openingTimes: unknown): RealtimeStatus {
  if (!openingTimes || typeof openingTimes !== "object") {
    return { isOpenNow: false, hoursText: null, nextOpenText: null }
  }
  const data = openingTimes as { days?: DayEntry[] }
  if (!Array.isArray(data.days)) {
    return { isOpenNow: false, hoursText: null, nextOpenText: null }
  }

  const now = new Date()
  const todayIndex = now.getDay()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const dayMap = new Map(data.days.map((d) => [d.day, d]))

  // Check if currently within a timeframe today
  const todayEntry = dayMap.get(DAY_KEYS[todayIndex] ?? "")
  if (todayEntry?.enabled && todayEntry.timeframes?.length) {
    for (const tf of todayEntry.timeframes) {
      if (
        currentMinutes >= toMinutes(tf.startTime) &&
        currentMinutes < toMinutes(tf.endTime)
      ) {
        const first = todayEntry.timeframes[0]!
        const last = todayEntry.timeframes.at(-1)!

        return {
          isOpenNow: true,
          hoursText: `${to12h(first.startTime)} — ${to12h(last.endTime)}`,
          nextOpenText: null,
        }
      }
    }

    // Closed now — check if a later timeframe opens today
    for (const tf of todayEntry.timeframes) {
      if (toMinutes(tf.startTime) > currentMinutes) {
        return {
          isOpenNow: false,
          hoursText: null,
          nextOpenText: `Opens today at ${to12h(tf.startTime)}`,
        }
      }
    }
  }

  // Look ahead up to 7 days for the next open day
  for (let offset = 1; offset <= 7; offset++) {
    const nextIndex = (todayIndex + offset) % 7
    const nextEntry = dayMap.get(DAY_KEYS[nextIndex] ?? "")
    if (nextEntry?.enabled && nextEntry.timeframes?.length) {
      const label = offset === 1 ? "tomorrow" : DAY_LABELS[nextIndex]

      return {
        isOpenNow: false,
        hoursText: null,
        nextOpenText: `Opens ${label} at ${to12h(nextEntry.timeframes[0]!.startTime)}`,
      }
    }
  }

  return { isOpenNow: false, hoursText: null, nextOpenText: null }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LibraryHero({
  library,
  tabNav,
  breadcrumb,
}: {
  readonly library: PopulatedLibraryData
  readonly tabNav?: React.ReactNode
  readonly breadcrumb?: React.ReactNode
}) {
  const imageUrl = formatStrapiMediaUrl(library.heroImage?.url)

  // operationalStatus is the library's structural state (open / temporarily_closed / etc.)
  // Only when it's "open" do we check real-time opening hours for a live open/closed badge.
  const operationalStatus = library.operationalStatus as
    | string
    | null
    | undefined
  const isGenerallyOpen = !operationalStatus || operationalStatus === "open"
  const realtime = isGenerallyOpen
    ? getRealtimeStatus(library.openingTimes)
    : null

  const statusKey = isGenerallyOpen
    ? realtime?.isOpenNow
      ? "open_now"
      : "closed"
    : ((operationalStatus ?? "unknown") as keyof typeof STATUS_CONFIG)
  const status = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.unknown

  const statusSubtext = realtime?.isOpenNow
    ? realtime.hoursText
    : (realtime?.nextOpenText ?? null)

  const ctaLinks = [
    library.virtualTourUrl && {
      href: library.virtualTourUrl,
      label: "Virtual Tour",
      primary: false,
    },
    library.planVisitUrl && {
      href: library.planVisitUrl,
      label: "Plan Your Visit",
      primary: false,
    },
    !library.planVisitUrl &&
      library.website && {
        href: library.website,
        label: "Visit Website",
        primary: true,
      },
  ].filter(Boolean) as { href: string; label: string; primary: boolean }[]

  return (
    <section className="relative isolate flex min-h-[65vh] flex-col justify-end overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 -z-10">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={library.heroImage?.alternativeText ?? library.name}
            fill
            priority
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(180deg,rgba(12,18,40,1),rgba(5,8,22,1))]" />
        )}
        {/* Dark overlay — lighter at the bottom so the image is visible behind the tab bar */}
        <div className="absolute inset-0 bg-[#050816]/38" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.2)_0%,rgba(5,8,22,0.38)_45%,rgba(5,8,22,0.62)_78%,rgba(5,8,22,0.62)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,8,22,0.62)_0%,transparent_68%)]" />
      </div>

      <Container className="py-10 sm:py-14">
        <div className="flex flex-col gap-5">
          {/* Breadcrumb */}
          {breadcrumb ? <div>{breadcrumb}</div> : null}

          {/* Status + hours */}
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase",
                status.badge
              )}
            >
              <span className={cn("size-1.5 rounded-full", status.dot)} />
              {status.label}
            </span>
            {statusSubtext ? (
              <span className="text-sm text-white/50">{statusSubtext}</span>
            ) : null}
          </div>

          {/* Title */}
          <h1 className="text-[clamp(3rem,7.5vw,6rem)] leading-[0.92] font-bold tracking-[-0.04em] text-white [text-shadow:0_2px_32px_rgba(0,0,0,0.5)]">
            {library.name}
          </h1>

          {/* Summary + CTAs row */}
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
            {library.summary ? (
              <p className="max-w-[46ch] text-[15px] leading-7 text-white/60 sm:text-base">
                {library.summary}
              </p>
            ) : (
              <span />
            )}

            {ctaLinks.length > 0 ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                {ctaLinks.map((cta) => (
                  <GlobalLink
                    key={cta.href}
                    href={cta.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none",
                      cta.primary
                        ? "bg-indigo-500 text-white shadow-[0_4px_24px_rgba(99,102,241,0.35)] hover:bg-indigo-400"
                        : "border border-white/12 bg-white/8 text-white backdrop-blur-sm hover:bg-white/14"
                    )}
                  >
                    {cta.label}
                  </GlobalLink>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </Container>

      {/* Tab nav pinned to hero bottom — becomes sticky on scroll */}
      {tabNav ? <div className="relative z-10">{tabNav}</div> : null}
    </section>
  )
}

LibraryHero.displayName = "LibraryHero"

export default LibraryHero
