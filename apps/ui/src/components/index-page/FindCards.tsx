// apps/ui/src/components/index-page/FindCards.tsx
"use client"

import { noticeLocalDate } from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import type { ReactNode } from "react"

import { analyticsAttributes } from "@/lib/analytics-events"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import type { LibrarySearchHitV2 } from "@/lib/find-search"
import { buildLibraryPath } from "@/lib/meilisearch"
import { Link } from "@/lib/navigation"
import { formatStrapiMediaUrlForClient } from "@/lib/strapi-helpers"

import {
  type OpenStatus,
  groupForLibraryType,
  openStatus,
} from "./find-helpers"

type LibraryTileHit = Omit<LibrarySearchHitV2, "id">

function statusBadge(hit: LibraryTileHit, status: OpenStatus, now?: Date) {
  if (
    hit.closed_dates?.includes(noticeLocalDate(now ?? new Date(), hit.timezone))
  )
    return {
      label: "Closed today",
      bg: "var(--t-danger-soft)",
      fg: T.accent.danger,
    }
  if (hit.libraryType === "Mobile" && hit.stop_count)
    return {
      label: status.open ? "At a stop · timetable" : "No visit now · timetable",
      bg: status.open ? TYPE_TINT.public.bg : T.bg.muted,
      fg: status.open ? TYPE_TINT.public.fg : T.ink.dim,
    }
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

function locationLine(hit: LibraryTileHit, distanceKmValue?: number) {
  const parts = [hit.city, hit.region_name, hit.country_name].filter(Boolean)
  const base = [
    parts.join(", "),
    ...(hit.libraryType === "Mobile" && hit.stop_count
      ? [`${hit.stop_count} stops · ${hit.cycle_weeks ?? 1}-week cycle`]
      : []),
  ]
    .filter(Boolean)
    .join(" · ")

  return distanceKmValue != null
    ? `${base} · ${distanceKmValue < 10 ? distanceKmValue.toFixed(1) : Math.round(distanceKmValue)} km`
    : base
}

function Monogram({
  hit,
  size,
  radius,
}: {
  hit: LibraryTileHit
  size: "card" | "row"
  radius: number
}) {
  const tint = TYPE_TINT[groupForLibraryType(hit.libraryType)]
  const photo = formatStrapiMediaUrlForClient(
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
  href: hrefOverride,
  statusBadge: statusOverride,
  children,
}: {
  hit: LibraryTileHit
  distanceKmValue?: number
  now?: Date
  /** Place pages already know the record's canonical path. */
  href?: string | null
  /** Notice-aware status supplied by a place page. */
  statusBadge?: ReactNode
  /** Optional contribution details within the standard tile. */
  children?: ReactNode
}) {
  const tUi = useUiTranslations("ui")

  const tint = TYPE_TINT[groupForLibraryType(hit.libraryType)]
  const status = hit.closed_dates?.includes(
    noticeLocalDate(now ?? new Date(), hit.timezone)
  )
    ? { known: true, open: false }
    : openStatus(hit.openingTimes, hit.timezone, now)
  const badge = statusBadge(hit, status, now)
  const href = hrefOverride ?? buildLibraryPath(hit)
  const hasPhoto = Boolean(
    hit.heroImage?.formats?.small?.url ?? hit.heroImage?.url
  )

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
      className="group flex h-full flex-col overflow-hidden transition-[border-color,box-shadow] hover:border-[#B9B4F5] hover:shadow-[0_12px_28px_rgba(23,22,43,0.08)]"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: 20,
      }}
    >
      {hasPhoto ? (
        <div className="relative h-[150px] p-2">
          <Monogram hit={hit} size="card" radius={14} />
        </div>
      ) : null}

      <div
        className={`flex flex-1 flex-col gap-2 px-[18px] pb-[18px] ${hasPhoto ? "pt-1" : "pt-[18px]"}`}
      >
        {href ? (
          <Link
            href={href}
            {...analyticsAttributes("select_content", {
              interaction_source: "find_grid",
              content_type: "library",
              library_document_id: hit.documentId,
              view_mode: "grid",
            })}
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

        <div className="flex flex-col items-start gap-2">
          <span
            className="rounded-full px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap"
            style={{ background: tint.bg, color: tint.fg }}
          >
            {hit.libraryType ?? tUi("library")}
          </span>
          {statusOverride === undefined ? (
            <span
              className="rounded-full px-2.5 py-1 text-[13px] font-semibold"
              style={{ background: badge.bg, color: badge.fg }}
            >
              {badge.label}
            </span>
          ) : (
            statusOverride
          )}
        </div>

        {hit.summary ? (
          <p
            className="m-0 text-[14px] leading-[1.5]"
            style={{ color: T.ink.dim }}
          >
            {hit.summary.length > 110
              ? `${hit.summary.slice(0, 110)}…`
              : hit.summary}
          </p>
        ) : null}
        {children}
      </div>
    </article>
  )
}

export function LibraryResultRow({
  hit,
  analyticsView = "list",
  distanceKmValue,
  now,
  href: hrefOverride,
  statusBadge: statusOverride,
  children,
}: {
  hit: LibraryTileHit
  analyticsView?: "list" | "map"
  distanceKmValue?: number
  now?: Date
  href?: string | null
  statusBadge?: ReactNode
  children?: ReactNode
}) {
  const tUi = useUiTranslations("ui")

  const tint = TYPE_TINT[groupForLibraryType(hit.libraryType)]
  const status = hit.closed_dates?.includes(
    noticeLocalDate(now ?? new Date(), hit.timezone)
  )
    ? { known: true, open: false }
    : openStatus(hit.openingTimes, hit.timezone, now)
  const badge = statusBadge(hit, status, now)
  const href = hrefOverride ?? buildLibraryPath(hit)

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
      className="flex flex-wrap items-center gap-3.5 px-[18px] py-4 transition-colors hover:bg-(--t-bg-surface)"
      style={{ borderTop: `1px solid ${T.border.divider}` }}
    >
      <div className="size-[52px] shrink-0">
        <Monogram hit={hit} size="row" radius={12} />
      </div>

      <div className="min-w-0 flex-1">
        {href ? (
          <Link
            href={href}
            {...analyticsAttributes("select_content", {
              interaction_source:
                analyticsView === "map" ? "find_map" : "find_list",
              content_type: "library",
              library_document_id: hit.documentId,
              view_mode: analyticsView,
            })}
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
        {hit.libraryType ?? tUi("library")}
      </span>
      {statusOverride === undefined ? (
        <span
          className="hidden rounded-full px-2.5 py-1 text-[13px] font-semibold md:inline"
          style={{ background: badge.bg, color: badge.fg }}
        >
          {badge.label}
        </span>
      ) : (
        statusOverride
      )}
      {children}
    </li>
  )
}
