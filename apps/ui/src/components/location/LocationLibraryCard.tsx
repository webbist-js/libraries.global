import { Icon } from "@iconify/react"
import { libraryTypeName, type LibraryTypeValue } from "@repo/shared-data"

import GlobalLink from "@/components/global/GlobalLink"
import type { OpeningTimesValue } from "@/components/library/library-page.helpers"
import {
  gapLabel,
  type LocationGapKey,
  summariseWeek,
} from "@/components/location/location-page.helpers"
import { T, tintForLibraryType } from "@/lib/design-tokens"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

/** "Public" → "Public library"; types that aren't libraries stand alone. */
export function libraryTypeLabel(type?: string | null): string {
  if (!type || type === "Other") return "Library"
  if (type === "Archive") return "Archive"

  return `${type} library`
}

const CLOSED_LABELS: Record<string, string> = {
  temporarily_closed: "Temporarily closed",
  permanently_closed: "Permanently closed",
  planned: "Not open yet",
}

export type LocationLibraryCardData = {
  name?: string | null
  libraryType?: LibraryTypeValue
  summary?: string | null
  openingTimes?: OpeningTimesValue | null
  operationalStatus?: string | null
  heroImage?: {
    url?: string | null
    formats?: { small?: { url?: string | null } | null } | null
  } | null
}

/** A library as a grid card on location pages: photo, badges, name, hours. */
export function LocationLibraryCard({
  library,
  href,
  place,
  gaps = [],
}: {
  readonly library: LocationLibraryCardData
  readonly href?: string | null
  /** Town or district shown as a neutral chip. */
  readonly place?: string | null
  readonly gaps?: LocationGapKey[]
}) {
  const name = library.name ?? ""
  const tint = tintForLibraryType(libraryTypeName(library.libraryType))
  const photo = formatStrapiMediaUrl(
    library.heroImage?.formats?.small?.url ?? library.heroImage?.url ?? null
  )
  const hours = summariseWeek(library.openingTimes)
  const closed = library.operationalStatus
    ? CLOSED_LABELS[library.operationalStatus]
    : undefined

  return (
    <article
      className="relative flex h-full flex-col rounded-[20px] border bg-(--t-bg-deep) p-2 transition-[border-color,box-shadow] focus-within:border-(--t-border-hi) hover:border-(--t-border-hi) hover:shadow-[0_12px_28px_rgba(23,22,43,.08)]"
      style={{ borderColor: T.border.line }}
    >
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 text-center"
            style={{ background: tint.bg, color: tint.fg }}
          >
            <Icon
              aria-hidden="true"
              height={26}
              icon="mdi:bank-outline"
              width={26}
            />
            <span className="text-xs font-semibold">No photo yet</span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 pt-3 pb-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-full px-2.5 py-0.5 text-sm font-semibold"
            style={{ background: tint.bg, color: tint.fg }}
          >
            {libraryTypeLabel(libraryTypeName(library.libraryType))}
          </span>
          {place ? (
            <span
              className="rounded-full px-2.5 py-0.5 text-sm font-semibold"
              style={{ background: T.bg.muted, color: T.ink.dim }}
            >
              {place}
            </span>
          ) : null}
          {closed ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold"
              style={{
                background: "var(--tint-special-bg)",
                color: T.accent.danger,
              }}
            >
              <Icon
                aria-hidden="true"
                height={13}
                icon="mdi:door-closed"
                width={13}
              />
              {closed}
            </span>
          ) : null}
        </div>

        <h3 className="type-h3 m-0">
          {href ? (
            <GlobalLink
              href={href}
              className="text-(--t-ink-base) no-underline after:absolute after:inset-0 after:rounded-[20px] hover:underline"
              style={{ textUnderlineOffset: 3 }}
            >
              {name}
            </GlobalLink>
          ) : (
            name
          )}
        </h3>

        {library.summary ? (
          <p
            className="m-0 line-clamp-2 text-sm leading-[1.5]"
            style={{ color: T.ink.dim }}
          >
            {library.summary}
          </p>
        ) : null}

        <p
          className="m-0 mt-auto flex items-center gap-1.5 pt-1 text-sm"
          style={{ color: T.ink.dim }}
        >
          <Icon
            aria-hidden="true"
            className="shrink-0"
            height={14}
            icon="mdi:clock-outline"
            width={14}
          />
          {hours ?? "Hours not added yet"}
        </p>

        {gaps.length > 0 ? (
          <p
            className="m-0 mt-0.5 flex flex-wrap items-center gap-1.5 text-sm"
            style={{ color: T.ink.dim }}
          >
            <span className="font-semibold">Missing:</span>
            {gaps.map((gap) => (
              <span
                key={gap}
                className="rounded-full border border-dashed px-2 py-0.5 font-semibold"
                style={{ borderColor: T.border.hi, color: T.ink.dim }}
              >
                {gapLabel(gap)}
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </article>
  )
}
