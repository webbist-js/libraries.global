"use client"
import {
  FACILITY_CHECKLIST,
  SUPPORTED_LOCALES,
  WIDGET_ACCENTS,
  WIDGET_TYPES,
  type WidgetConfig,
} from "@repo/shared-data"
import { useState } from "react"

import { SegmentedControl } from "@/components/ds/SegmentedControl"
import { SelectField } from "@/components/ds/SelectField"
import { Switch } from "@/components/ds/Switch"
import { StaffPanel, STAFF_FIELD } from "@/components/staff/StaffPanel"
import { WidgetField } from "@/components/widgets/WidgetControls"
import {
  widgetTypeLabels,
  type WidgetDraft,
  type WidgetWorkspace,
} from "@/lib/widgets/client"

type SettingsProps = {
  readonly draft: WidgetDraft
  readonly team: WidgetWorkspace["team"]
  readonly busy: boolean
  readonly edit: (update: Partial<WidgetDraft>) => void
}
const CHOICE_LABELS: Record<string, string> = {
  both: "Map and list",
  map: "Map",
  list: "List",
  cards: "Cards",
  libraries: "Number of libraries",
  facility: "Recorded feature",
  count: "Count",
  percentage: "Percentage",
  horizontal: "Horizontal",
  vertical: "Vertical",
  none: "No border",
  subtle: "Subtle",
  strong: "Strong",
  square: "Square",
  soft: "Softly rounded",
  round: "Round",
  comfortable: "Comfortable",
  compact: "Compact",
}
const languageNames = new Intl.DisplayNames(["en"], { type: "language" })
function formControls({ draft, team, busy, edit }: SettingsProps) {
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
          label: CHOICE_LABELS[value] ?? value,
        }))}
        disabled={!team.active || busy}
      />
    </WidgetField>
  )

  return { config, choose, switches }
}

