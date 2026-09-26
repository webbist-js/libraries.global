// apps/ui/src/components/index-page/FindCards.tsx
"use client"

import { T, TYPE_TINT } from "@/lib/design-tokens"
import { type LibrarySearchHitV2, buildLibraryPath } from "@/lib/meilisearch"
import { Link } from "@/lib/navigation"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

import {
  type OpenStatus,
  groupForLibraryType,
  openStatus,
} from "./find-helpers"

function statusBadge(hit: LibrarySearchHitV2, status: OpenStatus) {
  if (hit.operationalStatus === "permanently_closed") {
    return {
      label: "Permanently closed",
      bg: "var(--t-danger-soft)",
      fg: T.accent.danger,
    }
  }
  if (status.known && status.open) {
    return {
      label: status.until ? `Open until ${status.until}` : "Open now",
      bg: TYPE_TINT.public.bg,
      fg: TYPE_TINT.public.fg,
    }
  }
  if (status.known) {
    return { label: "Closed now", bg: T.bg.muted, fg: T.ink.dim }
  }

  return { label: "Hours not added yet", bg: T.bg.muted, fg: T.ink.dim }
}

function locationLine(hit: LibrarySearchHitV2, distanceKmValue?: number) {
  const parts = [hit.city, hit.region_name, hit.country_name].filter(Boolean)
  const base = parts.join(", ")

  return distanceKmValue != null
    ? `${base} · ${distanceKmValue < 10 ? distanceKmValue.toFixed(1) : Math.round(distanceKmValue)} km`
    : base
}

function Monogram({
  hit,
  size,
  radius,
}: {
  hit: LibrarySearchHitV2
  size: "card" | "row"
  radius: number
}) {
  const tint = TYPE_TINT[groupForLibraryType(hit.libraryType)]
  const photo = formatStrapiMediaUrl(
    hit.heroImage?.formats?.small?.url ?? hit.heroImage?.url ?? null
  )

  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        className="h-full w-full object-cover"
        style={{ borderRadius: radius }}
        loading="lazy"
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      className="flex h-full w-full items-center justify-center"
      style={{ background: tint.bg, borderRadius: radius }}
    >
      <span
        style={{
          fontFamily: T.font.serif,
          fontSize: size === "card" ? 60 : 24,
          fontWeight: 500,
          color: tint.fg,
        }}
      >
        {(hit.name ?? "?").charAt(0)}
      </span>
    </div>
  )
}

export function LibraryResultCard({
  hit,
  distanceKmValue,
  now,
}: {
  hit: LibrarySearchHitV2
  distanceKmValue?: number
  now?: Date
}) {
  const tint = TYPE_TINT[groupForLibraryType(hit.libraryType)]
  const status = openStatus(hit.openingTimes, hit.timezone, now)
  const badge = statusBadge(hit, status)
  const href = buildLibraryPath(hit)
  const hasPhoto = Boolean(hit.heroImage?.url)

  const title = (
    <h3
      className="m-0 leading-[1.15]"
      style={{ fontFamily: T.font.serif, fontSize: 24, fontWeight: 500 }}
    >
      {hit.name}
    </h3>
  )

  return (
    <article
      className="group flex flex-col overflow-hidden transition-[border-color,box-shadow] hover:border-[#B9B4F5] hover:shadow-[0_12px_28px_rgba(23,22,43,0.08)]"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: 20,
      }}
    >
      <div className="relative h-[150px] p-2">
        <Monogram hit={hit} size="card" radius={14} />
        {!hasPhoto ? (
          <span
            aria-hidden="true"
            className="absolute bottom-4 left-4 rounded-full px-2 py-0.5 text-[12px] font-semibold"
            style={{ background: "rgba(255,255,255,.82)", color: T.ink.dim }}
          >
            No photo yet
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-[18px] pt-1 pb-[18px]">
        {href ? (
          <Link
            href={href}
            className="text-(--t-ink-base) no-underline hover:underline"
            style={{ textUnderlineOffset: 3 }}
          >
            {title}
          </Link>
        ) : (
          title
        )}

        <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
          {locationLine(hit, distanceKmValue) || "Location not documented"}
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-full px-2.5 py-1 text-[13px] font-semibold"
            style={{ background: tint.bg, color: tint.fg }}
          >
            {hit.libraryType ?? "Library"}
          </span>
          <span
            className="rounded-full px-2.5 py-1 text-[13px] font-semibold"
            style={{ background: badge.bg, color: badge.fg }}
          >
            {badge.label}
          </span>
        </div>

        <p
          className="m-0 mt-auto pt-1 text-[14px] leading-[1.5]"
          style={{ color: T.ink.dim }}
        >
          {hit.summary
            ? hit.summary.length > 110
              ? `${hit.summary.slice(0, 110)}…`
              : hit.summary
            : "Collections not yet documented"}
        </p>
      </div>
    </article>
  )
}

export function LibraryResultRow({
  hit,
  distanceKmValue,
  now,
}: {
  hit: LibrarySearchHitV2
  distanceKmValue?: number
  now?: Date
}) {
  const tint = TYPE_TINT[groupForLibraryType(hit.libraryType)]
  const status = openStatus(hit.openingTimes, hit.timezone, now)
  const badge = statusBadge(hit, status)
  const href = buildLibraryPath(hit)

  const name = (
    <span
      style={{ fontFamily: T.font.serif, fontSize: 20, fontWeight: 500 }}
      className="text-(--t-ink-base)"
    >
      {hit.name}
    </span>
  )

  return (
    <li
      className="flex items-center gap-3.5 px-[18px] py-4 transition-colors hover:bg-(--t-bg-surface)"
      style={{ borderTop: `1px solid ${T.border.divider}` }}
    >
      <div className="size-[52px] shrink-0">
        <Monogram hit={hit} size="row" radius={12} />
      </div>

      <div className="min-w-0 flex-1">
        {href ? (
          <Link
            href={href}
            className="no-underline hover:underline"
            style={{ textUnderlineOffset: 3 }}
          >
            {name}
          </Link>
        ) : (
          name
        )}
        <p className="m-0 truncate text-[14px]" style={{ color: T.ink.dim }}>
          {locationLine(hit, distanceKmValue) || "Location not documented"}
        </p>
      </div>

      <span
        className="hidden rounded-full px-2.5 py-1 text-[13px] font-semibold sm:inline"
        style={{ background: tint.bg, color: tint.fg }}
      >
        {hit.libraryType ?? "Library"}
      </span>
      <span
        className="hidden rounded-full px-2.5 py-1 text-[13px] font-semibold md:inline"
        style={{ background: badge.bg, color: badge.fg }}
      >
        {badge.label}
      </span>
    </li>
  )
}
