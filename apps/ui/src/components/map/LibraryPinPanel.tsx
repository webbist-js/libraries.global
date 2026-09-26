"use client"

import GlobalLink from "@/components/global/GlobalLink"
import { T, tintForLibraryType, TYPE_TINT } from "@/lib/design-tokens"

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

const chipBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: "4px 10px",
  borderRadius: "999px",
  fontFamily: T.font.sans,
  fontSize: "12.5px",
  fontWeight: 600,
}

function StatusChip({
  operationalStatus,
}: {
  operationalStatus?: string | null
}) {
  if (!operationalStatus) return null
  const isOpen = operationalStatus === "open"
  const tint = isOpen ? TYPE_TINT.public : TYPE_TINT.neutral

  return (
    <span style={{ ...chipBase, background: tint.bg, color: tint.fg }}>
      <span
        aria-hidden
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: "currentColor",
          flexShrink: 0,
        }}
      />
      {operationalLabel(operationalStatus)}
    </span>
  )
}

function TypeChip({ libraryType }: { libraryType: string }) {
  const label = TYPE_LABELS[libraryType] ?? libraryType
  const tint = tintForLibraryType(label)

  return (
    <span style={{ ...chipBase, background: tint.bg, color: tint.fg }}>
      {label}
    </span>
  )
}

function PillarChip() {
  return (
    <span style={{ ...chipBase, background: "#F5EEDC", color: "#6B5420" }}>
      Pillar
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

  const statCells: { label: string; value: string }[] = []
  if (foundedYear) statCells.push({ label: "Founded", value: foundedYear })
  if (coordText) statCells.push({ label: "Coordinates", value: coordText })

  const libraryHref = buildLibraryHref(pin)

  return (
    <div
      className="absolute top-4 right-4 z-20 flex max-h-[calc(100%-2rem)] w-[340px] flex-col overflow-hidden rounded-[20px]"
      style={{
        background: "#fff",
        border: `1px solid ${T.border.line}`,
        boxShadow: "0 12px 28px rgba(23,22,43,.08)",
      }}
    >
      {/* ── Hero image ───────────────────────────────────────────────────── */}
      <div
        className="relative flex-shrink-0"
        style={{ height: heroImageUrl ? "170px" : "0px" }}
      >
        {heroImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImageUrl}
              alt={pin.name}
              className="h-full w-full object-cover"
            />

            {/* Top pill */}
            {(isFeatured || pin.libraryType) && (
              <div className="absolute top-3 left-3 flex gap-1.5">
                {isFeatured ? <PillarChip /> : null}
                {pin.libraryType ? (
                  <TypeChip libraryType={pin.libraryType} />
                ) : null}
              </div>
            )}

            {/* Breadcrumb bottom */}
            {heroCrumbs.length > 0 && (
              <div className="absolute bottom-2 left-3">
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 9px",
                    borderRadius: "999px",
                    background: "rgba(255,255,255,.88)",
                    fontFamily: T.font.sans,
                    fontSize: "12px",
                    fontWeight: 500,
                    color: T.ink.dim,
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
          className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full transition-colors"
          style={{
            background: "rgba(255,255,255,.92)",
            border: `1px solid ${T.border.hi}`,
            color: T.ink.dim,
          }}
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
        {/* Title */}
        <h3
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            fontSize: "26px",
            lineHeight: 1.12,
            letterSpacing: "-.01em",
            color: T.ink.base,
            margin: "0 0 10px",
          }}
        >
          {pin.name}
        </h3>

        {/* Status / type chips (type shown here when no hero image) */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <StatusChip operationalStatus={pin.operationalStatus} />
          {!heroImageUrl && pin.libraryType ? (
            <TypeChip libraryType={pin.libraryType} />
          ) : null}
          {!heroImageUrl && isFeatured ? <PillarChip /> : null}
        </div>

        {/* District */}
        {district ? (
          <p
            style={{
              fontFamily: T.font.sans,
              fontSize: "13px",
              color: T.ink.low,
              marginBottom: "12px",
            }}
          >
            {district}
          </p>
        ) : null}

        {/* Summary */}
        {pin.summary ? (
          <p
            style={{
              fontSize: "14px",
              lineHeight: "1.6",
              color: T.ink.dim,
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
              border: `1px solid ${T.border.line}`,
              background: T.border.line,
              overflow: "hidden",
              marginBottom: "10px",
            }}
          >
            {statCells.map((cell) => (
              <div
                key={cell.label}
                style={{
                  background: T.bg.surface,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    fontFamily: T.font.sans,
                    fontSize: "12px",
                    fontWeight: 600,
                    color: T.ink.low,
                  }}
                >
                  {cell.label}
                </span>
                <span
                  style={{
                    fontFamily:
                      cell.label === "Coordinates" ? T.font.mono : T.font.serif,
                    fontSize: cell.label === "Coordinates" ? "12px" : "20px",
                    lineHeight: 1.2,
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
              background: todayHours.isOpen ? TYPE_TINT.public.bg : T.bg.muted,
              marginBottom: "14px",
            }}
          >
            <span
              style={{
                fontFamily: T.font.sans,
                fontSize: "12.5px",
                fontWeight: 700,
                color: todayHours.isOpen ? TYPE_TINT.public.fg : T.ink.dim,
                flexShrink: 0,
              }}
            >
              Today
            </span>
            <span
              style={{
                fontFamily: T.font.sans,
                fontSize: "13px",
                fontWeight: 600,
                color: todayHours.isOpen ? TYPE_TINT.public.fg : T.ink.dim,
              }}
            >
              {todayHours.timeRange}
            </span>
            {todayHours.closesIn ? (
              <span
                style={{
                  fontFamily: T.font.sans,
                  fontSize: "12.5px",
                  color: todayHours.isOpen ? TYPE_TINT.public.fg : T.ink.low,
                  marginLeft: "auto",
                }}
              >
                {todayHours.closesIn}
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
                borderRadius: "999px",
                border: "none",
                background: T.accent.primary,
                fontFamily: T.font.sans,
                fontWeight: 600,
                fontSize: "14px",
                color: "#fff",
                transition: "background 150ms",
              }}
              className="hover:bg-(--t-accent-primary-hover)"
            >
              Explore {pin.name}
              <svg
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden
                style={{ width: "11px", height: "11px" }}
              >
                <path
                  d="M2 10L10 2M10 2H4M10 2v6"
                  stroke="#fff"
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
                borderRadius: "999px",
                border: `1px solid ${T.border.hi}`,
                background: "#fff",
                color: T.ink.dim,
                transition: "border-color 150ms, background 150ms",
              }}
              className="hover:bg-(--t-bg-muted)"
              title="Get directions"
              aria-label="Get directions"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
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
