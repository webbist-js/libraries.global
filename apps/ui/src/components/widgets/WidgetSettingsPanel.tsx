"use client"
import {
  FACILITY_CHECKLIST,
  SUPPORTED_LOCALES,
  WIDGET_ACCENTS,
  WIDGET_TYPES,
  type WidgetConfig,
} from "@repo/shared-data"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { SegmentedControl } from "@/components/ds/SegmentedControl"
import { SelectField } from "@/components/ds/SelectField"
import { Switch } from "@/components/ds/Switch"
import { StaffPanel, STAFF_FIELD } from "@/components/staff/StaffPanel"
import { WidgetField } from "@/components/widgets/WidgetControls"
import type { WidgetDraft, WidgetWorkspace } from "@/lib/widgets/client"
import { widgetCopy } from "@/lib/widgets/copy"

type SettingsProps = {
  readonly draft: WidgetDraft
  readonly team: WidgetWorkspace["team"]
  readonly busy: boolean
  readonly edit: (update: Partial<WidgetDraft>) => void
}
function useFormControls({ draft, team, busy, edit }: SettingsProps) {
  const tSettings = useTranslations("widgetSettings")
  const config = (key: keyof WidgetConfig, value: unknown) =>
    edit({ config: { ...draft.config, [key]: value } })
  const switches = (items: [keyof WidgetConfig, string, string?][]) =>
    items.map(([key, label, description]) => (
      <Switch
        key={key}
        checked={Boolean(draft.config[key])}
        label={label}
        description={description}
        disabled={!team.active || busy}
        onChange={(value) => config(key, value)}
      />
    ))
  const choose = (
    key: keyof WidgetConfig,
    label: string,
    values: readonly string[]
  ) => (
    <WidgetField label={label}>
      <SelectField
        label={label}
        value={String(draft.config[key])}
        onValueChange={(value) => config(key, value)}
        options={values.map((value) => ({
          value,
          label: tSettings(value as Parameters<typeof tSettings>[0]),
        }))}
        disabled={!team.active || busy}
      />
    </WidgetField>
  )

  return { config, choose, switches }
}

