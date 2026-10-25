// "In the area": counted figures, the numbered nearby list and the Pro
// reach teaser. Every figure here comes from the index (library-area.ts).

import { formatDistance } from "@/components/library/library-page.helpers"
import { LibraryReachTeaser } from "@/components/library/LibraryReachTeaser"
import {
  LIB_ICONS,
  LibrarySectionCard,
} from "@/components/library/LibrarySectionCard"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import {
  type LibraryAreaData,
  WITHIN_KM,
} from "@/lib/strapi-api/content/library-area"

type Stat = { value: string; label: string; note?: string | null }

function StatCard({ stat }: { readonly stat: Stat }) {
  return (
    <div
      className="flex min-w-0 flex-col gap-1 rounded-2xl px-4 py-3.5"
      style={{ background: T.bg.surface, border: `1px solid ${T.border.line}` }}
    >
      <span
        className="text-[28px] leading-none"
        style={{ fontFamily: T.font.serif, fontWeight: 500, color: T.ink.base }}
      >
        {stat.value}
      </span>
      <span
        className="mt-1 text-[13.5px] leading-snug font-semibold"
        style={{ color: T.ink.base }}
      >
        {stat.label}
      </span>
      {stat.note ? (
        <span
          className="text-[12.5px] leading-snug"
          style={{ color: T.ink.dim }}
        >
          {stat.note}
        </span>
      ) : null}
    </div>
  )
}

const typeLine = (libraryType: string | null, city: string | null) =>
  [
    libraryType
      ? libraryType === "Other"
        ? "Library"
        : `${libraryType} library`
      : null,
    city,
  ]
    .filter(Boolean)
    .join(" · ")

export function LibraryAreaSection({
  libraryId,
  libraryName,
  regionName,
  area,
  addHref = "/contribute/index/new",
  showReach = true,
}: {
  readonly showReach?: boolean
  readonly libraryId?: string
  readonly libraryName: string
  readonly regionName?: string | null
  readonly area: LibraryAreaData
  readonly addHref?: string
}) {
  const place = regionName ?? "the region"
  const nearest = area.neighbours[0]
  const stats: Stat[] = []
  if (area.regionTotal !== null)
    stats.push({
      value: area.regionTotal.toLocaleString("en-GB"),
      label: `${area.regionTotal === 1 ? "Library" : "Libraries"} in ${place}`,
      note: "Documented in the index",
    })
  if (area.withinRadius !== null)
    stats.push({
      value: area.withinRadius.toLocaleString("en-GB"),
      label: `Other ${area.withinRadius === 1 ? "library" : "libraries"} within ${WITHIN_KM} km`,
      note: "Straight-line distance",
    })
  if (nearest?.km != null)
    stats.push({
      value: formatDistance(nearest.km),
      label: "To the nearest library",
      note: nearest.name,
    })
  if (area.sundays)
    stats.push({
      value: `${area.sundays.open} of ${area.sundays.total}`,
      label: "Opening this Sunday",
      note: `Of usable recorded schedules${area.sundays.includesThis ? " · including this one" : ""}`,
    })

  const hasDistances = area.neighbours.some((n) => n.km !== null)

  return (
    <LibrarySectionCard
      id="area"
      title="Nearby in the index"
      iconPath={LIB_ICONS.map}
      tone="public"
      intro={`How ${libraryName} fits into ${place}, counted from the libraries in the index.`}
    >
      {stats.length > 0 && area.neighbours.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} stat={s} />
          ))}
        </div>
      ) : null}

      <h3
        className="mt-6 mb-1 text-[15px] font-bold"
        style={{ color: T.ink.base }}
      >
        {area.sameRegion
          ? "Other libraries in this region"
          : "Libraries within 5 km"}
      </h3>
      {area.neighbours.length > 0 ? (
        <>
          <ol className="m-0 list-none p-0">
            {area.neighbours.map((n, i) => (
              <li
                key={n.id}
                className="flex items-center gap-3 py-2.5"
                style={{
                  borderTop: i > 0 ? `1px solid ${T.border.divider}` : "none",
                }}
              >
                <span
                  aria-hidden="true"
                  className="flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-bold"
                  style={{
                    background: "var(--tint-public-bg)",
                    borderColor: "var(--tint-public-fg)",
                    color: "var(--tint-public-fg)",
                  }}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  {n.href ? (
                    <Link
                      href={n.href}
                      className="block text-[15px] font-semibold no-underline hover:underline"
                      style={{ color: T.ink.base }}
                    >
                      {n.name}
                    </Link>
                  ) : (
                    <span className="block text-[15px] font-semibold">
                      {n.name}
                    </span>
                  )}
                  <span
                    className="block text-[13px]"
                    style={{ color: T.ink.dim }}
                  >
                    {typeLine(n.libraryType, n.city)}
                  </span>
                </span>
                {n.km !== null ? (
                  <span
                    className="shrink-0 text-[14px] font-semibold tabular-nums"
                    style={{ color: T.ink.base }}
                  >
                    {formatDistance(n.km)}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          {hasDistances ? (
            <p className="mt-1 mb-0 text-[12.5px]" style={{ color: T.ink.dim }}>
              Straight-line distance from the coordinates in this record.
            </p>
          ) : null}
        </>
      ) : (
        <p className="m-0 text-[14.5px]" style={{ color: T.ink.dim }}>
          {area.neighboursUnavailable
            ? "Nearby library results are temporarily unavailable."
            : area.sameRegion
              ? "No other libraries in this region are documented yet."
              : "No other libraries within 5 km are documented yet."}{" "}
          <Link
            href={addHref}
            className="font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            Add a missing library
          </Link>
        </p>
      )}

      {showReach ? (
        <details
          className="mt-5 border-t pt-2"
          style={{ borderColor: T.border.line }}
        >
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
            Explore travel-time reach
          </summary>
          <LibraryReachTeaser libraryId={libraryId} />
        </details>
      ) : null}
    </LibrarySectionCard>
  )
}
