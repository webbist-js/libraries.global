"use client"

import { useEffect, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import {
  formatCoordinates,
  getOpenStatus,
  type OpeningTimesValue,
} from "@/components/library/library-page.helpers"
import { T } from "@/lib/design-tokens"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

import { Icon, tintOfGroup, TypeBadge } from "./atlas-ui"
import {
  type AtlasLibrary,
  hasStepFree,
  OPERATOR_GROUPS,
  typeGroupOf,
} from "./atlas.logic"

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

async function fetchDetail(id: string): Promise<LibraryDetail | null> {
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
  const res = await fetch(`/api/public-proxy/api/libraries?${params}`)
  if (!res.ok) return null
  const json = (await res.json()) as { data?: LibraryDetail[] }
  const detail = json.data?.[0] ?? null
  if (detail) detailCache.set(id, detail)

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
}: {
  readonly library: AtlasLibrary
  readonly onClose: () => void
  /** Mobile sheet: no photo, fewer rows. */
  readonly compact?: boolean
}) {
  const [detail, setDetail] = useState<LibraryDetail | null>(
    detailCache.get(library.id) ?? null
  )
  const [loading, setLoading] = useState(!detailCache.has(library.id))

  // The parent keys this panel by library id, so state starts fresh per library.
  useEffect(() => {
    let alive = true
    fetchDetail(library.id)
      .then((d) => alive && setDetail(d))
      .finally(() => alive && setLoading(false))

    return () => {
      alive = false
    }
  }, [library.id])

  const group = typeGroupOf(library.type)
  const tint = tintOfGroup(group)
  const status = getOpenStatus(detail?.openingTimes ?? null, library.tz)
  const operator = OPERATOR_GROUPS.find(
    (g) => library.operator && g.values.includes(library.operator)
  )
  const img = formatStrapiMediaUrl(detail?.heroImage?.url ?? undefined)
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
    ? library.catalogue
      ? `${library.path}#catalogue`
      : (detail?.catalogueUrl ?? null)
    : null

  const statusBox =
    status.state === "open"
      ? {
          bg: "#E6EFE6",
          fg: T.accent.ok,
          icon: "check" as const,
          text: "Open now",
        }
      : status.state === "closed"
        ? {
            bg: T.bg.muted,
            fg: T.ink.base,
            icon: "clock" as const,
            text: "Closed",
          }
        : {
            bg: T.bg.muted,
            fg: T.ink.dim,
            icon: "info" as const,
            text: "Hours",
          }

  return (
    <div className="flex min-h-full flex-col">
      {!compact ? (
        <div
          className="relative mx-2 mt-2 h-[150px] shrink-0 overflow-hidden rounded-2xl"
          style={{ background: tint.bg }}
        >
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={detail?.heroImage?.alternativeText ?? ""}
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
              <span className="text-[13px] font-semibold">
                {loading ? "" : "No photo yet"}
              </span>
            </div>
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute top-2 right-2 flex size-10 items-center justify-center rounded-full bg-white"
            style={{ color: T.ink.base }}
          >
            <Icon name="x" size={18} />
          </button>
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
          {compact ? (
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="-mr-2 ml-auto flex size-11 items-center justify-center rounded-full"
            >
              <Icon name="x" size={20} />
            </button>
          ) : null}
        </div>

        <div>
          <h2
            className="m-0 text-[30px] leading-[1.05] sm:text-[32px]"
            style={{ fontFamily: T.font.serif, fontWeight: 500 }}
          >
            {library.name}
          </h2>
          {!compact && detail?.summary ? (
            <p
              className="mt-1 mb-0 line-clamp-2 text-[14px]"
              style={{ color: T.ink.dim }}
            >
              {detail.summary}
            </p>
          ) : null}
        </div>

        {closedForGood ? (
          <div
            className="flex items-center gap-2 rounded-[14px] px-3.5 py-2.5 text-[15px] font-semibold"
            style={{ background: "#F6E3DA", color: T.accent.danger }}
          >
            <Icon name="x" size={17} stroke={2.4} />
            Permanently closed{library.closed ? ` in ${library.closed}` : ""}
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
              {loading && !detail
                ? "…"
                : status.state === "open"
                  ? status.label.replace("Open until", "Until")
                  : status.label.replace("Closed · ", "")}
            </span>
          </div>
        )}

        <dl className="m-0 grid grid-cols-[24px_1fr] items-start gap-x-2.5 gap-y-1 text-[15px] leading-snug">
          <dt className="pt-0.5" style={{ color: T.ink.dim }}>
            <Icon name="pin" size={18} />
            <span className="sr-only">Address</span>
          </dt>
          <dd className="m-0">
            {address ||
              [library.city, library.region, library.country]
                .filter(Boolean)
                .join(", ")}
            {!compact ? (
              <span
                className="block text-[13px]"
                style={{ fontFamily: T.font.mono, color: T.ink.dim }}
              >
                {formatCoordinates({ lat: library.lat, lng: library.lng })}
              </span>
            ) : null}
          </dd>
          {hasStepFree(library) ? (
            <>
              <dt className="pt-0.5" style={{ color: T.ink.dim }}>
                <Icon name="acc" size={18} />
                <span className="sr-only">Accessibility</span>
              </dt>
              <dd className="m-0">Step-free access recorded</dd>
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
                external={!library.catalogue}
                icon="ext"
              >
                {compact ? "Catalogue" : "Check the catalogue"}
              </SecondaryLink>
            ) : null}
            <SecondaryLink href={`${library.path}#visit`} icon="route">
              Plan a visit
            </SecondaryLink>
          </div>
        ) : null}

        <div className="mt-auto flex flex-col gap-2.5 pt-1">
          {library.path ? (
            <GlobalLink
              href={library.path}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-(--t-accent-primary) px-5 text-[15px] font-semibold text-white hover:bg-(--t-accent-primary-hover)"
            >
              Open full record
              <Icon name="chev" size={16} color="#fff" stroke={2.2} />
            </GlobalLink>
          ) : null}
          {!compact ? (
            <p
              className="m-0 text-center text-[13px]"
              style={{ color: T.ink.dim }}
            >
              Community maintained{updated ? ` · updated ${updated}` : ""} ·{" "}
              {library.complete}% complete
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function SecondaryLink({
  href,
  external = false,
  icon,
  children,
}: {
  readonly href: string
  readonly external?: boolean
  readonly icon: "ext" | "route"
  readonly children: React.ReactNode
}) {
  const cls =
    "inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full border bg-white px-3.5 text-[14px] font-semibold whitespace-nowrap hover:border-(--t-accent-primary)"
  const style = { borderColor: T.border.hi, color: T.ink.base }

  return external ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cls}
      style={style}
    >
      <Icon name={icon} size={15} />
      {children}
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  ) : (
    <GlobalLink href={href} className={cls} style={style}>
      <Icon name={icon} size={15} />
      {children}
    </GlobalLink>
  )
}
