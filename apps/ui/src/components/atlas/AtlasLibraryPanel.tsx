"use client"

import { effectiveLibraryHours, noticeLocalDate } from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useState, useContext, type ReactNode } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import {
  formatCoordinates,
  getOpenStatus,
  type OpeningTimesValue,
} from "@/components/library/library-page.helpers"
import { Skeleton } from "@/components/ui/skeleton"
import { analyticsAttributes } from "@/lib/analytics-events"
import { T } from "@/lib/design-tokens"
import { formatStrapiMediaUrlForClient } from "@/lib/strapi-helpers"

import { atlasExternalUrl } from "./atlas-links"
import { Icon, tintOfGroup, TypeBadge } from "./atlas-ui"
import { type AtlasLibrary, OPERATOR_GROUPS, typeGroupOf } from "./atlas.logic"
import { AtlasAnalysisPanelContext } from "./AtlasAnalysisHeader"

interface LibraryDetail {
  summary?: string | null
  streetAddress?: string | null
  postalCode?: string | null
  catalogueUrl?: string | null
  openingTimes?: OpeningTimesValue | null
  updatedAt?: string | null
  heroImage?: { url?: string | null; alternativeText?: string | null } | null
}

const detailCache = new Map<string, LibraryDetail>()

async function fetchDetail(
  id: string,
  signal: AbortSignal
): Promise<LibraryDetail | null> {
  const hit = detailCache.get(id)
  if (hit) return hit
  const params = new URLSearchParams({
    "filters[documentId][$eq]": id,
    "fields[0]": "summary",
    "fields[1]": "streetAddress",
    "fields[2]": "postalCode",
    "fields[3]": "catalogueUrl",
    "fields[4]": "openingTimes",
    "fields[5]": "updatedAt",
    "populate[heroImage][fields][0]": "url",
    "populate[heroImage][fields][1]": "alternativeText",
  })
  const res = await fetch(`/api/public-proxy/api/libraries?${params}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  })
  if (!res.ok) return null
  const json = (await res.json()) as { data?: LibraryDetail[] }
  const detail = json.data?.[0] ?? null
  if (detail) {
    if (detailCache.size >= 100)
      detailCache.delete(detailCache.keys().next().value!)
    detailCache.set(id, detail)
  }

  return detail
}

function relative(iso: string | null | undefined): string | null {
  if (!iso) return null
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (!Number.isFinite(days) || days < 0) return null
  if (days < 1) return "today"
  if (days < 14) return `${days} ${days === 1 ? "day" : "days"} ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  if (days < 730) return `${Math.floor(days / 30)} months ago`

  return `${Math.floor(days / 365)} years ago`
}

export function AtlasLibraryPanel({
  library,
  onClose,
  compact = false,
  onReach,
  reachPrompt,
}: {
  readonly library: AtlasLibrary
  readonly onClose: () => void
  /** Mobile sheet: no photo, fewer rows. */
  readonly compact?: boolean
  readonly onReach?: () => void
  readonly reachPrompt?: ReactNode
}) {
  const tUi = useUiTranslations("ui")
  const inInspect = useContext(AtlasAnalysisPanelContext)
  const tInspect = useUiTranslations("atlasInspect")

  const [detail, setDetail] = useState<LibraryDetail | null>(
    detailCache.get(library.id) ?? null
  )
  const [loading, setLoading] = useState(!detailCache.has(library.id))

  // The parent keys this panel by library id, so state starts fresh per library.
  useEffect(() => {
    let alive = true
    const controller = new AbortController()
    fetchDetail(library.id, controller.signal)
      .catch(() => null)
      .then((d) => alive && setDetail(d))
      .finally(() => alive && setLoading(false))

    return () => {
      alive = false
      controller.abort()
    }
  }, [library.id])

  const group = typeGroupOf(library.type)
  const tint = tintOfGroup(group)
  const effective = effectiveLibraryHours(
    detail?.openingTimes ?? null,
    library.notices ?? [],
    noticeLocalDate(new Date(), library.tz)
  )
  const status = effective.closed
    ? { state: "closed", label: "Closed today" }
    : getOpenStatus(effective.hours as OpeningTimesValue | null, library.tz)
  const operator = OPERATOR_GROUPS.find(
    (g) => library.operator && g.values.includes(library.operator)
  )
  const img = formatStrapiMediaUrlForClient(detail?.heroImage?.url ?? undefined)
  // Some records keep the whole address in streetAddress; don't repeat parts.
  const street = detail?.streetAddress ?? ""
  const address = [
    street,
    ...[library.city, detail?.postalCode].filter(
      (part) => part && !street.toLowerCase().includes(part.toLowerCase())
    ),
  ]
    .filter(Boolean)
    .join(", ")
  const facilities = [...library.services, ...library.access].slice(0, 6)
  const closedForGood = library.status === "permanently_closed"
  const updated = relative(detail?.updatedAt)
  const catalogueHref = library.path
    ? atlasExternalUrl(detail?.catalogueUrl)
    : null
  const pending = loading && !detail

  const statusBox =
    status.state === "open"
      ? {
          bg: "#E6EFE6",
          fg: T.accent.ok,
          icon: "check" as const,
          text: tUi("open_now"),
        }
      : status.state === "closed"
        ? {
            bg: T.bg.muted,
            fg: T.ink.base,
            icon: "clock" as const,
            text: tUi("closed"),
          }
        : {
            bg: T.bg.muted,
            fg: T.ink.dim,
            icon: "info" as const,
            text: "Hours",
          }

  return (
    <div className="flex min-h-full flex-col" aria-busy={pending}>
      {pending ? (
        <span role="status" className="sr-only">
          {tUi("loading_library_details")}
        </span>
      ) : null}
      {!compact ? (
        <div
          className="relative mx-2 mt-2 h-[150px] shrink-0 overflow-hidden rounded-2xl"
          style={{ background: tint.bg }}
        >
          {pending ? (
            <Skeleton className="h-full w-full rounded-2xl bg-(--t-border-line)" />
          ) : img ? (
            <img
              src={img}
              alt={detail?.heroImage?.alternativeText ?? ""}
              width={400}
              height={150}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full flex-col items-center justify-center gap-1"
              style={{ color: tint.fg }}
            >
              <span
                className="text-[40px] leading-none"
                style={{ fontFamily: T.font.serif }}
                aria-hidden="true"
              >
                {library.name
                  .split(/\s+/)
                  .filter((w) => /^[A-Z]/.test(w))
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("") || library.name[0]}
              </span>
              <span className="text-[13px] font-semibold">No photo yet</span>
            </div>
          )}
          {!inInspect ? (
            <button
              type="button"
              aria-label={tUi("close")}
              onClick={onClose}
              className="absolute top-2 right-2 flex size-10 items-center justify-center rounded-full bg-white"
              style={{ color: T.ink.base }}
            >
              <Icon name="x" size={18} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className={`flex flex-1 flex-col gap-3.5 ${compact ? "px-[18px]" : "px-5 pt-4 pb-[18px]"}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge group={group} />
          {operator ? (
            <span
              className="inline-flex h-[26px] items-center rounded-full px-2.5 text-[13px] font-bold"
              style={{ background: T.bg.muted, color: T.ink.base }}
            >
              {operator.label}
            </span>
          ) : null}
          {compact && !inInspect ? (
            <button
              type="button"
              aria-label={tUi("close")}
              onClick={onClose}
              className="-mr-2 ml-auto flex size-11 items-center justify-center rounded-full"
            >
              <Icon name="x" size={20} />
            </button>
          ) : null}
        </div>

        <div>
          {!inInspect ? (
            <h2
              className="m-0 text-[30px] leading-[1.05] sm:text-[32px]"
              style={{ fontFamily: T.font.serif, fontWeight: 500 }}
            >
              {library.name}
            </h2>
          ) : null}
          {!compact && pending ? (
            <div className="mt-2 grid gap-2" aria-hidden="true">
              <Skeleton className="h-3 w-full rounded-full bg-(--t-border-line)" />
              <Skeleton className="h-3 w-3/4 rounded-full bg-(--t-border-line)" />
            </div>
          ) : !compact && detail?.summary ? (
            <p
              className="mt-1 mb-0 line-clamp-2 text-[14px]"
              style={{ color: T.ink.dim }}
            >
              {detail.summary}
            </p>
          ) : null}
        </div>

        {onReach &&
        !closedForGood &&
        library.type !== "Mobile" &&
        library.type !== "Digital" ? (
          <button
            type="button"
            onClick={onReach}
            className="min-h-11 w-full rounded-xl border px-4 py-3 text-sm font-semibold"
          >
            {tInspect("reachFromHere")}
          </button>
        ) : null}
        {reachPrompt}
        {closedForGood ? (
          <div
            className="flex items-center gap-2 rounded-[14px] px-3.5 py-2.5 text-[15px] font-semibold"
            style={{ background: "#F6E3DA", color: T.accent.danger }}
          >
            <Icon name="x" size={17} stroke={2.4} />
            Permanently closed{library.closed ? ` in ${library.closed}` : ""}
          </div>
        ) : pending ? (
          <div className="flex min-h-[43px] items-center justify-between gap-3 rounded-[14px] bg-(--t-bg-muted) px-3.5 py-2.5">
            <Skeleton className="h-3.5 w-20 rounded-full bg-(--t-border-line)" />
            <Skeleton className="h-3.5 w-24 rounded-full bg-(--t-border-line)" />
          </div>
        ) : (
          <div
            className="flex items-center justify-between gap-2.5 rounded-[14px] px-3.5 py-2.5"
            style={{ background: statusBox.bg }}
          >
            <span
              className="inline-flex items-center gap-1.5 text-[15px] font-semibold"
              style={{ color: statusBox.fg }}
            >
              <Icon name={statusBox.icon} size={17} stroke={2.4} />
              {statusBox.text}
            </span>
            <span className="text-right text-[15px]">
              {status.state === "open"
                ? status.label.replace("Open until", "Until")
                : status.label.replace("Closed · ", "")}
            </span>
          </div>
        )}

        <dl className="m-0 grid grid-cols-[24px_1fr] items-start gap-x-2.5 gap-y-1 text-[15px] leading-snug">
          <dt className="pt-0.5" style={{ color: T.ink.dim }}>
            <Icon name="pin" size={18} />
            <span className="sr-only">{tUi("address")}</span>
          </dt>
          <dd className="m-0">
            {pending ? (
              <Skeleton className="my-1.5 h-3 w-3/4 rounded-full bg-(--t-border-line)" />
            ) : null}
            {address ||
              [library.city, library.region, library.country]
                .filter(Boolean)
                .join(", ")}
            {!compact && library.mapped !== false ? (
              <span
                className="block text-[13px]"
                style={{ fontFamily: T.font.mono, color: T.ink.dim }}
              >
                {formatCoordinates({ lat: library.lat, lng: library.lng })}
              </span>
            ) : null}
          </dd>
          {library.access.length > 0 ? (
            <>
              <dt className="pt-0.5" style={{ color: T.ink.dim }}>
                <Icon name="acc" size={18} />
                <span className="sr-only">{tUi("accessibility")}</span>
              </dt>
              <dd className="m-0">{library.access.join(", ")}</dd>
            </>
          ) : null}
        </dl>

        {!compact && facilities.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-[14px] font-bold">Services & facilities</p>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {facilities.map((f) => (
                <li
                  key={f}
                  className="inline-flex h-8 items-center rounded-full border px-3 text-[14px] font-medium"
                  style={{ borderColor: T.border.hi }}
                >
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {library.path ? (
          <div className="flex gap-2">
            {catalogueHref ? (
              <SecondaryLink
                href={catalogueHref}
                external
                icon="ext"
                action="catalogue"
                libraryId={library.id}
              >
                {compact ? "Catalogue" : "Check the catalogue"}
              </SecondaryLink>
            ) : null}
            <SecondaryLink
              href={`${library.path}#visit`}
              icon="route"
              action="plan_visit"
              libraryId={library.id}
            >
              Plan a visit
            </SecondaryLink>
          </div>
        ) : null}

        <div className="mt-auto flex flex-col gap-2.5 pt-1">
          {library.path ? (
            <GlobalLink
              href={library.path}
              {...analyticsAttributes("select_content", {
                interaction_source: "atlas_panel",
                content_type: "library",
                library_document_id: library.id,
                view_mode: "map",
              })}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-(--t-accent-primary) px-5 text-[15px] font-semibold text-white hover:bg-(--t-accent-primary-hover)"
            >
              Open full record
              <Icon name="chev" size={16} color="#fff" stroke={2.2} />
            </GlobalLink>
          ) : null}
          {!compact ? (
            <p
              className="m-0 flex flex-col gap-1 text-left text-[13px] leading-relaxed"
              style={{ color: T.ink.dim }}
            >
              <span>
                Community maintained{updated ? ` · updated ${updated}` : ""}
              </span>
              <span>{library.complete}% complete</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function SecondaryLink({
  href,
  action,
  libraryId,
  external = false,
  icon,
  children,
}: {
  readonly href: string
  readonly action: "catalogue" | "plan_visit"
  readonly libraryId: string
  readonly external?: boolean
  readonly icon: "ext" | "route"
  readonly children: React.ReactNode
}) {
  const tUi = useUiTranslations("ui")

  const cls =
    "inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full border bg-white px-3.5 text-[14px] font-semibold whitespace-nowrap hover:border-(--t-accent-primary)"
  const style = { borderColor: T.border.hi, color: T.ink.base }
  const analytics = analyticsAttributes("library_action", {
    interaction_source: "atlas_panel",
    action_type: action,
    library_document_id: libraryId,
  })

  return external ? (
    <a
      href={href}
      {...analytics}
      target="_blank"
      rel="noopener noreferrer"
      className={cls}
      style={style}
    >
      <Icon name={icon} size={15} />
      {children}
      <span className="sr-only">{tUi("opens_in_a_new_tab")}</span>
    </a>
  ) : (
    <GlobalLink href={href} {...analytics} className={cls} style={style}>
      <Icon name={icon} size={15} />
      {children}
    </GlobalLink>
  )
}
