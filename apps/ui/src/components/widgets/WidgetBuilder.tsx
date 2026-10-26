"use client"
import type { WidgetSelection } from "@repo/shared-data"
import { useState } from "react"

import { SegmentedControl } from "@/components/ds/SegmentedControl"
import { StaffPanel, STAFF_FIELD } from "@/components/staff/StaffPanel"
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

function WidgetBuilderSelection({
  workspace,
  state,
  selection,
  resolution,
  busy,
}: BuilderProps & { readonly mobileView: string }) {
  const team = workspace.team
  const { draft, edit, phase } = state
  const router = useRouter()

  return (
    <StaffPanel title="Library selection" compact>
      <p className="font-semibold">
        {selection?.name ?? "Selection unavailable"}
      </p>
      <p className="mt-2 text-sm text-(--t-ink-dim)">
        {resolution.data
          ? `${resolution.data.diagnostics.selected} selected · ${resolution.data.diagnostics.mapped} mapped · ${resolution.data.diagnostics.missingCoordinates} missing coordinates`
          : "Resolving published data…"}
      </p>
      <fieldset disabled={!team.active || busy} className="mt-4">
        <WidgetField label="Use a selection">
          <select
            className={STAFF_FIELD}
            value={draft.selectionId}
            onChange={(e) => edit({ selectionId: e.target.value })}
          >
            {workspace.selections.map((s) => (
              <option key={s.documentId} value={s.documentId}>
                {s.name}
              </option>
            ))}
          </select>
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
            `/staff/teams/widgets/selections/${selection!.documentId}`
          )
        }}
      >
        Edit sources, libraries and comparison groups
      </Button>
      <p className="text-xs text-(--t-ink-dim)">
        Public network membership can change automatically. Staff access to
        additions requires batch approval.
      </p>
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
      className={`${mobileView === "preview" ? "block" : "hidden"} min-w-0 space-y-4 lg:block`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Preview width"
          value={device}
          onChange={setDevice}
          options={[
            { value: "desktop", label: "Desktop" },
            { value: "tablet", label: "Tablet 720" },
            { value: "phone", label: "Phone 360" },
          ]}
        />
        <Button variant="surface" size="pill" onClick={() => setRows(!rows)}>
          {rows ? "Hide underlying rows" : "Inspect underlying rows"}
        </Button>
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
        className="min-w-0 overflow-x-auto rounded-3xl bg-(--t-bg-muted) p-2 sm:p-5"
        aria-busy={resolution.busy}
      >
        <div
          className="mx-auto max-w-full"
          style={{
            width:
              device === "phone" ? 360 : device === "tablet" ? 720 : "100%",
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
      <div className="sticky top-0 z-20 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-2 lg:hidden">
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
      <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
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
