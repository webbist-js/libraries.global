"use client"
import {
  FACILITY_CHECKLIST,
  type WidgetSelectionSpec,
  type WidgetResolved,
} from "@repo/shared-data"
import { useState } from "react"

import { StaffPanel, STAFF_FIELD } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import {
  CataloguePicker,
  WidgetField,
} from "@/components/widgets/WidgetControls"
import type { WidgetWorkspace } from "@/lib/widgets/client"

export function WidgetSelectionFilters({
  team,
  spec,
  update,
  disabled,
  resolved,
}: {
  readonly team: WidgetWorkspace["team"]
  readonly spec: WidgetSelectionSpec
  readonly update: (spec: WidgetSelectionSpec) => void
  readonly disabled: boolean
  readonly resolved: WidgetResolved | null
}) {
  const [countryName, setCountryName] = useState("")
  const [regionName, setRegionName] = useState("")
  const resolution = { data: resolved }

  return (
    <StaffPanel title="Filters" compact>
      <div className="space-y-4">
        <p className="text-sm text-(--t-ink-dim)">
          Filters narrow every source, including manual additions. Add a
          filtered source to start from the wider catalogue.
        </p>
        <CataloguePicker
          teamId={team.documentId}
          kind="countries"
          label={`Country${countryName ? `: ${countryName}` : spec.filters.country && resolution.data?.sourceLabels?.[spec.filters.country] ? `: ${resolution.data.sourceLabels[spec.filters.country]}` : ""}`}
          disabled={disabled}
          onPick={(r) => {
            setCountryName(r.name)
            setRegionName("")
            update({
              ...spec,
              filters: {
                ...spec.filters,
                country: r.documentId,
                region: undefined,
              },
            })
          }}
        />
        {spec.filters.country ? (
          <CataloguePicker
            teamId={team.documentId}
            kind="regions"
            country={spec.filters.country}
            label={`Region${regionName ? `: ${regionName}` : spec.filters.region && resolution.data?.sourceLabels?.[spec.filters.region] ? `: ${resolution.data.sourceLabels[spec.filters.region]}` : ""}`}
            disabled={disabled}
            onPick={(r) => {
              setRegionName(r.name)
              update({
                ...spec,
                filters: { ...spec.filters, region: r.documentId },
              })
            }}
          />
        ) : null}
        <WidgetField label="Library type">
          <select
            className={STAFF_FIELD}
            disabled={disabled}
            value={spec.filters.libraryType ?? ""}
            onChange={(e) =>
              update({
                ...spec,
                filters: {
                  ...spec.filters,
                  libraryType: e.target.value || undefined,
                },
              })
            }
          >
            <option value="">All types</option>
            {[
              "Public",
              "Academic",
              "National",
              "School",
              "Special",
              "Community",
              "Mobile",
              "Digital",
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </WidgetField>
        <WidgetField label="Recorded facility">
          <select
            className={STAFF_FIELD}
            disabled={disabled}
            value={spec.filters.facility ?? ""}
            onChange={(e) =>
              update({
                ...spec,
                filters: {
                  ...spec.filters,
                  facility:
                    e.target.value === "" ? undefined : Number(e.target.value),
                },
              })
            }
          >
            <option value="">Any recorded state</option>
            {FACILITY_CHECKLIST.map((c, i) => (
              <option key={c.label} value={i}>
                {c.label}: yes
              </option>
            ))}
          </select>
        </WidgetField>
        <Button
          variant="surface"
          size="pill"
          disabled={
            disabled ||
            !Object.values(spec.filters).some((v) => v !== undefined)
          }
          onClick={() =>
            update({
              ...spec,
              sources: [
                ...spec.sources.filter((s) => s.kind !== "catalogue_filter"),
                { kind: "catalogue_filter", filter: spec.filters },
              ],
            })
          }
        >
          Include matching catalogue libraries
        </Button>
        <Button
          variant="link"
          className="min-h-11"
          disabled={disabled}
          onClick={() => {
            setCountryName("")
            setRegionName("")
            update({
              ...spec,
              filters: {},
              sources: spec.sources.filter(
                (s) => s.kind !== "catalogue_filter"
              ),
            })
          }}
        >
          Clear filters and filtered source
        </Button>
      </div>
    </StaffPanel>
  )
}
