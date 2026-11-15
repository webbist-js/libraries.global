"use client"
import type { WidgetSelectionSpec, WidgetResolved } from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { SegmentedControl } from "@/components/ds/SegmentedControl"
import { StaffPanel, STAFF_FIELD } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import {
  CataloguePicker,
  WidgetField,
} from "@/components/widgets/WidgetControls"
import { WidgetSelectionFilters } from "@/components/widgets/WidgetSelectionFilters"
import type { CatalogueOption, WidgetWorkspace } from "@/lib/widgets/client"

export function WidgetSelectionSources({
  team,
  spec,
  name,
  disabled,
  resolved,
  resolving,
  update,
  onRename,
  onImportAccess,
  onAddLibrary,
}: {
  readonly team: WidgetWorkspace["team"]
  readonly spec: WidgetSelectionSpec
  readonly name: string
  readonly disabled: boolean
  readonly resolving: boolean
  readonly resolved: WidgetResolved | null
  readonly update: (value: WidgetSelectionSpec) => void
  readonly onRename: (value: string) => void
  readonly onImportAccess: () => Promise<void>
  readonly onAddLibrary: (value: CatalogueOption) => void
}) {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const [networkNames, setNetworkNames] = useState<Record<string, string>>(
    team.primaryNetwork
      ? { [team.primaryNetwork.documentId]: team.primaryNetwork.name }
      : {}
  )

  return (
    <div className="space-y-6">
      <StaffPanel title={tStatic("widget.library_sources")} compact>
        <div className="space-y-5">
          <WidgetField label={tStatic("widget.selection_name")}>
            <input
              className={STAFF_FIELD}
              value={name}
              maxLength={120}
              disabled={disabled}
              onChange={(event) => onRename(event.target.value)}
            />
          </WidgetField>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              className="size-4 accent-(--t-accent-primary)"
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
              <strong>{tStatic("widget.team_libraries")}</strong>
              <small className="block text-(--t-ink-dim)">
                {team.libraryCount == null
                  ? tStatic("widget.teamCovered")
                  : tStatic("widget.teamCount", { count: team.libraryCount })}
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
            label={tStatic("widget.library_service_or_network")}
            disabled={disabled}
            onPick={(row) => {
              setNetworkNames((n) => ({ ...n, [row.documentId]: row.name }))
              if (
                !spec.sources.some(
                  (s) => s.kind === "network" && s.documentId === row.documentId
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
                      resolved?.sourceLabels?.[s.documentId] ??
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
                    {tExisting("articleSources.remove")}
                  </Button>
                </div>
              ) : null
            )}
          <Button
            variant="surface"
            size="pill"
            disabled={disabled || resolving || !resolved}
            onClick={onImportAccess}
          >
            {tStatic("widget.import_libraries_i_have_access_to")}
          </Button>
          <p className="text-xs text-(--t-ink-dim)">
            {tStatic(
              "widget.copies_approved_staff_assignments_into_a_fixed_team_owned_list_pending_claims_are_excluded_leaving_the_team_do"
            )}
          </p>
          <CataloguePicker
            teamId={team.documentId}
            kind="libraries"
            label={tStatic("widget.add_any_published_library")}
            disabled={disabled}
            onPick={onAddLibrary}
          />
        </div>
      </StaffPanel>
      <WidgetSelectionFilters
        team={team}
        spec={spec}
        update={update}
        disabled={disabled}
        resolved={resolved}
      />
      <StaffPanel title={tExisting("ui.membership")} compact>
        <SegmentedControl
          label={tStatic("widget.selection_membership")}
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
  )
}
