"use client"

import Image from "next/image"

import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

import { LibraryClaimButton } from "./LibraryClaimButton"
import { LibraryFollowButton } from "./LibraryFollowButton"

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

const to24h = (time: string): string => {
  const [h = 0, m = 0] = time.split(":").map(Number)

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

const toMinutes = (time: string): number => {
  const [h = 0, m = 0] = time.split(":").map(Number)

  return h * 60 + m
}

type RealtimeStatus = {
  isOpenNow: boolean
  hoursText: string | null
  nextOpenText: string | null
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
          hoursText: `${to24h(first.startTime)} – ${to24h(last.endTime)}`,
          nextOpenText: null,
        }
      }
    }
    for (const tf of todayEntry.timeframes) {
      if (toMinutes(tf.startTime) > currentMinutes) {
        return {
          isOpenNow: false,
          hoursText: null,
          nextOpenText: `Opens today at ${to24h(tf.startTime)}`,
        }
      }
    }
  }

  for (let offset = 1; offset <= 7; offset++) {
    const nextIndex = (todayIndex + offset) % 7
    const nextEntry = dayMap.get(DAY_KEYS[nextIndex] ?? "")
    if (nextEntry?.enabled && nextEntry.timeframes?.length) {
      const label = offset === 1 ? "tomorrow" : DAY_LABELS[nextIndex]

      return {
        isOpenNow: false,
        hoursText: null,
        nextOpenText: `Opens ${label} at ${to24h(nextEntry.timeframes[0]!.startTime)}`,
      }
    }
  }

  return { isOpenNow: false, hoursText: null, nextOpenText: null }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LibraryHero({
  library,
  breadcrumb,
}: {
  readonly library: PopulatedLibraryData
  readonly breadcrumb?: React.ReactNode
}) {
  const imageUrl = formatStrapiMediaUrl(library.heroImage?.url)

  const operationalStatus = library.operationalStatus as
    | string
    | null
    | undefined
  const isGenerallyOpen = !operationalStatus || operationalStatus === "open"
  const realtime = isGenerallyOpen
    ? getRealtimeStatus(library.openingTimes)
    : null

  const isOpenNow = isGenerallyOpen && (realtime?.isOpenNow ?? false)
  const statusSubtext = realtime?.isOpenNow
    ? realtime.hoursText
    : (realtime?.nextOpenText ?? null)

  // Meta strip items: city · postcode · coords
  const locationCoords =
    library.location != null &&
    typeof library.location === "object" &&
    !Array.isArray(library.location)
      ? (library.location as { lat?: unknown; lng?: unknown })
      : null
  const hasCoords = locationCoords?.lat != null && locationCoords?.lng != null

  const cityPostcode = [library.city, library.postalCode]
    .filter(Boolean)
    .join(" · ")
  const coordsText = hasCoords
    ? `${Number(locationCoords!.lat).toFixed(4)}° N ${Math.abs(Number(locationCoords!.lng)).toFixed(4)}° W`
    : null

  const metaItems = [cityPostcode || null, coordsText].filter(
    Boolean
  ) as string[]

  // Type tags shown beside the status chip
  const typeTags = [
    library.libraryType,
    library.foundedYear ? `Est. ${library.foundedYear}` : null,
  ].filter(Boolean) as string[]

  // Primary CTA
  const primaryCta = library.planVisitUrl
    ? { href: library.planVisitUrl, label: "Plan your visit →" }
    : library.website
      ? { href: library.website, label: "Visit website →" }
      : null

  return (
    <section
      data-transparent-header=""
      className="relative isolate -mt-14 flex flex-col overflow-hidden"
      style={{ minHeight: "640px" }}
    >
      {/* Background */}
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
        <div
          className="absolute inset-0"
          style={{ background: "var(--library-hero-main-overlay)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "var(--library-hero-side-overlay)" }}
        />
      </div>

      <Container className="flex flex-1 flex-col gap-5 pt-[110px] pb-14">
        {/* Breadcrumb */}
        {breadcrumb ? <div>{breadcrumb}</div> : null}

        {/* Status + type chip row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          {/* Open/closed chip */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 12px",
              borderRadius: "999px",
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".22em",
              textTransform: "uppercase",
              border: isOpenNow
                ? "1px solid rgba(110,231,183,.35)"
                : "1px solid rgba(255,255,255,.1)",
              background: isOpenNow
                ? "rgba(110,231,183,.08)"
                : "rgba(255,255,255,.04)",
              color: isOpenNow ? "#6ee7b7" : "rgba(255,255,255,.48)",
            }}
          >
            {isOpenNow ? (
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#6ee7b7",
                  boxShadow: "0 0 10px #6ee7b7",
                  flexShrink: 0,
                  animation: "pulse 2.4s ease-in-out infinite",
                }}
              />
            ) : null}
            {isOpenNow ? "Open Now" : "Closed"}
          </span>

          {/* Hours sub-text */}
          {statusSubtext ? (
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "12px",
                color: "rgba(255,255,255,.65)",
                letterSpacing: ".08em",
              }}
            >
              <strong style={{ color: "#ffffff", fontWeight: 500 }}>
                {isOpenNow && realtime?.hoursText
                  ? realtime.hoursText
                  : statusSubtext}
              </strong>
            </span>
          ) : null}

          {/* Type tags */}
          {typeTags.length > 0 ? (
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "11px",
                color: "rgba(255,255,255,.40)",
                letterSpacing: ".1em",
                textTransform: "uppercase",
              }}
            >
              · {typeTags.join(" · ")}
            </span>
          ) : null}
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily: T.font.serif,
            fontWeight: 400,
            fontSize: "clamp(56px,8.4vw,128px)",
            lineHeight: 0.92,
            letterSpacing: "-.045em",
            margin: 0,
            color: "#ffffff",
            textWrap: "balance",
          }}
        >
          {library.name}
        </h1>

        {/* Summary — serif light */}
        {library.summary ? (
          <p
            style={{
              fontFamily: T.font.serif,
              fontWeight: 300,
              fontSize: "22px",
              lineHeight: "1.5",
              color: "rgba(255,255,255,.72)",
              maxWidth: "58ch",
              margin: 0,
              letterSpacing: "-.01em",
            }}
          >
            {library.summary}
          </p>
        ) : null}

        {/* Bottom row: meta strip + CTAs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "24px",
            flexWrap: "wrap",
            paddingBottom: "0",
          }}
        >
          {metaItems.length > 0 ? (
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "12.5px",
                color: "rgba(255,255,255,.48)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                flexWrap: "wrap",
                margin: 0,
              }}
            >
              {metaItems.map((item, i) => (
                <span
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  {i > 0 && (
                    <span style={{ color: "rgba(255,255,255,.18)" }}>·</span>
                  )}
                  {item}
                </span>
              ))}
            </p>
          ) : (
            <span />
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            {/* Follow button */}
            {library.documentId && (
              <LibraryFollowButton
                libraryDocumentId={library.documentId as string}
                libraryName={library.name ?? "this library"}
              />
            )}

            {/* Claim button */}
            <LibraryClaimButton
              libraryDocumentId={library.documentId ?? ""}
              librarySlug={library.slug ?? ""}
              libraryName={library.name ?? "this library"}
              libraryEntityRef={library.entityRef ?? undefined}
            />

            {/* Primary CTA */}
            {primaryCta ? (
              <GlobalLink
                href={primaryCta.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 22px",
                  borderRadius: "14px",
                  background: "#ffffff",
                  color: "#0a0f2a",
                  fontWeight: 500,
                  fontSize: "14px",
                  flexShrink: 0,
                  transition: "background 200ms",
                }}
                className="hover:bg-white"
              >
                {primaryCta.label}
              </GlobalLink>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  )
}

LibraryHero.displayName = "LibraryHero"

export default LibraryHero
