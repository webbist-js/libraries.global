"use client"

import {
  defaultWidgetConfig,
  emptyWidgetSelection,
  type WidgetSelection,
  type WidgetSelectionSpec,
} from "@repo/shared-data"
import { useEffect, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ds/Badge"
import { Notice } from "@/components/ds/Notice"
import { SegmentedControl } from "@/components/ds/SegmentedControl"
import { StaffPanel, STAFF_FIELD } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { useWidgetResolution } from "@/components/widgets/useWidgetResolution"
import {
  CataloguePicker,
  WidgetError,
  WidgetField,
} from "@/components/widgets/WidgetControls"
import { WidgetSelectionFilters } from "@/components/widgets/WidgetSelectionFilters"
import { Link, useRouter } from "@/lib/navigation"
import { widgetRequest, type WidgetWorkspace } from "@/lib/widgets/client"

function initialSelectionSpec(
  initial: WidgetSelection | null,
  primaryNetwork: WidgetWorkspace["team"]["primaryNetwork"]
) {
  return (
    initial?.spec ?? {
      ...emptyWidgetSelection(),
      sources: primaryNetwork
        ? [
            {
              kind: "network" as const,
              documentId: primaryNetwork.documentId,
            },
          ]
        : [{ kind: "owning_team" as const }],
    }
  )
}

export function WidgetSelectionEditor({
  workspace,
  initial,
}: {
  readonly workspace: WidgetWorkspace
  readonly initial: WidgetSelection | null
}) {
  const router = useRouter(),
    team = workspace.team,
    initialSpec = initialSelectionSpec(initial, team.primaryNetwork)
  const [spec, setSpec] = useState<WidgetSelectionSpec>(initialSpec),
    [name, setName] = useState(initial?.name ?? "Our libraries"),
    [version, setVersion] = useState(initial?.version ?? 0),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(Boolean(initial)),
    [conflict, setConflict] = useState(false),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [networkNames, setNetworkNames] = useState<Record<string, string>>(
      team.primaryNetwork
        ? { [team.primaryNetwork.documentId]: team.primaryNetwork.name }
        : {}
    )

  const [discardOpen, setDiscardOpen] = useState(false)
  useEffect(() => {
    if (saved) return
    const prevent = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", prevent)

    return () => window.removeEventListener("beforeunload", prevent)
  }, [saved])
  const resolution = useWidgetResolution(
      team.documentId,
      spec,
      defaultWidgetConfig()
    ),
    names = useRef(new Map<string, string>())
  for (const row of resolution.data?.rows ?? [])
    names.current.set(row.documentId, row.name)
  const update = (next: WidgetSelectionSpec) => {
    setSpec(next)
    setSaved(false)
    setPage(1)
  }
  const rows = useMemo(
      () =>
        (resolution.data?.rows ?? []).filter((r) =>
          `${r.name} ${r.city ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase())
        ),
      [resolution.data, search]
    ),
    pages = Math.max(1, Math.ceil(rows.length / 20)),
    current = Math.min(page, pages)
  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await widgetRequest<WidgetSelection>(
        team.documentId,
        initial ? `/selections/${initial.documentId}` : "/selections",
        initial ? "PUT" : "POST",
        { name, spec, version }
      )
      setSpec(result.spec)
      setVersion(result.version)
      setSaved(true)
      setConflict(false)
      if (!initial)
        router.replace(`/staff/teams/widgets/selections/${result.documentId}`)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
      setConflict((e as { code?: string }).code === "version_conflict")
    } finally {
      setBusy(false)
    }
  }
  const loadTheir = async (keepMine = false) => {
    setBusy(true)
    try {
      const latest = await widgetRequest<WidgetWorkspace>(team.documentId)
      const row = latest.selections.find(
        (s) => s.documentId === initial?.documentId
      )
      if (!row) throw new Error("This selection is unavailable.")
      setVersion(row.version)
      if (!keepMine) {
        setSpec(row.spec)
        setName(row.name)
      }
      setConflict(false)
      setError(null)
      setSaved(!keepMine)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const importAccess = async () => {
    setBusy(true)
    setError(null)
    try {
      const access = await widgetRequest<{ libraryIds: string[] }>(
        team.documentId,
        "/access-libraries"
      )
      update({
        ...spec,
        membership: "fixed",
        sources: [],
        filters: {},
        includeLibraryIds: [
          ...new Set([
            ...(resolution.data?.rows.map((r) => r.documentId) ?? []),
            ...access.libraryIds,
          ]),
        ],
        excludeLibraryIds: spec.excludeLibraryIds,
      })
      if (!access.libraryIds.length)
        setError(
          "There are no approved library staff assignments to import. Pending claims are excluded."
        )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const disabled = !team.active || busy

  return (
    <div className="space-y-6">
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogTitle>Discard unsaved selection changes?</DialogTitle>
          <DialogDescription>
            Your saved selection and published widgets will keep their current
            versions. Cancel to save these changes first.
          </DialogDescription>
          <div className="flex justify-end gap-3">
            <Button
              variant="surface"
              size="pill"
              onClick={() => setDiscardOpen(false)}
            >
              Keep editing
            </Button>
            <Button
              variant="primary"
              size="pill"
              onClick={() => router.push("/staff/teams/widgets")}
            >
              Discard and return
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SelectionResolutionStatus resolution={resolution} saved={saved} />
      <WidgetError error={error} />
      {conflict ? (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="surface"
            size="pill"
            disabled={busy}
            onClick={() => loadTheir()}
          >
            Load their version
          </Button>
          <Button
            variant="surface"
            size="pill"
            disabled={busy}
            onClick={() => loadTheir(true)}
          >
            Keep mine for review on top
          </Button>
        </div>
      ) : null}
      {!team.active ? (
        <Notice
          tone="warn"
          title="Team inactive — selection is read only"
          icon="mdi:pause-circle-outline"
        />
      ) : null}
      {initial?.usedBy?.length ? (
        <Notice
          tone="info"
          title={`Used by ${initial.usedBy.length} widgets`}
          icon="mdi:link-variant"
        >
          <p>
            {initial.usedBy.map((w) => `${w.name} (${w.state})`).join(", ")}.
            Saving updates their drafts. Each live widget keeps its published
            definition until an organiser republishes it. Follow-source
            membership can still change automatically.
          </p>
        </Notice>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-6">
          <StaffPanel title="Library sources" compact>
            <div className="space-y-5">
              <WidgetField label="Selection name">
                <input
                  className={STAFF_FIELD}
                  value={name}
                  maxLength={120}
                  disabled={disabled}
                  onChange={(e) => {
                    setName(e.target.value)
                    setSaved(false)
                  }}
                />
              </WidgetField>
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={spec.sources.some((s) => s.kind === "owning_team")}
                  onChange={(e) =>
                    update({
                      ...spec,
                      sources: e.target.checked
                        ? [...spec.sources, { kind: "owning_team" }]
                        : spec.sources.filter((s) => s.kind !== "owning_team"),
                    })
                  }
                />
                <span>
                  <strong>Team libraries</strong>
                  <small className="block text-(--t-ink-dim)">
                    {team.libraryCount ?? "Your covered"} libraries. This does
                    not change Team coverage.
                  </small>
                </span>
              </label>
              {team.primaryNetwork &&
              !spec.sources.some(
                (s) =>
                  s.kind === "network" &&
                  s.documentId === team.primaryNetwork?.documentId
              ) ? (
                <Button
                  variant="surface"
                  size="pill"
                  disabled={disabled}
                  onClick={() =>
                    update({
                      ...spec,
                      sources: [
                        {
                          kind: "network",
                          documentId: team.primaryNetwork!.documentId,
                        },
                        ...spec.sources,
                      ],
                    })
                  }
                >
                  Use {team.primaryNetwork.name}
                </Button>
              ) : null}
              <CataloguePicker
                teamId={team.documentId}
                kind="networks"
                label="Library service or network"
                disabled={disabled}
                onPick={(row) => {
                  setNetworkNames((n) => ({ ...n, [row.documentId]: row.name }))
                  if (
                    !spec.sources.some(
                      (s) =>
                        s.kind === "network" && s.documentId === row.documentId
                    )
                  )
                    update({
                      ...spec,
                      sources: [
                        ...spec.sources,
                        { kind: "network", documentId: row.documentId },
                      ],
                    })
                }}
              />
              {spec.sources
                .filter((s) => s.kind === "network")
                .map((s) =>
                  s.kind === "network" ? (
                    <div
                      className="rounded-xl bg-(--t-bg-surface) p-3 text-sm"
                      key={s.documentId}
                    >
                      <strong>
                        {networkNames[s.documentId] ??
                          resolution.data?.sourceLabels?.[s.documentId] ??
                          `Network ${s.documentId}`}
                      </strong>
                      <Button
                        className="min-h-11 px-0"
                        variant="link"
                        disabled={disabled}
                        onClick={() =>
                          update({
                            ...spec,
                            sources: spec.sources.filter((v) => v !== s),
                          })
                        }
                      >
                        Remove source
                      </Button>
                    </div>
                  ) : null
                )}
              <Button
                variant="surface"
                size="pill"
                disabled={disabled || resolution.busy || !resolution.data}
                onClick={importAccess}
              >
                Import libraries I have access to
              </Button>
              <p className="text-xs text-(--t-ink-dim)">
                Copies approved staff assignments into a fixed Team-owned list.
                Pending claims are excluded; leaving the Team does not change
                that list.
              </p>
              <CataloguePicker
                teamId={team.documentId}
                kind="libraries"
                label="Add any published library"
                disabled={disabled}
                onPick={(r) => {
                  names.current.set(r.documentId, r.name)
                  update({
                    ...spec,
                    includeLibraryIds: [
                      ...new Set([...spec.includeLibraryIds, r.documentId]),
                    ],
                    excludeLibraryIds: spec.excludeLibraryIds.filter(
                      (id) => id !== r.documentId
                    ),
                  })
                }}
              />
            </div>
          </StaffPanel>
          <WidgetSelectionFilters
            team={team}
            spec={spec}
            update={update}
            disabled={disabled}
            resolved={resolution.data}
          />
          <StaffPanel title="Membership" compact>
            <SegmentedControl
              label="Selection membership"
              value={spec.membership}
              options={[
                { value: "follow_sources", label: "Follow source" },
                { value: "fixed", label: "Fixed list" },
              ]}
              onChange={(membership) => {
                if (!disabled) update({ ...spec, membership })
              }}
            />
            <p className="mt-3 text-sm text-(--t-ink-dim)">
              {spec.membership === "fixed"
                ? "Saving pins the chosen identities. Their published facts stay current; this is not a historical snapshot."
                : "New public service members can appear automatically. Additional staff access requires a separate batch review."}
            </p>
          </StaffPanel>
        </div>
        <div className="space-y-6">
          <WidgetError error={resolution.error} />
          {resolution.error ? (
            <Button
              variant="surface"
              size="pill"
              onClick={() => resolution.retry()}
            >
              Retry data
            </Button>
          ) : null}
          <StaffPanel title="Selected libraries">
            <label className="mb-4 block">
              <span className="sr-only">Search selected libraries</span>
              <input
                className={STAFF_FIELD}
                type="search"
                placeholder="Search selected libraries"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </label>
            <p className="mb-4 text-sm text-(--t-ink-dim)">
              Selections can include libraries outside your Team. Including a
              record never grants permission to edit it.
            </p>
            <ul className="m-0 list-none divide-y divide-(--t-border-line) p-0">
              {rows.slice((current - 1) * 20, current * 20).map((r) => (
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
                            ...new Set([
                              ...spec.excludeLibraryIds,
                              r.documentId,
                            ]),
                          ],
                        })
                      }
                    >
                      Exclude
                    </Button>
                  </div>
                  {spec.groups.length ? (
                    <fieldset>
                      <legend className="sr-only">
                        Comparison groups for {r.name}
                      </legend>
                      <div className="flex flex-wrap gap-4">
                        {spec.groups.map((g) => (
                          <label
                            key={g.id}
                            className="flex min-h-11 items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              disabled={disabled}
                              checked={g.libraryIds.includes(r.documentId)}
                              onChange={(e) =>
                                update(
                                  withGroupMembership(
                                    spec,
                                    g.id,
                                    r.documentId,
                                    e.target.checked
                                  )
                                )
                              }
                            />
                            {g.name}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}
                </li>
              ))}
            </ul>
            {!rows.length && !resolution.busy ? (
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
                  <span>{names.current.get(id) ?? id}</span>
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
          {resolution.data?.diagnostics.unresolvedIds.length ? (
            <Notice
              tone="warn"
              icon="mdi:eye-off-outline"
              title="Unresolved library references"
            >
              <p>
                These records are unpublished, deleted or do not pass the
                current filters. They are excluded from public counts.
              </p>
              <ul>
                {resolution.data.diagnostics.unresolvedIds.map((id) => (
                  <li key={id}>{names.current.get(id) ?? id}</li>
                ))}
              </ul>
            </Notice>
          ) : null}
          <StaffPanel title="Comparison groups" compact>
            <p className="mb-4 text-sm text-(--t-ink-dim)">
              Give each group a name, then assign libraries using the checkboxes
              above. Groups may overlap; charts describe their populations
              separately.
            </p>
            {spec.groups.map((g, i) => (
              <div key={g.id} className="mb-3 flex items-center gap-3">
                <WidgetField label={`Group ${i + 1} name`}>
                  <input
                    className={STAFF_FIELD}
                    value={g.name}
                    maxLength={100}
                    disabled={disabled}
                    onChange={(e) =>
                      update({
                        ...spec,
                        groups: spec.groups.map((v) =>
                          v.id === g.id ? { ...v, name: e.target.value } : v
                        ),
                      })
                    }
                  />
                </WidgetField>
                <span className="text-sm">{g.libraryIds.length} libraries</span>
                <Button
                  variant="link"
                  className="min-h-11"
                  disabled={disabled}
                  onClick={() =>
                    update({
                      ...spec,
                      groups: spec.groups.filter((v) => v.id !== g.id),
                    })
                  }
                >
                  Remove<span className="sr-only"> group {i + 1}</span>
                </Button>
              </div>
            ))}
            <Button
              variant="surface"
              size="pill"
              disabled={disabled || spec.groups.length >= 12}
              onClick={() =>
                update({
                  ...spec,
                  groups: [
                    ...spec.groups,
                    {
                      id: crypto.randomUUID(),
                      name: `Group ${spec.groups.length + 1}`,
                      libraryIds: [],
                    },
                  ],
                })
              }
            >
              Add comparison group
            </Button>
          </StaffPanel>
        </div>
      </div>
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--t-border-line) bg-white p-4 shadow-lg">
        <Link
          className="inline-flex min-h-11 items-center font-semibold text-(--t-accent-primary) underline"
          href="/staff/teams/widgets"
          onClick={(event) => {
            if (!saved) {
              event.preventDefault()
              setDiscardOpen(true)
            }
          }}
        >
          Back to widgets
        </Link>
        <p role="status" className="m-0 text-sm">
          {saved
            ? "Selection saved. Live widgets keep their published definition."
            : "Save the selection, then review affected widgets before publishing."}
        </p>
        <Button
          variant="primary"
          size="pill"
          disabled={
            disabled ||
            resolution.busy ||
            !resolution.data ||
            conflict ||
            !name.trim()
          }
          onClick={save}
        >
          {busy ? "Saving…" : "Save selection"}
        </Button>
      </div>
    </div>
  )
}

function withGroupMembership(
  spec: WidgetSelectionSpec,
  groupId: string,
  libraryId: string,
  checked: boolean
): WidgetSelectionSpec {
  return {
    ...spec,
    groups: spec.groups.map((group) =>
      group.id === groupId
        ? {
            ...group,
            libraryIds: checked
              ? [...group.libraryIds, libraryId]
              : group.libraryIds.filter((id) => id !== libraryId),
          }
        : group
    ),
  }
}

function SelectionResolutionStatus({
  resolution,
  saved,
}: {
  readonly resolution: ReturnType<typeof useWidgetResolution>
  readonly saved: boolean
}) {
  const text = resolution.busy
    ? "Resolving selection…"
    : resolution.data
      ? `${resolution.data.diagnostics.selected} selected · ${resolution.data.diagnostics.mapped} mapped · ${resolution.data.diagnostics.missingCoordinates} missing coordinates`
      : "Selection data unavailable"

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <p className="m-0 text-(--t-ink-dim)">{text}</p>
      <span role="status">
        {saved ? "Selection saved" : "Unpublished selection changes"}
      </span>
    </div>
  )
}
