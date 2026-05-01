"use client"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

import {
  buildLibraryHref,
  formatCoord,
  getTodayHours,
  operationalLabel,
  TYPE_LABELS,
} from "./map.helpers"
import type { LibraryDetails, LibraryMapPin } from "./map.types"

// ── Props ─────────────────────────────────────────────────────────────────────

interface LibraryPinPanelProps {
  readonly pin: LibraryMapPin
  readonly details: LibraryDetails | null
  readonly heroImageUrl: string | null
  readonly onClose: () => void
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusChip({
  operationalStatus,
}: {
  operationalStatus?: string | null
}) {
  if (operationalStatus === "open") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          padding: "4px 10px",
          borderRadius: "999px",
          border: "1px solid rgba(52,211,153,.3)",
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".18em",
          textTransform: "uppercase",
          color: "#6ee7b7",
        }}
      >
        <span
          style={{
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            background: "#6ee7b7",
            flexShrink: 0,
          }}
        />
        Open
      </span>
    )
  }
  if (operationalStatus) {
    return (
      <span
        style={{
          padding: "4px 10px",
          borderRadius: "999px",
          border: "1px solid rgba(255,255,255,.12)",
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".18em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,.45)",
        }}
      >
        {operationalLabel(operationalStatus)}
      </span>
    )
  }

  return null
}

function MonoChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "999px",
        border: "1px solid rgba(255,255,255,.12)",
        fontFamily: T.font.mono,
        fontSize: "10px",
        letterSpacing: ".18em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,.5)",
      }}
    >
      {children}
    </span>
  )
}

function GoldChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "999px",
        border: `1px solid rgba(232,201,138,.3)`,
        fontFamily: T.font.mono,
        fontSize: "10px",
        letterSpacing: ".18em",
        textTransform: "uppercase",
        color: T.accent.gold,
      }}
    >
      {children}
    </span>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function LibraryPinPanel({
  pin,
  details,
  heroImageUrl,
  onClose,
}: LibraryPinPanelProps) {
  const todayHours = details?.openingTimes
    ? getTodayHours(details.openingTimes)
    : null
  const isFeatured = details?.featured ?? false
  const district = details?.district ?? null
  const foundedYear = details?.foundedYear ?? null

  const coordText =
    pin.location.lat != null && pin.location.lng != null
      ? formatCoord(pin.location.lat, pin.location.lng)
      : null

  const heroCrumbs = [
    details?.countryName ?? null,
    pin.city ?? null,
    district,
  ].filter(Boolean)

  const pillTags = [
    isFeatured ? "Pillar" : null,
    pin.libraryType ? (TYPE_LABELS[pin.libraryType] ?? pin.libraryType) : null,
  ].filter(Boolean)

  const statCells: { label: string; value: string }[] = []
  if (foundedYear) statCells.push({ label: "Founded", value: foundedYear })
  if (coordText) statCells.push({ label: "Coord.", value: coordText })

  const libraryHref = buildLibraryHref(pin)

  return (
    <div
      className="absolute top-4 right-4 z-20 flex max-h-[calc(100%-2rem)] w-[340px] flex-col overflow-hidden rounded-2xl shadow-2xl"
      style={{
        background: "var(--t-bg-deep)",
        border: "1px solid rgba(255,255,255,.09)",
      }}
    >
      {/* ── Hero image ───────────────────────────────────────────────────── */}
      <div
        className="relative flex-shrink-0"
        style={{ height: heroImageUrl ? "180px" : "0px" }}
      >
        {heroImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImageUrl}
              alt={pin.name}
              className="h-full w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(7,13,30,.15) 0%, rgba(7,13,30,.6) 65%, var(--t-bg-deep) 100%)",
              }}
            />

            {/* Top pill */}
            {pillTags.length > 0 && (
              <div className="absolute top-3 left-3">
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    borderRadius: "999px",
                    background: "rgba(7,13,30,.75)",
                    border: "1px solid rgba(232,201,138,.25)",
                    backdropFilter: "blur(8px)",
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    letterSpacing: ".2em",
                    textTransform: "uppercase",
                    color: T.accent.gold,
                  }}
                >
                  {isFeatured && (
                    <span
                      style={{
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: T.accent.gold,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {pillTags.join(" · ")}
                </span>
              </div>
            )}

            {/* Breadcrumb bottom */}
            {heroCrumbs.length > 0 && (
              <div className="absolute bottom-3 left-4">
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    letterSpacing: ".18em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,.55)",
                  }}
                >
                  {heroCrumbs.join(" › ")}
                </span>
              </div>
            )}
          </>
        ) : null}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white/60 backdrop-blur-sm transition-colors hover:border-white/40 hover:text-white"
          aria-label="Close"
        >
          <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
            <path
              d="M1 1l10 10M11 1L1 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* ── Scrollable body ──────────────────────────────────────────────── */}
      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        style={{ padding: "16px" }}
      >
        {/* Pill header when no hero image */}
        {!heroImageUrl && pillTags.length > 0 && (
          <div className="mb-2 flex items-center justify-between">
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".2em",
                textTransform: "uppercase",
                color: T.accent.gold,
              }}
            >
              {pillTags.join(" · ")}
            </span>
          </div>
        )}

        {/* Title */}
        <h3
          style={{
            fontFamily: T.font.serif,
            fontWeight: 400,
            fontSize: "28px",
            lineHeight: 1.1,
            letterSpacing: "-.02em",
            color: T.ink.base,
            margin: "0 0 10px",
          }}
        >
          {pin.name}.
        </h3>

        {/* Status / type chips */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <StatusChip operationalStatus={pin.operationalStatus} />
          {pin.libraryType ? (
            <MonoChip>
              {TYPE_LABELS[pin.libraryType] ?? pin.libraryType}
            </MonoChip>
          ) : null}
          {isFeatured ? <GoldChip>Pillar</GoldChip> : null}
        </div>

        {/* District */}
        {district ? (
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".15em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.3)",
              marginBottom: "12px",
            }}
          >
            · {district}
          </p>
        ) : null}

        {/* Summary */}
        {pin.summary ? (
          <p
            style={{
              fontSize: "13.5px",
              lineHeight: "1.6",
              color: "rgba(255,255,255,.58)",
              marginBottom: "14px",
            }}
          >
            {pin.summary}
          </p>
        ) : null}

        {/* Stats grid */}
        {statCells.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: statCells.length === 1 ? "1fr" : "1fr 1fr",
              gap: "1px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,.08)",
              background: "rgba(255,255,255,.08)",
              overflow: "hidden",
              marginBottom: "10px",
            }}
          >
            {statCells.map((cell) => (
              <div
                key={cell.label}
                style={{
                  background: "rgba(7,13,30,1)",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".2em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,.32)",
                  }}
                >
                  {cell.label}
                </span>
                <span
                  style={{
                    fontFamily: T.font.serif,
                    fontSize: "20px",
                    lineHeight: 1.1,
                    color: T.ink.base,
                  }}
                >
                  {cell.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {/* Today hours */}
        {todayHours ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 14px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,.08)",
              background: "rgba(255,255,255,.03)",
              marginBottom: "14px",
            }}
          >
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".2em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,.32)",
                flexShrink: 0,
              }}
            >
              Today
            </span>
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "12px",
                color: T.accent.aurora,
                letterSpacing: ".06em",
              }}
            >
              {todayHours.timeRange}
            </span>
            {todayHours.closesIn ? (
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "11px",
                  color: "rgba(255,255,255,.35)",
                  letterSpacing: ".04em",
                  marginLeft: "auto",
                }}
              >
                · {todayHours.closesIn}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="flex-1" />

        {/* CTA row */}
        <div className="flex gap-2">
          {libraryHref ? (
            <GlobalLink
              href={libraryHref}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "12px 16px",
                borderRadius: "14px",
                border: `1px solid rgba(127,223,255,.25)`,
                background: "rgba(127,223,255,.07)",
                fontFamily: T.font.sans,
                fontWeight: 500,
                fontSize: "13.5px",
                color: T.accent.aurora,
                transition: "background 150ms, border-color 150ms",
              }}
              className="hover:border-[rgba(127,223,255,.45)] hover:bg-[rgba(127,223,255,.12)]"
            >
              Explore {pin.name}
              <svg
                viewBox="0 0 12 12"
                fill="none"
                style={{ width: "11px", height: "11px" }}
              >
                <path
                  d="M2 10L10 2M10 2H4M10 2v6"
                  stroke={T.accent.aurora}
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </GlobalLink>
          ) : null}

          {pin.location.lat != null && pin.location.lng != null ? (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${pin.location.lat},${pin.location.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "44px",
                flexShrink: 0,
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,.1)",
                background: "rgba(255,255,255,.04)",
                color: "rgba(255,255,255,.45)",
                transition: "border-color 150ms, background 150ms",
              }}
              className="hover:border-white/20 hover:bg-white/8 hover:text-white/70"
              title="Get directions"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                style={{ width: "14px", height: "14px" }}
              >
                <circle
                  cx="8"
                  cy="6"
                  r="2.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <path
                  d="M8 2C5.79 2 4 3.79 4 6c0 3 4 8 4 8s4-5 4-8c0-2.21-1.79-4-4-4z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default LibraryPinPanel
