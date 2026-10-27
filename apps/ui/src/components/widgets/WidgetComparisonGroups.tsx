"use client"

import { Icon } from "@iconify/react"
import type { WidgetResolved, WidgetSelectionSpec } from "@repo/shared-data"
import { useId, useState } from "react"

import { EmptyState } from "@/components/ds/EmptyState"
import { SearchField } from "@/components/ds/SearchField"
import { StaffPanel, STAFF_FIELD } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { WidgetField } from "@/components/widgets/WidgetControls"

type GroupEditorProps = {
  readonly spec: WidgetSelectionSpec
  readonly rows: WidgetResolved["rows"]
  readonly disabled: boolean
  readonly loading?: boolean
  readonly update: (spec: WidgetSelectionSpec) => void
}

export function WidgetComparisonGroups(props: GroupEditorProps) {
  if (props.loading)
    return (
      <StaffPanel title="Comparison groups" compact>
        <p role="status" className="py-8 text-sm text-(--t-ink-dim)">
          Loading selected libraries…
        </p>
      </StaffPanel>
    )

  return <ComparisonGroupEditor {...props} />
}

function ComparisonGroupEditor({
  spec,
  rows,
  disabled,
  update,
}: GroupEditorProps) {
  const id = useId()
  const [activeId, setActiveId] = useState(spec.groups[0]?.id ?? "")
  const [query, setQuery] = useState("")
  const active = spec.groups.find((g) => g.id === activeId) ?? spec.groups[0]
  const visible = rows.filter((r) =>
    `${r.name} ${r.city ?? ""}`.toLowerCase().includes(query.toLowerCase())
  )
  const patch = (change: Partial<WidgetSelectionSpec["groups"][number]>) =>
    update({
      ...spec,
      groups: spec.groups.map((g) =>
        g.id === active?.id ? { ...g, ...change } : g
      ),
    })
  function add() {
    const next = {
      id: crypto.randomUUID(),
      name: `Group ${spec.groups.length + 1}`,
      libraryIds: [],
    }
    update({ ...spec, groups: [...spec.groups, next] })
    setActiveId(next.id)
    setQuery("")
  }
  function move(direction: number) {
    const groups = [...spec.groups]
    const index = groups.findIndex((g) => g.id === active?.id)
    const target = Math.min(Math.max(index + direction, 0), groups.length - 1)
    const [moved] = groups.splice(index, 1)
    if (!moved) return
    groups.splice(target, 0, moved)
    update({ ...spec, groups })
  }

  return (
    <StaffPanel
      title="Comparison groups"
      compact
      aside={
        <span className="text-xs text-(--t-ink-dim)">
          {spec.groups.length} of 12 groups
        </span>
      }
    >
      <p className="mb-5 text-sm text-(--t-ink-dim)">
        Each group becomes a bar in your chart. Name a group, then choose the
        libraries it contains. For example, compare city branches with rural
        branches. A library can appear in more than one group. Assign new source
        libraries here when you want them included in a group.
      </p>
      {!spec.groups.length ? (
        <EmptyState
          compact
          icon="mdi:chart-bar"
          lead="What would you like to compare?"
          detail="Create at least two groups for a useful comparison. Without groups, the chart shows the whole selection as one bar."
          action={
            <Button
              variant="primary"
              size="pill"
              disabled={disabled}
              onClick={add}
            >
              Create first group
            </Button>
          }
        />
      ) : (
        <>
          <div
            className="mb-5 flex flex-wrap gap-2"
            role="group"
            aria-label="Choose comparison group"
          >
            {spec.groups.map((g, index) => (
              <Button
                key={g.id}
                variant={g.id === active?.id ? "primary" : "surface"}
                size="pill"
                aria-pressed={g.id === active?.id}
                onClick={() => {
                  setActiveId(g.id)
                  setQuery("")
                }}
              >
                <span className="opacity-60">{index + 1}.</span>{" "}
                {g.name || "Unnamed group"}
                <span className="opacity-70">
                  (
                  {
                    g.libraryIds.filter((value) =>
                      rows.some((row) => row.documentId === value)
                    ).length
                  }
                  )
                </span>
              </Button>
            ))}
            <Button
              variant="surface"
              size="pill"
              disabled={disabled || spec.groups.length >= 12}
              onClick={add}
            >
              <Icon aria-hidden icon="mdi:plus" width={17} />
              Add group
            </Button>
          </div>
          {active ? (
            <div className="space-y-4 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-4 sm:p-5">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-44 flex-1">
                  <WidgetField label="Group name">
                    <input
                      className={STAFF_FIELD}
                      value={active.name}
                      maxLength={100}
                      disabled={disabled}
                      onChange={(event) => patch({ name: event.target.value })}
                    />
                  </WidgetField>
                </div>
                <Button
                  variant="surface"
                  size="icon-lg"
                  className="size-11 rounded-full"
                  aria-label="Move group earlier"
                  disabled={disabled || active.id === spec.groups[0]?.id}
                  onClick={() => move(-1)}
                >
                  <Icon aria-hidden icon="mdi:arrow-left" width={18} />
                </Button>
                <Button
                  variant="surface"
                  size="icon-lg"
                  className="size-11 rounded-full"
                  aria-label="Move group later"
                  disabled={disabled || active.id === spec.groups.at(-1)?.id}
                  onClick={() => move(1)}
                >
                  <Icon aria-hidden icon="mdi:arrow-right" width={18} />
                </Button>
                <Button
                  variant="link"
                  disabled={disabled}
                  onClick={() =>
                    update({
                      ...spec,
                      groups: spec.groups.filter((g) => g.id !== active.id),
                    })
                  }
                >
                  Remove group
                </Button>
              </div>
              <SearchField
                id={`${id}-search`}
                placeholder="Find libraries to add to this group"
                size="sm"
                onClear={() => setQuery("")}
                inputProps={{
                  value: query,
                  onChange: (event) => setQuery(event.target.value),
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span role="status">
                  {
                    active.libraryIds.filter((value) =>
                      rows.some((row) => row.documentId === value)
                    ).length
                  }{" "}
                  of {rows.length} libraries assigned
                </span>
                <div className="flex gap-3">
                  <Button
                    variant="link"
                    disabled={disabled || !visible.length}
                    onClick={() =>
                      patch({
                        libraryIds: [
                          ...new Set([
                            ...active.libraryIds,
                            ...visible.map((r) => r.documentId),
                          ]),
                        ],
                      })
                    }
                  >
                    {query ? "Select matches" : "Select all"}
                  </Button>
                  <Button
                    variant="link"
                    disabled={disabled || !active.libraryIds.length}
                    onClick={() => patch({ libraryIds: [] })}
                  >
                    Clear group
                  </Button>
                </div>
              </div>
              <fieldset
                disabled={disabled}
                className="max-h-80 overflow-y-auto rounded-xl border border-(--t-border-line) bg-(--t-bg-deep)"
              >
                <legend className="sr-only">Libraries in {active.name}</legend>
                {visible.map((row) => (
                  <label
                    key={row.documentId}
                    className="flex min-h-14 cursor-pointer items-center gap-3 border-b border-(--t-border-line) px-4 py-3 last:border-0 hover:bg-(--t-bg-surface)"
                  >
                    <input
                      className="size-4 shrink-0 accent-(--t-accent-primary)"
                      type="checkbox"
                      checked={active.libraryIds.includes(row.documentId)}
                      onChange={(event) =>
                        patch({
                          libraryIds: event.target.checked
                            ? [
                                ...new Set([
                                  ...active.libraryIds,
                                  row.documentId,
                                ]),
                              ]
                            : active.libraryIds.filter(
                                (value) => value !== row.documentId
                              ),
                        })
                      }
                    />
                    <span className="text-sm">
                      <strong className="block">{row.name}</strong>
                      <span className="text-xs text-(--t-ink-dim)">
                        {row.city ?? row.country}
                      </span>
                    </span>
                  </label>
                ))}
                {!visible.length ? (
                  <p className="p-5 text-sm text-(--t-ink-dim)">
                    {rows.length
                      ? "No matching libraries. Try another name."
                      : "Add libraries to this selection first, then assign them here."}
                  </p>
                ) : null}
              </fieldset>
              <UnresolvedGroupMembers
                libraryIds={active.libraryIds}
                rows={rows}
              />
            </div>
          ) : null}
        </>
      )}
    </StaffPanel>
  )
}

function UnresolvedGroupMembers({
  libraryIds,
  rows,
}: {
  readonly libraryIds: string[]
  readonly rows: WidgetResolved["rows"]
}) {
  if (!libraryIds.some((id) => !rows.some((row) => row.documentId === id)))
    return null

  return (
    <p className="text-xs text-(--t-ink-dim)">
      Some assigned libraries are outside the current selection. They are
      retained in this group but excluded from the chart.
    </p>
  )
}
