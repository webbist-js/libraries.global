"use client"
import { Icon } from "@iconify/react"
import type {
  WidgetSelection,
  WidgetResolved,
  WidgetType,
} from "@repo/shared-data"
import { useState } from "react"

import { SegmentedControl } from "@/components/ds/SegmentedControl"
import { SelectField } from "@/components/ds/SelectField"
import { StaffPanel } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import type { useWidgetDraft } from "@/components/widgets/useWidgetDraft"
import type { useWidgetResolution } from "@/components/widgets/useWidgetResolution"
import { WidgetError, WidgetField } from "@/components/widgets/WidgetControls"
import { WidgetRowsTable } from "@/components/widgets/WidgetRowsTable"
import { WidgetSettingsPanel } from "@/components/widgets/WidgetSettingsPanel"
import { WidgetView } from "@/components/widgets/WidgetView"
import { useRouter } from "@/lib/navigation"
import type { WidgetWorkspace } from "@/lib/widgets/client"

type BuilderProps = {
  readonly workspace: WidgetWorkspace
  readonly state: ReturnType<typeof useWidgetDraft>
  readonly selection: WidgetSelection | null
  readonly resolution: ReturnType<typeof useWidgetResolution>
  readonly busy: boolean
  readonly siteUrl: string
}

function selectionSummary(data: WidgetResolved | null, type: WidgetType) {
  if (!data) return "Resolving published data…"
  const { selected, mapped, missingCoordinates } = data.diagnostics
  if (type === "chart" || type === "stat")
    return `${selected} published libraries`

  return `${selected} selected · ${mapped} mapped${missingCoordinates ? ` · ${missingCoordinates} without coordinates` : ""}`
}

function WidgetBuilderSelection({
  workspace,
  state,
  selection,
  resolution,
  busy,
}: BuilderProps & { readonly mobileView: string }) {
  const team = workspace.team
  const { draft, edit, phase, widget } = state
  const router = useRouter()

  return (
    <StaffPanel title="Library selection" compact>
      <p className="mt-2 text-sm text-(--t-ink-dim)">
        {selectionSummary(resolution.data, draft.type)}
      </p>
      <fieldset disabled={!team.active || busy} className="mt-4">
        <WidgetField label="Use a selection">
          <SelectField
            label="Use a selection"
            value={draft.selectionId}
            onValueChange={(selectionId) => edit({ selectionId })}
            disabled={!team.active || busy}
            options={workspace.selections.map((item) => ({
              value: item.documentId,
              label: item.name,
            }))}
          />
        </WidgetField>
      </fieldset>
      <Button
        variant="link"
        className="mt-3 min-h-11 px-0"
        disabled={
          !selection || busy || phase === "saving" || phase === "conflict"
        }
        onClick={async () => {
          if (phase !== "saved" && !(await state.save())) return
          router.push(
            `/staff/teams/widgets/selections/${selection!.documentId}?widget=${widget.documentId}${draft.type === "chart" ? "&tab=groups" : ""}`
          )
        }}
      >
        <Icon
          aria-hidden
          icon={draft.type === "chart" ? "mdi:chart-bar" : "mdi:pencil-outline"}
          width={17}
        />
        {draft.type === "chart"
          ? "Set up comparison groups"
          : "Edit library selection"}
      </Button>
      {draft.type === "chart" ? (
        <div className="mt-2 rounded-xl bg-(--t-bg-surface) p-3 text-sm">
          <strong className="block">
            {selection?.spec.groups.length
              ? `${selection.spec.groups.length} comparison ${selection.spec.groups.length === 1 ? "group" : "groups"}`
              : "Start with your comparison groups"}
          </strong>
          <p className="mt-1 text-xs text-(--t-ink-dim)">
            {selection?.spec.groups.length
              ? selection.spec.groups
                  .map((group) => `${group.name} (${group.libraryIds.length})`)
                  .join(" · ")
              : "Create two or more named groups, then choose a metric below. Until then, the preview shows the whole selection."}
          </p>
        </div>
      ) : (
        <p className="text-xs text-(--t-ink-dim)">
          This shared selection can also power your other widgets.
        </p>
      )}
    </StaffPanel>
  )
}

