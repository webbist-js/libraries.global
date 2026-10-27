"use client"
import {
  FACILITY_CHECKLIST,
  type WidgetSelectionSpec,
  type WidgetResolved,
} from "@repo/shared-data"
import { useState } from "react"

import { SelectField } from "@/components/ds/SelectField"
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
    <details className="rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6">
      <summary className="min-h-11 cursor-pointer font-sans text-2xl">
        Filter this selection
      </summary>
      <div className="space-y-4 pt-3">
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
          <SelectField
            label="Library type"
            disabled={disabled}
            value={spec.filters.libraryType ?? ""}
            onValueChange={(value) =>
              update({
                ...spec,
                filters: { ...spec.filters, libraryType: value || undefined },
              })
            }
            options={[
              { value: "", label: "All types" },
              ...[
                "Public",
                "Academic",
                "National",
                "School",
                "Special",
                "Community",
                "Mobile",
                "Digital",
              ].map((value) => ({ value, label: value })),
            ]}
          />
        </WidgetField>
        <WidgetField label="Recorded facility">
          <SelectField
            label="Recorded facility"
            disabled={disabled}
            value={String(spec.filters.facility ?? "")}
            onValueChange={(value) =>
              update({
                ...spec,
                filters: {
                  ...spec.filters,
                  facility: value === "" ? undefined : Number(value),
                },
              })
            }
            options={[
              { value: "", label: "Any recorded state" },
              ...FACILITY_CHECKLIST.map((item, index) => ({
                value: String(index),
                label: `${item.label}: yes`,
              })),
            ]}
          />
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
    </details>
  )
}
