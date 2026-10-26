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
      <select
        className={STAFF_FIELD}
        value={String(draft.config[key])}
        onChange={(e) => config(key, e.target.value)}
      >
        {values.map((v) => (
          <option key={v} value={v}>
            {CHOICE_LABELS[v] ?? v}
          </option>
        ))}
      </select>
    </WidgetField>
  )

  return { config, choose, switches }
}

function WidgetContentSettings(props: SettingsProps) {
  const { draft, edit } = props
  const { config, choose, switches } = formControls(props)

  return (
    <div className="space-y-5">
      <WidgetField label="Internal widget name">
        <input
          className={STAFF_FIELD}
          value={draft.name}
          maxLength={120}
          onChange={(e) => edit({ name: e.target.value })}
        />
      </WidgetField>
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
          className={`${STAFF_FIELD} min-h-24`}
          maxLength={1000}
          value={draft.config.introduction}
          onChange={(e) => config("introduction", e.target.value)}
        />
      </WidgetField>
      <WidgetField
        label="Accessible description"
        hint="Describe the purpose and population of this widget."
      >
        <textarea
          className={`${STAFF_FIELD} min-h-24`}
          maxLength={1500}
          value={draft.config.description}
          onChange={(e) => config("description", e.target.value)}
        />
      </WidgetField>
      <WidgetField label="Content language">
        <select
          className={STAFF_FIELD}
          value={draft.config.locale}
          onChange={(e) => config("locale", e.target.value)}
        >
          {SUPPORTED_LOCALES.map((l) => (
            <option key={l} value={l}>
              {languageNames.of(l)}
            </option>
          ))}
        </select>
      </WidgetField>
      <p className="text-xs text-(--t-ink-dim)">
        Published translations are used where available; English fallback is
        labelled on each record.
      </p>
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
      {draft.type === "chart" || draft.type === "stat" ? (
        <>
          {choose("metric", "Metric", ["libraries", "facility"])}
          {draft.config.metric === "facility" ? (
            <WidgetField label="Recorded feature">
              <select
                className={STAFF_FIELD}
                value={draft.config.facility}
                onChange={(e) => config("facility", Number(e.target.value))}
              >
                {FACILITY_CHECKLIST.map((f, i) => (
                  <option key={f.label} value={i}>
                    {f.label}
                  </option>
                ))}
              </select>
            </WidgetField>
          ) : null}
          {choose("chartMode", "Values", ["count", "percentage"])}
          {draft.type === "chart"
            ? choose("orientation", "Chart orientation", [
                "horizontal",
                "vertical",
              ])
            : null}
        </>
      ) : null}
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
        <h3 className="text-base font-semibold">Branding</h3>
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
          <select
            className={STAFF_FIELD}
            value={draft.type}
            onChange={(e) =>
              edit({ type: e.target.value as typeof draft.type })
            }
          >
            {WIDGET_TYPES.map((t) => (
              <option value={t} key={t}>
                {widgetTypeLabels[t]}
              </option>
            ))}
          </select>
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