function WidgetBuilderPreview({
  workspace,
  state,
  selection,
  resolution,
  siteUrl,
  mobileView,
}: BuilderProps & { readonly mobileView: string }) {
  const team = workspace.team
  const { draft } = state
  const [device, setDevice] = useState("desktop")
  const [rows, setRows] = useState(false)

  return (
    <div
      className={`${mobileView === "preview" ? "block" : "hidden"} min-w-0 space-y-4 lg:sticky lg:top-(--sticky-content-top) lg:block`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="hidden sm:block">
          <SegmentedControl
            label="Preview width"
            value={device}
            onChange={setDevice}
            options={[
              { value: "desktop", label: "Desktop" },
              { value: "tablet", label: "Tablet" },
              { value: "phone", label: "Phone" },
            ]}
          />
        </div>
        <span className="text-sm font-semibold text-(--t-ink-dim) sm:hidden">
          Preview
        </span>
        <Button variant="surface" size="pill" onClick={() => setRows(!rows)}>
          <Icon aria-hidden icon="mdi:table" width={17} />
          {rows ? "Hide data" : "View data"}
        </Button>
      </div>
      <div className="flex items-center justify-between gap-3 px-1 text-xs text-(--t-ink-dim)">
        <span className="font-semibold tracking-wide uppercase">
          <span className="hidden sm:inline">Interactive </span>draft preview
        </span>
        <span role="status" className="hidden sm:inline">
          {resolution.busy
            ? "Updating…"
            : (
                {
                  desktop: "Fits your website column",
                  tablet: "Up to 720 px",
                  phone: "Up to 360 px",
                } as Record<string, string>
              )[device]}
        </span>
        <span className="sm:hidden">
          {resolution.busy ? "Updating…" : "Fits this screen"}
        </span>
      </div>
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
      <div
        className="min-w-0 overflow-x-auto rounded-3xl bg-(--t-bg-muted) p-2 sm:p-4"
        aria-busy={resolution.busy}
      >
        <div
          className="mx-auto max-w-full"
          style={{
            width:
              ({ phone: 360, tablet: 720 } as Record<string, number>)[device] ??
              "100%",
          }}
        >
          {resolution.data && selection ? (
            <WidgetView
              key={`${draft.type}:${draft.config.locale}:${draft.config.showTable}`}
              preview
              data={{
                ...resolution.data,
                type: draft.type,
                config: draft.config,
                spec: selection.spec,
                publisher: team.name,
              }}
              siteUrl={siteUrl}
            />
          ) : (
            <div className="min-h-80 rounded-2xl bg-white p-6">
              <p role="status">
                {resolution.busy
                  ? "Loading published library data…"
                  : "The preview is unavailable. Retry the data service."}
              </p>
            </div>
          )}
        </div>
      </div>
      {rows && resolution.data ? (
        <WidgetRowsTable rows={resolution.data.rows} />
      ) : null}
    </div>
  )
}

export function WidgetBuilder(props: BuilderProps) {
  const { workspace, state, busy } = props
  const team = workspace.team
  const { draft, edit } = state
  const [mobileView, setMobileView] = useState("configure")

  return (
    <>
      <div className="sticky top-(--sticky-content-top) z-20 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-2 lg:hidden">
        <SegmentedControl
          label="Builder view"
          value={mobileView}
          onChange={setMobileView}
          layout="equal"
          options={[
            { value: "configure", label: "Configure" },
            { value: "preview", label: "Preview" },
          ]}
        />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div
          className={`${mobileView === "configure" ? "block" : "hidden"} space-y-5 lg:block`}
        >
          <WidgetBuilderSelection {...props} mobileView={mobileView} />
          <WidgetSettingsPanel
            draft={draft}
            team={team}
            busy={busy}
            edit={edit}
          />
        </div>
        <WidgetBuilderPreview {...props} mobileView={mobileView} />
      </div>
    </>
  )
}
