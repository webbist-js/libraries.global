"use client"
import {
  FACILITY_CHECKLIST,
  type WidgetSelectionSpec,
  type WidgetResolved,
} from "@repo/shared-data"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { SelectField } from "@/components/ds/SelectField"
import { Button } from "@/components/ui/button"
import {
  CataloguePicker,
  WidgetField,
} from "@/components/widgets/WidgetControls"
import type { WidgetWorkspace } from "@/lib/widgets/client"
import { widgetCopy } from "@/lib/widgets/copy"

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
  const tSettings = useTranslations("widgetSettings")
  const locale = useLocale()
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const [countryName, setCountryName] = useState("")
  const [regionName, setRegionName] = useState("")
  const resolution = { data: resolved }

  return (
    <details className="rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6">
      <summary className="min-h-11 cursor-pointer font-sans text-2xl">
        {tStatic("widget.filter_this_selection")}
      </summary>
      <div className="space-y-4 pt-3">
        <p className="text-sm text-(--t-ink-dim)">
          {tStatic(
            "widget.filters_narrow_every_source_including_manual_additions_add_a_filtered_source_to_start_from_the_wider_catalogue"
          )}
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
        <WidgetField label={tExisting("ui.library_type")}>
          <SelectField
            label={tExisting("ui.library_type")}
            disabled={disabled}
            value={spec.filters.libraryType ?? ""}
            onValueChange={(value) =>
              update({
                ...spec,
                filters: { ...spec.filters, libraryType: value || undefined },
              })
            }
            options={[
              { value: "", label: tSettings("allTypes") },
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
        <WidgetField label={tStatic("widget.recorded_facility")}>
          <SelectField
            label={tStatic("widget.recorded_facility")}
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
              { value: "", label: tSettings("anyState") },
              ...FACILITY_CHECKLIST.map((item, index) => ({
                value: String(index),
                label: tSettings("facilityYes", {
                  facility: widgetCopy(locale, item.label),
                }),
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
          {tStatic("widget.include_matching_catalogue_libraries")}
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
          {tStatic("widget.clear_filters_and_filtered_source")}
        </Button>
      </div>
    </details>
  )
}