function WidgetContentSettings(props: SettingsProps) {
  const tSettings = useTranslations("widgetSettings")

  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const locale = useLocale()
  const languageNames = new Intl.DisplayNames([locale], { type: "language" })
  const { draft, edit, team, busy } = props
  const { config, choose, switches } = useFormControls(props)

  return (
    <div className="space-y-5">
      {draft.type === "chart" || draft.type === "stat" ? (
        <>
          {choose("metric", tSettings("metric"), ["libraries", "facility"])}
          {draft.config.metric === "facility" ? (
            <WidgetField label={tStatic("widget.recorded_feature")}>
              <SelectField
                label={tStatic("widget.recorded_feature")}
                value={String(draft.config.facility)}
                onValueChange={(value) => config("facility", Number(value))}
                options={FACILITY_CHECKLIST.map((item, index) => ({
                  value: String(index),
                  label: widgetCopy(locale, item.label),
                }))}
                disabled={!team.active || busy}
              />
            </WidgetField>
          ) : null}
          {draft.config.metric === "facility"
            ? choose("chartMode", tSettings("chartMode"), [
                "count",
                "percentage",
              ])
            : null}
          <p className="rounded-xl bg-(--t-bg-surface) p-3 text-xs leading-relaxed text-(--t-ink-dim)">
            {draft.config.metric === "facility"
              ? tSettings("featureHelp")
              : tSettings("countHelp")}
          </p>
          {draft.type === "chart"
            ? choose("orientation", tSettings("orientation"), [
                "horizontal",
                "vertical",
              ])
            : null}
        </>
      ) : null}
      <h3 className="type-h3 border-b border-(--t-border-line) pb-3">
        {tStatic("widget.title_introduction")}
      </h3>
      <WidgetField label={tStatic("widget.public_title")}>
        <input
          className={STAFF_FIELD}
          value={draft.config.title}
          maxLength={160}
          onChange={(e) => config("title", e.target.value)}
        />
      </WidgetField>
      <WidgetField label={tStatic("widget.introduction")}>
        <textarea
          className={`${STAFF_FIELD} min-h-20`}
          maxLength={1000}
          value={draft.config.introduction}
          onChange={(e) => config("introduction", e.target.value)}
        />
      </WidgetField>
      <details className="border-t border-(--t-border-line) pt-3">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold">
          {tStatic("widget.language_accessibility_internal_name")}
        </summary>
        <div className="space-y-5 pt-2">
          <WidgetField
            label={tStatic("widget.internal_widget_name")}
            hint={tStatic("widget.only_your_team_sees_this")}
          >
            <input
              className={STAFF_FIELD}
              value={draft.name}
              maxLength={120}
              onChange={(event) => edit({ name: event.target.value })}
            />
          </WidgetField>
          <WidgetField
            label={tStatic("widget.accessible_description")}
            hint={tStatic(
              "widget.describe_the_purpose_and_population_of_this_widget"
            )}
          >
            <textarea
              className={`${STAFF_FIELD} min-h-20`}
              maxLength={1500}
              value={draft.config.description}
              onChange={(e) => config("description", e.target.value)}
            />
          </WidgetField>
          <WidgetField label={tExisting("discovery.languages")}>
            <SelectField
              label={tExisting("discovery.languages")}
              value={draft.config.locale}
              onValueChange={(value) => config("locale", value)}
              options={SUPPORTED_LOCALES.map((value) => ({
                value,
                label: languageNames.of(value) ?? value,
              }))}
              disabled={!team.active || busy}
            />
          </WidgetField>
          <p className="text-xs text-(--t-ink-dim)">
            {tStatic(
              "widget.published_translations_are_used_where_available_english_fallback_is_labelled_on_each_record"
            )}
          </p>
        </div>
      </details>
      {draft.type === "directory" ? (
        <>
          {choose("directoryLayout", tSettings("directoryLayout"), [
            "cards",
            "list",
          ])}
          <WidgetField label={tStatic("widget.libraries_per_page")}>
            <input
              className={STAFF_FIELD}
              type="number"
              min={1}
              max={50}
              value={draft.config.pageSize}
              onChange={(e) => config("pageSize", Number(e.target.value))}
            />
          </WidgetField>
        </>
      ) : null}
      {draft.type === "finder"
        ? choose("mapMode", tSettings("mapMode"), ["both", "map", "list"])
        : null}
      {draft.type === "finder" || draft.type === "directory" ? (
        <details className="border-t border-(--t-border-line) pt-3">
          <summary className="min-h-11 cursor-pointer text-sm font-semibold">
            {tStatic("widget.library_information")}
          </summary>
          {switches([
            ["showHours", tSettings("showHours"), tSettings("hoursHelp")],
            ["showAccess", tSettings("showAccess"), tSettings("accessHelp")],
            ["showLinks", tSettings("showLinks")],
          ])}
        </details>
      ) : null}
    </div>
  )
}

