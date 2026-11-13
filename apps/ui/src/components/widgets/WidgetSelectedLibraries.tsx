"use client"

import type { WidgetLibrary, WidgetSelectionSpec } from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Badge } from "@/components/ds/Badge"
import { Notice } from "@/components/ds/Notice"
import { SearchField } from "@/components/ds/SearchField"
import { StaffPanel } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"

export function WidgetSelectedLibraries({
  spec,
  publicRows,
  disabled,
  update,
  names,
  resolving,
  unresolvedIds,
}: {
  readonly spec: WidgetSelectionSpec
  readonly publicRows: WidgetLibrary[]
  readonly disabled: boolean
  readonly update: (value: WidgetSelectionSpec) => void
  readonly names: ReadonlyMap<string, string>
  readonly resolving: boolean
  readonly unresolvedIds: string[]
}) {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const rows = publicRows.filter((row) =>
    `${row.name} ${row.city ?? ""}`.toLowerCase().includes(search.toLowerCase())
  )
  const pages = Math.max(1, Math.ceil(rows.length / 10))
  const current = Math.min(page, pages)

  return (
    <div className="space-y-6">
      <StaffPanel title={tStatic("widget.selected_libraries")}>
        <SearchField
          id="selected-libraries-search"
          className="mb-4"
          placeholder={tStatic("widget.search_selected_libraries")}
          onClear={() => {
            setSearch("")
            setPage(1)
          }}
          inputProps={{
            value: search,
            onChange: (event) => {
              setSearch(event.target.value)
              setPage(1)
            },
          }}
        />
        <p className="mb-4 text-sm text-(--t-ink-dim)">
          {tStatic(
            "widget.selections_can_include_libraries_outside_your_team_including_a_record_never_grants_permission_to_edit_it"
          )}
        </p>
        <ul className="m-0 list-none divide-y divide-(--t-border-line) p-0">
          {rows.slice((current - 1) * 10, current * 10).map((r) => (
            <li key={r.documentId} className="space-y-3 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <strong>{r.name}</strong>
                  <p className="my-1 text-sm text-(--t-ink-dim)">
                    {r.city ?? r.country} ·{" "}
                    {r.location
                      ? tExisting("widgetSettings.mapped")
                      : "No coordinates"}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {r.why.map((why) => (
                      <Badge key={why} label={why} color="dim" size="xs" />
                    ))}
                  </div>
                </div>
                <Button
                  variant="surface"
                  size="pill"
                  disabled={disabled}
                  onClick={() =>
                    update({
                      ...spec,
                      excludeLibraryIds: [
                        ...new Set([...spec.excludeLibraryIds, r.documentId]),
                      ],
                    })
                  }
                >
                  {tStatic("widget.exclude")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {!rows.length && !resolving ? (
          <p role="status" className="py-6">
            {tStatic(
              "widget.no_matching_published_libraries_change_the_sources_or_filters"
            )}
          </p>
        ) : null}
        <nav
          className="mt-4 flex justify-between gap-3"
          aria-label={tStatic("widget.selected_library_pages")}
        >
          <Button
            variant="surface"
            size="pill"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            {tExisting("ui.previous")}
          </Button>
          <span className="self-center text-sm">
            {current} / {pages}
          </span>
          <Button
            variant="surface"
            size="pill"
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
          >
            {tExisting("ui.next")}
          </Button>
        </nav>
      </StaffPanel>
      {spec.excludeLibraryIds.length ? (
        <StaffPanel
          title={`Excluded libraries (${spec.excludeLibraryIds.length})`}
          compact
        >
          <ul className="m-0 list-none space-y-2 p-0">
            {spec.excludeLibraryIds.map((id) => (
              <li
                key={id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>{names.get(id) ?? id}</span>
                <Button
                  variant="link"
                  className="min-h-11"
                  disabled={disabled}
                  onClick={() =>
                    update({
                      ...spec,
                      excludeLibraryIds: spec.excludeLibraryIds.filter(
                        (v) => v !== id
                      ),
                    })
                  }
                >
                  {tStatic("widget.undo_exclusion")}
                </Button>
              </li>
            ))}
          </ul>
          {!spec.excludeLibraryIds.length ? (
            <p className="text-sm text-(--t-ink-dim)">
              {tStatic("widget.no_exclusions")}
            </p>
          ) : null}
        </StaffPanel>
      ) : null}
      {unresolvedIds.length ? (
        <Notice
          tone="warn"
          icon="mdi:eye-off-outline"
          title={tStatic("widget.unresolved_library_references")}
        >
          <p>
            {tStatic(
              "widget.these_records_are_unpublished_deleted_or_do_not_pass_the_current_filters_they_are_excluded_from_public_counts"
            )}
          </p>
          <ul>
            {unresolvedIds.map((id) => (
              <li key={id}>{names.get(id) ?? id}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
    </div>
  )
}
