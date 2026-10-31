"use client"

import {
  defaultWidgetConfig,
  emptyWidgetSelection,
  FACILITY_CHECKLIST,
} from "@repo/shared-data"
import dynamic from "next/dynamic"
import { useLocale } from "next-intl"

import { EmptyState } from "@/components/ds/EmptyState"
import { SegmentedControl } from "@/components/ds/SegmentedControl"
import { Button } from "@/components/ui/button"
import type { WidgetPresentationData } from "@/components/widgets/presentation"
import { useWidgetFinder } from "@/components/widgets/WidgetFinder"
import {
  analyticsAttributes,
  navigationAttributes,
} from "@/lib/analytics-events"
import { Link } from "@/lib/navigation"
import type { NetworkDetail } from "@/lib/networks/types"

const MemberMap = dynamic(() => import("@/components/widgets/WidgetMap"), {
  ssr: false,
  loading: () => (
    <div
      className="h-96 animate-pulse rounded-2xl bg-(--t-bg-surface)"
      role="status"
    >
      Loading member map…
    </div>
  ),
})

/** Full-network filtering happens on the server; this view only sorts and maps the current result page. */
export function NetworkLibraryList({ data }: { readonly data: NetworkDetail }) {
  const locale = useLocale()
  const config = {
    ...defaultWidgetConfig(),
    locale,
    title: data.network.name,
    search: false,
    facilityFilter: false,
  }
  const presentation: WidgetPresentationData = {
    type: "finder",
    config,
    spec: emptyWidgetSelection(),
    publisher: data.network.name,
    rows: data.libraries,
    diagnostics: {
      selected: data.libraries.length,
      mapped: data.libraries.filter((row) => row.location).length,
      missingCoordinates: data.libraries.filter((row) => !row.location).length,
      unresolvedIds: [],
      excludedIds: [],
      licenceIssues: [],
      missingHours: 0,
    },
    attribution: [],
    checkedAt: "",
    sourceLabels: {},
  }
  const model = useWidgetFinder(presentation)
  const handleViewChange = model.setViewChoice
  const handleLocationRequest = model.askLocation
  const handleSelection = model.setSelected
  const selection = (documentId: string) =>
    analyticsAttributes("select_content", {
      interaction_source: "network_members",
      content_type: "library",
      library_document_id: documentId,
      view_mode: model.view === "map" ? "map" : "list",
    })
  if (!data.libraries.length)
    return (
      <EmptyState
        message="No member libraries match"
        detail="Try a different name, location or facility. Clear the filters to see all published members."
      />
    )

  return (
    <div className="network-library-results">
      <div className="network-results-toolbar">
        <SegmentedControl
          label="Member library view"
          value={model.view}
          onChange={handleViewChange}
          options={[
            { value: "list", label: "List" },
            { value: "map", label: "Map" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="surface" size="pill" onClick={handleLocationRequest}>
            Use my location
          </Button>
          {model.location ? (
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                model.setLocation(null)
                model.setLocationState("")
              }}
            >
              Clear distance sort
            </Button>
          ) : null}
        </div>
      </div>
      {model.locationState ? (
        <p role="status" className="text-sm text-(--t-ink-dim)">
          {model.locationState}
        </p>
      ) : null}
      {model.view === "map" ? (
        <>
          <p className="text-sm text-(--t-ink-dim)">
            {model.rows.filter((row) => row.location).length} of{" "}
            {model.rows.length} results on this page have map coordinates.{" "}
            <Link
              href={`/map?network=${data.network.documentId}`}
              {...navigationAttributes("/map", "network_members")}
            >
              Open the whole network in Atlas →
            </Link>
          </p>
          <MemberMap
            rows={model.rows}
            selected={model.selected}
            onSelect={handleSelection}
            accent={model.accent}
            clusters
            labels
            reset
            locale={locale}
          />
          {model.picked ? (
            <div className="network-filter-card">
              <h3 className="type-small-heading">{model.picked.name}</h3>
              <p>{model.picked.address}</p>
              {model.picked.href ? (
                <Link
                  className="network-page-link"
                  href={model.picked.href}
                  {...selection(model.picked.documentId)}
                >
                  View library →
                </Link>
              ) : null}
              <Button
                variant="link"
                size="sm"
                onClick={() => model.setSelected(null)}
              >
                Close selection
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <ul className="network-member-grid m-0 grid list-none gap-4 p-0">
          {model.rows.map((row) => (
            <li
              className="network-member-card network-library-card"
              key={row.documentId}
            >
              <p className="m-0 text-xs font-semibold text-(--t-ink-dim)">
                {row.libraryType} · {row.country ?? "Location not recorded"}
              </p>
              <h3 className="type-h3 mt-2 mb-0">
                {row.href ? (
                  <Link href={row.href} {...selection(row.documentId)}>
                    {row.name}
                  </Link>
                ) : (
                  row.name
                )}
              </h3>
              <p className="network-library-address">
                {row.address || "Address not recorded"}
              </p>
              {row.hours.length ? (
                <details className="text-sm">
                  <summary className="min-h-11 cursor-pointer py-3 font-semibold">
                    Recorded opening hours
                  </summary>
                  <ul className="space-y-1 pl-4">
                    {row.hours.map((time) => (
                      <li key={time}>{time}</li>
                    ))}
                  </ul>
                </details>
              ) : (
                <p className="text-sm text-(--t-ink-dim)">
                  Opening hours not recorded
                </p>
              )}
              {!row.facilities.includes("yes") ? (
                <p className="m-0 text-xs text-(--t-ink-low)">
                  Facilities not recorded
                </p>
              ) : null}
              <ul
                className="m-0 flex list-none flex-wrap gap-2 p-0"
                aria-label="Recorded facilities"
              >
                {row.facilities.flatMap((value, index) =>
                  value === "yes" && FACILITY_CHECKLIST[index]
                    ? [
                        <li
                          className="network-facility-chip"
                          key={FACILITY_CHECKLIST[index]!.label}
                        >
                          {FACILITY_CHECKLIST[index]!.label}
                        </li>,
                      ]
                    : []
                )}
              </ul>
              <div className="network-library-actions">
                {row.href ? (
                  <Link
                    className="network-page-link"
                    href={row.href}
                    {...selection(row.documentId)}
                  >
                    View library →
                  </Link>
                ) : null}
                {row.location ? (
                  <Button
                    variant="link"
                    size="sm"
                    className="px-0"
                    onClick={() => model.selectLibrary(row.documentId)}
                  >
                    Show on map
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