function WidgetContentSettings(props: SettingsProps) {
  const { draft, edit, team, busy } = props
  const { config, choose, switches } = formControls(props)

  return (
    <div className="space-y-5">
      {draft.type === "chart" || draft.type === "stat" ? (
        <>
          {choose("metric", "Metric", ["libraries", "facility"])}
          {draft.config.metric === "facility" ? (
            <WidgetField label="Recorded feature">
              <SelectField
                label="Recorded feature"
                value={String(draft.config.facility)}
                onValueChange={(value) => config("facility", Number(value))}
                options={FACILITY_CHECKLIST.map((item, index) => ({
                  value: String(index),
                  label: item.label,
                }))}
                disabled={!team.active || busy}
              />
            </WidgetField>
          ) : null}
          {draft.config.metric === "facility"
            ? choose("chartMode", "Show values as", ["count", "percentage"])
            : null}
          <p className="rounded-xl bg-(--t-bg-surface) p-3 text-xs leading-relaxed text-(--t-ink-dim)">
            {draft.config.metric === "facility"
              ? "Yes, no and not recorded stay separate. Percentages use only libraries with a recorded answer."
              : "Counts show the number of libraries in each group. Choose a recorded feature to compare what those libraries offer."}
          </p>
          {draft.type === "chart"
            ? choose("orientation", "Chart orientation", [
                "horizontal",
                "vertical",
              ])
            : null}
        </>
      ) : null}
      <h3 className="type-h3 border-b border-(--t-border-line) pb-3">
        Title & introduction
      </h3>
      <WidgetField label="Public title">
        <input
          className={STAFF_FIELD}
          value={draft.config.title}
          maxLength={160}
          onChange={(e) => config("title", e.target.value)}
        />
      </WidgetField>
      <WidgetField label="Introduction">
        <textarea
          className={`${STAFF_FIELD} min-h-20`}
          maxLength={1000}
          value={draft.config.introduction}
          onChange={(e) => config("introduction", e.target.value)}
        />
      </WidgetField>
      <details className="border-t border-(--t-border-line) pt-3">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold">
          Language, accessibility & internal name
        </summary>
        <div className="space-y-5 pt-2">
          <WidgetField
            label="Internal widget name"
            hint="Only your Team sees this."
          >
            <input
              className={STAFF_FIELD}
              value={draft.name}
              maxLength={120}
              onChange={(event) => edit({ name: event.target.value })}
            />
          </WidgetField>
          <WidgetField
            label="Accessible description"
            hint="Describe the purpose and population of this widget."
          >
            <textarea
              className={`${STAFF_FIELD} min-h-20`}
              maxLength={1500}
              value={draft.config.description}
              onChange={(e) => config("description", e.target.value)}
            />
          </WidgetField>
          <WidgetField label="Content language">
            <SelectField
              label="Content language"
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
            Published translations are used where available; English fallback is
            labelled on each record.
          </p>
        </div>
      </details>
      {draft.type === "directory" ? (
        <>
          {choose("directoryLayout", "Directory layout", ["cards", "list"])}
          <WidgetField label="Libraries per page">
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
        ? choose("mapMode", "Default presentation", ["both", "map", "list"])
        : null}
      {draft.type === "finder" || draft.type === "directory" ? (
        <details className="border-t border-(--t-border-line) pt-3">
          <summary className="min-h-11 cursor-pointer text-sm font-semibold">
            Library information
          </summary>
          {switches([
            [
              "showHours",
              "Opening information",
              "Regular recorded hours, with a link for temporary changes.",
            ],
            [
              "showAccess",
              "Accessibility information",
              "Unknown values remain not recorded.",
            ],
            ["showLinks", "Links to original library records"],
          ])}
        </details>
      ) : null}
    </div>
  )
}

function WidgetAppearanceSettings(props: SettingsProps) {
  const { draft, team } = props
  const { config, choose, switches } = formControls(props)

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">Accent colour</legend>
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
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </label>
          ))}
        </div>
      </fieldset>
      {choose("border", "Border", ["none", "subtle", "strong"])}
      {choose("radius", "Corners", ["square", "soft", "round"])}
      {choose("density", "Spacing", ["comfortable", "compact"])}
      <WidgetField
        label="Fallback iframe height"
        hint="Between 240 and 1,600 pixels. Optional auto-height works within the same bounds."
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
        <h3 className="type-h3">Branding</h3>
        <Switch
          label="Hide Powered by Libraries Global"
          checked={draft.config.hidePowered}
          disabled={
            (!team.branding && !draft.config.hidePowered) || !team.active
          }
          onChange={(v) => config("hidePowered", v)}
          description={
            team.branding
              ? "Widget branding entitlement is active."
              : "Requires the Widget branding add-on. Contact Libraries Global for availability."
          }
        />
        {switches([["showPublisher", "Show the publishing organisation"]])}
        <p className="text-xs text-(--t-ink-dim)">
          Map attribution and source credits are always displayed.
        </p>
      </div>
    </div>
  )
}

function WidgetInteractionSettings(props: SettingsProps) {
  const { draft } = props
  const { switches } = formControls(props)

  return (
    <div>
      {switches(
        draft.type === "finder"
          ? [
              ["search", "Search within the selection"],
              ["facilityFilter", "Offer step-free entrance filter"],
              [
                "locate",
                "Offer Use my location",
                "Requested only on click. Never stored.",
              ],
              ["clusters", "Group nearby map markers"],
              ["labels", "Always show map labels"],
              ["reset", "Reset view button"],
            ]
          : draft.type === "directory"
            ? [
                ["search", "Search within the selection"],
                ["facilityFilter", "Offer step-free entrance filter"],
              ]
            : draft.type === "chart"
              ? [
                  ["valueLabels", "Value labels"],
                  ["showTable", "Show data table by default"],
                ]
              : [["showPublisher", "Show the publishing organisation"]]
      )}
    </div>
  )
}

export function WidgetSettingsPanel(props: SettingsProps) {
  const { draft, team, busy, edit } = props
  const [tab, setTab] = useState("content")

  return (
    <StaffPanel compact>
      <fieldset disabled={!team.active || busy} className="space-y-5">
        <WidgetField label="Widget type">
          <SelectField
            label="Widget type"
            value={draft.type}
            onValueChange={(value) =>
              edit({ type: value as typeof draft.type })
            }
            options={WIDGET_TYPES.map((value) => ({
              value,
              label: widgetTypeLabels[value],
            }))}
            disabled={!team.active || busy}
          />
        </WidgetField>
        <SegmentedControl
          label="Widget settings"
          layout="equal"
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: "content", label: "Content" },
            { value: "appearance", label: "Appearance" },
            { value: "interaction", label: "Interaction" },
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