function WidgetAppearanceSettings(props: SettingsProps) {
  const tSettings = useTranslations("widgetSettings")

  const tStatic = useTranslations("staticUi")

  const { draft, team } = props
  const { config, choose, switches } = useFormControls(props)

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">
          {tStatic("widget.accent_colour")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(WIDGET_ACCENTS).map(([key, color]) => (
            <label
              key={key}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border p-2 pr-3 text-sm has-focus-visible:outline-3 has-focus-visible:outline-offset-2"
            >
              <input
                type="radio"
                name="widget-accent"
                checked={draft.config.accent === key}
                onChange={() => config("accent", key)}
                className="sr-only"
              />
              <span
                className="inline-flex size-7 items-center justify-center rounded-full text-white"
                style={{ background: color }}
              >
                {draft.config.accent === key ? "✓" : ""}
              </span>
              {tSettings(key as keyof typeof WIDGET_ACCENTS)}
            </label>
          ))}
        </div>
      </fieldset>
      {choose("border", tSettings("border"), ["none", "subtle", "strong"])}
      {choose("radius", tSettings("radius"), ["square", "soft", "round"])}
      {choose("density", tSettings("density"), ["comfortable", "compact"])}
      <WidgetField
        label={tStatic("widget.fallback_iframe_height")}
        hint={tStatic(
          "widget.between_240_and_1_600_pixels_optional_auto_height_works_within_the_same_bounds"
        )}
      >
        <input
          className={STAFF_FIELD}
          type="number"
          min={240}
          max={1600}
          value={draft.config.height}
          onChange={(e) => config("height", Number(e.target.value))}
        />
      </WidgetField>
      <div className="border-t border-(--t-border-line) pt-4">
        <h3 className="type-h3">{tStatic("widget.branding")}</h3>
        <Switch
          label={tStatic("widget.hide_powered_by_libraries_global")}
          checked={draft.config.hidePowered}
          disabled={
            (!team.branding && !draft.config.hidePowered) || !team.active
          }
          onChange={(v) => config("hidePowered", v)}
          description={
            team.branding
              ? tSettings("brandingActive")
              : tSettings("brandingRequired")
          }
        />
        {switches([["showPublisher", tSettings("showPublisher")]])}
        <p className="text-xs text-(--t-ink-dim)">
          {tStatic(
            "widget.map_attribution_and_source_credits_are_always_displayed"
          )}
        </p>
      </div>
    </div>
  )
}

function WidgetInteractionSettings(props: SettingsProps) {
  const tSettings = useTranslations("widgetSettings")

  const { draft } = props
  const { switches } = useFormControls(props)

  return (
    <div>
      {switches(
        draft.type === "finder"
          ? [
              ["search", tSettings("search")],
              ["facilityFilter", tSettings("facilityFilter")],
              ["locate", tSettings("locate"), tSettings("locateHelp")],
              ["clusters", tSettings("clusters")],
              ["labels", tSettings("labels")],
              ["reset", tSettings("reset")],
            ]
          : draft.type === "directory"
            ? [
                ["search", tSettings("search")],
                ["facilityFilter", tSettings("facilityFilter")],
              ]
            : draft.type === "chart"
              ? [
                  ["valueLabels", tSettings("valueLabels")],
                  ["showTable", tSettings("showTable")],
                ]
              : [["showPublisher", tSettings("showPublisher")]]
      )}
    </div>
  )
}

export function WidgetSettingsPanel(props: SettingsProps) {
  const tSettings = useTranslations("widgetSettings")

  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const { draft, team, busy, edit } = props
  const [tab, setTab] = useState("content")

  return (
    <StaffPanel compact>
      <fieldset disabled={!team.active || busy} className="space-y-5">
        <WidgetField label={tStatic("widget.widget_type")}>
          <SelectField
            label={tStatic("widget.widget_type")}
            value={draft.type}
            onValueChange={(value) =>
              edit({ type: value as typeof draft.type })
            }
            options={WIDGET_TYPES.map((value) => ({
              value,
              label: tSettings(value),
            }))}
            disabled={!team.active || busy}
          />
        </WidgetField>
        <SegmentedControl
          label={tStatic("widget.widget_settings")}
          layout="equal"
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: "content", label: tSettings("content") },
            {
              value: "appearance",
              label: tExisting("profileSettingsToolbar.appearance"),
            },
            { value: "interaction", label: tSettings("interaction") },
          ]}
        />
        {tab === "content" ? (
          <WidgetContentSettings
            draft={draft}
            team={team}
            busy={busy}
            edit={edit}
          />
        ) : null}
        {tab === "appearance" ? (
          <WidgetAppearanceSettings
            draft={draft}
            team={team}
            busy={busy}
            edit={edit}
          />
        ) : null}
        {tab === "interaction" ? (
          <WidgetInteractionSettings
            draft={draft}
            team={team}
            busy={busy}
            edit={edit}
          />
        ) : null}
      </fieldset>
    </StaffPanel>
  )
}
