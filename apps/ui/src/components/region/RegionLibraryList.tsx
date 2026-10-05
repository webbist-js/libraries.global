import { Icon } from "@iconify/react"

import GlobalLink from "@/components/global/GlobalLink"
import {
  countNoun,
  formatCount,
  type LocationGapKey,
} from "@/components/location/location-page.helpers"
import { LocationLibraryCard } from "@/components/location/LocationLibraryCard"
import { T } from "@/lib/design-tokens"
import type {
  RegionLibrary,
  RegionSibling,
} from "@/lib/strapi-api/content/server"

/** Cards rendered on a region page; "See all" opens the rest in Find libraries. */
export const REGION_LIST_LIMIT = 24

/** "Libraries in {region}": a grid of record cards, then an add prompt. */
export function RegionLibraryList({
  regionName,
  basePath,
  libraries,
  gapsBySlug,
  total,
  findHref,
}: {
  readonly regionName: string
  /** "/europe/england/hertfordshire" — library slugs are appended. */
  readonly basePath: string
  readonly libraries: RegionLibrary[]
  readonly gapsBySlug: Record<string, LocationGapKey[]>
  /** Published libraries in the region (the list may be capped). */
  readonly total: number
  readonly findHref: string
}) {
  // The region's full first page still feeds the map and the gap counts;
  // the grid shows a page's worth so a big region stays light.
  const shown = libraries.slice(0, REGION_LIST_LIMIT)

  return (
    <div className="flex flex-col gap-3">
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
        {shown.map((library) => (
          <li key={library.documentId}>
            <LocationLibraryCard
              library={library}
              href={`${basePath}/${library.slug}`}
              place={library.city ?? library.district}
              gaps={gapsBySlug[library.slug] ?? []}
            />
          </li>
        ))}
      </ul>

      {total > shown.length ? (
        <GlobalLink
          href={findHref}
          className="self-start text-[14.5px] font-semibold underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
        >
          See all {formatCount(total)} libraries in {regionName}
        </GlobalLink>
      ) : null}

      <GlobalLink
        href="/contribute/index/new"
        className="flex items-center gap-3.5 rounded-[20px] border border-dashed px-5 py-4 transition-colors hover:border-(--t-accent-primary) hover:bg-white"
        style={{ borderColor: T.border.hi }}
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: T.accent.chip, color: T.accent.primary }}
        >
          <Icon height={17} icon="mdi:plus" width={17} />
        </span>
        <span>
          <span
            className="block text-[15px] font-semibold"
            style={{ color: T.ink.base }}
          >
            {libraries.length > 0
              ? `Know another library in ${regionName}?`
              : `Know a library in ${regionName}?`}
          </span>
          <span className="block text-[13.5px]" style={{ color: T.ink.dim }}>
            Add it with a source. A reviewer checks it before it&rsquo;s
            published.
          </span>
        </span>
      </GlobalLink>
    </div>
  )
}

/** Side card: nearby (or the busiest) sibling regions with their counts. */
export function NearbyRegions({
  title,
  regions,
  basePath,
}: {
  readonly title: string
  readonly regions: RegionSibling[]
  /** "/europe/england" — region slugs are appended. */
  readonly basePath: string
}) {
  if (regions.length === 0) return null

  return (
    <nav
      aria-labelledby="nearby-title"
      className="rounded-[20px] border bg-white px-5 pt-4 pb-2"
      style={{ borderColor: T.border.line }}
    >
      <h2
        id="nearby-title"
        className="m-0 pb-3 text-[15px] font-semibold"
        style={{
          color: T.ink.base,
          borderBottom: `1px solid ${T.border.divider}`,
        }}
      >
        {title}
      </h2>
      <ul className="m-0 list-none p-0">
        {regions.map((region, i) => (
          <li
            key={region.slug}
            style={
              i > 0 ? { borderTop: `1px solid ${T.border.divider}` } : undefined
            }
          >
            <GlobalLink
              href={`${basePath}/${region.slug}`}
              className="flex items-baseline justify-between gap-3 py-3 hover:underline"
              style={{ textUnderlineOffset: 3 }}
            >
              <span
                className="text-[14.5px] font-semibold"
                style={{ color: T.ink.base }}
              >
                {region.name}
              </span>
              <span
                className="shrink-0 text-[13px]"
                style={{ color: T.ink.dim }}
              >
                {region.libraryCount > 0
                  ? `${formatCount(region.libraryCount)} ${countNoun(region.libraryCount, "library", "libraries")}`
                  : "None yet"}
              </span>
            </GlobalLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
