"use client"

import {
  defaultWidgetConfig,
  emptyWidgetSelection,
  type WidgetSelection,
  type WidgetSelectionSpec,
} from "@repo/shared-data"
import { useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { Notice } from "@/components/ds/Notice"
import { SegmentedControl } from "@/components/ds/SegmentedControl"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { useWidgetResolution } from "@/components/widgets/useWidgetResolution"
import { WidgetComparisonGroups } from "@/components/widgets/WidgetComparisonGroups"
import { WidgetError } from "@/components/widgets/WidgetControls"
import { WidgetSelectedLibraries } from "@/components/widgets/WidgetSelectedLibraries"
import { WidgetSelectionSources } from "@/components/widgets/WidgetSelectionSources"
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
    [conflict, setConflict] = useState(false)

  const params = useSearchParams()
  const widgetId = workspace.widgets.find(
    (widget) => widget.documentId === params.get("widget")
  )?.documentId
  const backHref = widgetId
    ? `/staff/teams/widgets/${widgetId}`
    : "/staff/teams/widgets"
  const [tab, setTab] = useState(
    params.get("tab") === "groups" ? "groups" : "libraries"
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
  }
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
      if (widgetId) router.push(backHref)
      else router.refresh()
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
              onClick={() => router.push(backHref)}
            >
              Discard and return
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SelectionResolutionStatus resolution={resolution} saved={saved} />
      <WidgetError error={error} />
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
          title={`Shared with ${initial.usedBy.length} ${initial.usedBy.length === 1 ? "widget" : "widgets"}`}
          icon="mdi:link-variant"
        >
          <p>
            Saving updates the drafts of{" "}
            {initial.usedBy.map((w) => w.name).join(", ")}. Publish each widget
            separately to update its live version. Selections that follow a
            source still pick up public membership changes.
          </p>
        </Notice>
      ) : null}
      <SegmentedControl
        label="Selection editor"
        value={tab}
        onChange={setTab}
        options={[
          { value: "libraries", label: "1. Choose libraries" },
          {
            value: "groups",
            label: `2. Comparison groups (${spec.groups.length})`,
          },
        ]}
      />
      {tab === "groups" ? (
        <WidgetComparisonGroups
          spec={spec}
          rows={resolution.data?.rows ?? []}
          loading={!resolution.data && resolution.busy}
          disabled={disabled}
          update={update}
        />
      ) : null}
      <div
        hidden={tab !== "libraries"}
        className={
          tab === "libraries"
            ? "grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]"
            : "hidden"
        }
      >
        <WidgetSelectionSources
          team={team}
          spec={spec}
          name={name}
          disabled={disabled}
          resolved={resolution.data}
          resolving={resolution.busy}
          update={update}
          onRename={(value) => {
            setName(value)
            setSaved(false)
          }}
          onImportAccess={importAccess}
          onAddLibrary={(row) => {
            names.current.set(row.documentId, row.name)
            update({
              ...spec,
              includeLibraryIds: [
                ...new Set([...spec.includeLibraryIds, row.documentId]),
              ],
              excludeLibraryIds: spec.excludeLibraryIds.filter(
                (id) => id !== row.documentId
              ),
            })
          }}
        />
        <WidgetSelectedLibraries
          spec={spec}
          publicRows={resolution.data?.rows ?? []}
          disabled={disabled}
          update={update}
          names={names.current}
          resolving={resolution.busy}
          unresolvedIds={resolution.data?.diagnostics.unresolvedIds ?? []}
        />
      </div>
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--t-border-line) bg-white p-4 shadow-lg">
        <SelectionBackLink
          href={backHref}
          saved={saved}
          inWidget={Boolean(widgetId)}
          onDiscard={() => setDiscardOpen(true)}
        />
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
          {busy
            ? "Saving…"
            : widgetId
              ? "Save & return to widget"
              : "Save selection"}
        </Button>
      </div>
    </div>
  )
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

function SelectionBackLink({
  href,
  saved,
  inWidget,
  onDiscard,
}: {
  readonly href: string
  readonly saved: boolean
  readonly inWidget: boolean
  readonly onDiscard: () => void
}) {
  return (
    <Link
      className="inline-flex min-h-11 items-center font-semibold text-(--t-accent-primary) underline"
      href={href}
      onClick={(event) => {
        if (!saved) {
          event.preventDefault()
          onDiscard()
        }
      }}
    >
      {inWidget ? "Back to widget" : "Back to widgets"}
    </Link>
  )
}
