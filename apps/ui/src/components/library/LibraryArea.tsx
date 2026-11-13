import { useLocale, useTranslations } from "next-intl"

// "In the area": counted figures, the numbered nearby list and the Reach
// teaser. Every figure here comes from the index (library-area.ts).

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
        style={{ fontFamily: T.font.sans, fontWeight: 500, color: T.ink.base }}
      >
        {stat.value}
      </span>
      <span
        className="mt-1 text-sm leading-snug font-semibold"
        style={{ color: T.ink.base }}
      >
        {stat.label}
      </span>
      {stat.note ? (
        <span className="text-sm leading-snug" style={{ color: T.ink.dim }}>
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
  const locale = useLocale()
  const tExtra = useTranslations("libraryExtra")
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const place = regionName ?? tExtra("region")
  const nearest = area.neighbours[0]
  const stats: Stat[] = []
  if (area.regionTotal !== null)
    stats.push({
      value: area.regionTotal.toLocaleString(locale),
      label: tExtra("librariesIn", { count: area.regionTotal, place }),
      note: tExtra("documented"),
    })
  if (area.withinRadius !== null)
    stats.push({
      value: area.withinRadius.toLocaleString(locale),
      label: tExtra("within", { count: area.withinRadius, km: WITHIN_KM }),
      note: tExtra("straightLine"),
    })
  if (nearest?.km != null)
    stats.push({
      value: formatDistance(nearest.km),
      label: tStatic("library.to_the_nearest_library"),
      note: nearest.name,
    })
  if (area.sundays)
    stats.push({
      value: tExtra("openOf", {
        open: area.sundays.open,
        total: area.sundays.total,
      }),
      label: tStatic("library.opening_this_sunday"),
      note: tExtra(
        area.sundays.includesThis ? "schedulesIncluding" : "schedules"
      ),
    })

  const hasDistances = area.neighbours.some((n) => n.km !== null)

  return (
    <LibrarySectionCard
      id="area"
      title={tStatic("library.nearby_in_the_index")}
      iconPath={LIB_ICONS.map}
      tone="public"
      intro={tExtra("areaIntro", { library: libraryName, place })}
    >
      {stats.length > 0 && area.neighbours.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} stat={s} />
          ))}
        </div>
      ) : null}

      <h3
        className="type-small-heading mt-6 mb-1"
        style={{ color: T.ink.base }}
      >
        {area.sameRegion
          ? tExtra("otherRegion")
          : tExtra("withinHeading", { km: WITHIN_KM })}
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
                  className="flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold"
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
                      className="block text-base font-semibold no-underline hover:underline"
                      style={{ color: T.ink.base }}
                    >
                      {n.name}
                    </Link>
                  ) : (
                    <span className="block text-base font-semibold">
                      {n.name}
                    </span>
                  )}
                  <span className="block text-sm" style={{ color: T.ink.dim }}>
                    {typeLine(n.libraryType, n.city)}
                  </span>
                </span>
                {n.km !== null ? (
                  <span
                    className="shrink-0 text-sm font-semibold tabular-nums"
                    style={{ color: T.ink.base }}
                  >
                    {formatDistance(n.km)}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          {hasDistances ? (
            <p className="mt-1 mb-0 text-sm" style={{ color: T.ink.dim }}>
              {tStatic(
                "library.straight_line_distance_from_the_coordinates_in_this_record"
              )}
            </p>
          ) : null}
        </>
      ) : (
        <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
          {area.neighboursUnavailable
            ? tExtra("nearbyUnavailable")
            : area.sameRegion
              ? tExtra("noRegion")
              : tExtra("noWithin", { km: WITHIN_KM })}{" "}
          <Link
            href={addHref}
            className="font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            {tExisting("libraryPage.addLibrary")}
          </Link>
        </p>
      )}

      {showReach ? (
        <div className="mt-5">
          <LibraryReachTeaser libraryId={libraryId} />
        </div>
      ) : null}
    </LibrarySectionCard>
  )
}
