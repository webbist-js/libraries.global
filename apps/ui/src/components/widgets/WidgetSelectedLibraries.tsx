"use client"
import type { WidgetLibrary, WidgetSelectionSpec } from "@repo/shared-data"
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
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const rows = publicRows.filter((row) =>
    `${row.name} ${row.city ?? ""}`.toLowerCase().includes(search.toLowerCase())
  )
  const pages = Math.max(1, Math.ceil(rows.length / 10))
  const current = Math.min(page, pages)

  return (
    <div className="space-y-6">
      <StaffPanel title="Selected libraries">
        <SearchField
          id="selected-libraries-search"
          className="mb-4"
          placeholder="Search selected libraries"
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
          Selections can include libraries outside your Team. Including a record
          never grants permission to edit it.
        </p>
        <ul className="m-0 list-none divide-y divide-(--t-border-line) p-0">
          {rows.slice((current - 1) * 10, current * 10).map((r) => (
            <li key={r.documentId} className="space-y-3 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <strong>{r.name}</strong>
                  <p className="my-1 text-sm text-(--t-ink-dim)">
                    {r.city ?? r.country} ·{" "}
                    {r.location ? "Mapped" : "No coordinates"}
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
                  Exclude
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {!rows.length && !resolving ? (
          <p role="status" className="py-6">
            No matching published libraries. Change the sources or filters.
          </p>
        ) : null}
        <nav
          className="mt-4 flex justify-between gap-3"
          aria-label="Selected library pages"
        >
          <Button
            variant="surface"
            size="pill"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            Previous
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
            Next
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
                  Undo exclusion
                </Button>
              </li>
            ))}
          </ul>
          {!spec.excludeLibraryIds.length ? (
            <p className="text-sm text-(--t-ink-dim)">No exclusions.</p>
          ) : null}
        </StaffPanel>
      ) : null}
      {unresolvedIds.length ? (
        <Notice
          tone="warn"
          icon="mdi:eye-off-outline"
          title="Unresolved library references"
        >
          <p>
            These records are unpublished, deleted or do not pass the current
            filters. They are excluded from public counts.
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
