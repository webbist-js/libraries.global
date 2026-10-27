import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import {
  countNoun,
  formatCount,
  type LocationGapKey,
} from "@/components/location/location-page.helpers"
import { RegionLibraryIndex } from "@/components/region/RegionLibraryIndex"
import { T } from "@/lib/design-tokens"
import type {
  RegionLibrary,
  RegionSibling,
} from "@/lib/strapi-api/content/server"

export const REGION_LIST_LIMIT = 24

export function RegionLibraryList({
  regionName,
  basePath,
  libraries,
  gapsBySlug,
  gapCounts,
  total,
  countsAvailable = true,
  findHref,
  addHref = "/contribute/index/new",
  featuredIds = [],
  typeCounts,
  nearby,
}: {
  readonly addHref?: string
  readonly featuredIds?: readonly string[]
  readonly typeCounts?: Record<string, number>
  readonly nearby?: ReactNode
  readonly regionName: string
  readonly basePath: string
  readonly libraries: RegionLibrary[]
  readonly gapsBySlug: Record<string, LocationGapKey[]>
  readonly gapCounts?: Partial<Record<LocationGapKey, number>> | null
  readonly total: number
  readonly countsAvailable?: boolean
  readonly findHref: string
}) {
  const regionSlug =
    new URLSearchParams(findHref.split("?")[1]).get("region") ??
    basePath.split("/").at(-1)!

  return (
    <div className="space-y-6">
      <RegionLibraryIndex
        key={regionSlug}
        regionName={regionName}
        regionSlug={regionSlug}
        basePath={basePath}
        libraries={libraries}
        gapsBySlug={gapsBySlug}
        gapCounts={gapCounts}
        typeCounts={typeCounts}
        total={total}
        countsAvailable={countsAvailable}
        findHref={findHref}
        featuredIds={featuredIds}
        nearby={nearby}
      />
      <GlobalLink
        href={addHref}
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
            className="block text-base font-semibold"
            style={{ color: T.ink.base }}
          >
            {libraries.length > 0
              ? `Know another library in ${regionName}?`
              : `Know a library in ${regionName}?`}
          </span>
          <span className="block text-sm" style={{ color: T.ink.dim }}>
            Add it with a source. A reviewer checks it before it’s published.
          </span>
        </span>
      </GlobalLink>
    </div>
  )
}

/** Keep exploring neighbouring places from the index sidebar. */
export function NearbyRegions({
  title,
  regions,
  basePath,
}: {
  readonly title: string
  readonly regions: RegionSibling[]
  readonly basePath: string
}) {
  if (regions.length === 0) return null

  return (
    <nav
      aria-label={title}
      className="rounded-2xl border p-4"
      style={{ borderColor: T.border.line, background: T.bg.space }}
    >
      <div className="flex items-center gap-2">
        <Icon
          aria-hidden="true"
          icon="mdi:map-marker-path"
          width={19}
          height={19}
          style={{ color: T.accent.primary }}
        />
        <h3 className="type-small-heading m-0">{title}</h3>
      </div>
      <p
        className="mt-2 mb-3 text-sm leading-relaxed"
        style={{ color: T.ink.dim }}
      >
        Keep exploring the libraries documented nearby.
      </p>
      <ul className="m-0 list-none space-y-1 p-0">
        {regions.map((region) => (
          <li key={region.slug}>
            <GlobalLink
              href={`${basePath}/${region.slug}`}
              className="flex min-h-14 items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-white"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {region.name}
                </span>
                <span className="block text-xs" style={{ color: T.ink.dim }}>
                  {region.libraryCount > 0
                    ? `${formatCount(region.libraryCount)} ${countNoun(region.libraryCount, "library", "libraries")}`
                    : "No records yet"}
                </span>
              </span>
              <Icon
                aria-hidden="true"
                icon="mdi:arrow-right"
                width={16}
                height={16}
                style={{ color: T.accent.primary }}
              />
            </GlobalLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
