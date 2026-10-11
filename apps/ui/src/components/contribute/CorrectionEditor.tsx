"use client"

import { Icon } from "@iconify/react"
import { checkText } from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useId, useMemo, useState } from "react"

import { ChangedFieldsContext } from "@/components/library-editor/ChangedFieldsContext"
import { OpeningTimesEditor } from "@/components/library-editor/OpeningTimesEditor"
import { OPERATIONAL_STATUSES } from "@/components/library-editor/wizard.constants"
import type { FormData } from "@/components/library-editor/wizard.types"
import {
  Field,
  TagSelector,
  TextareaField,
  WizardSelect,
} from "@/components/library-editor/WizardFields"
import { TimetableEditor } from "@/components/mobile/TimetableEditor"
import { T } from "@/lib/design-tokens"

import {
  type CorrectionRecord,
  editorFor,
  hoursOf,
  type OptionKey,
  type OptionRef,
  type RecordEdit,
  TEXT_LABELS,
  type TextKey,
} from "./correction.logic"

/**
 * The editor for one correction category, built from the Index editor's
 * own fields (hours, selects, tag selectors), starting from the library's
 * published values. Changed fields carry the same "Changed" marking.
 */

const ENDPOINT: Record<OptionKey, string> = {
  accessibility: "/api/relations/accessibility",
  amenities: "/api/relations/amenities",
  services: "/api/relations/services",
}

const OPTION_LABEL: Record<OptionKey, { title: string; noun: string }> = {
  accessibility: { title: "Accessibility features", noun: "feature" },
  services: { title: "Services", noun: "service" },
  amenities: { title: "Amenities", noun: "amenity" },
}

const TEXT_HINTS: Partial<Record<TextKey, string>> = {
  shortName: "Optional. What people call it locally, if that’s different.",
  website: "The library’s own page, if it has one.",
  phone: "The number people call to reach the library.",
  email: "The library’s public enquiries address.",
  catalogueUrl: "Where people search or reserve books.",
}

/**
 * "Not in the list?": names a new option. It loads the list too, so a name
 * that already exists gets ticked instead of suggested twice, and so the
 * review step can name the options that were ticked.
 */
function SuggestOption({
  optionKey,
  selected,
  suggested,
  onSelect,
  onSuggest,
  onNames,
}: {
  readonly optionKey: OptionKey
  readonly selected: string[]
  readonly suggested: string[]
  readonly onSelect: (ids: string[]) => void
  readonly onSuggest: (names: string[]) => void
  readonly onNames: (names: Record<string, string>) => void
}) {
  const tUi = useUiTranslations("ui")

  const id = useId()
  const [options, setOptions] = useState<OptionRef[]>([])
  const [draft, setDraft] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const noun = OPTION_LABEL[optionKey].noun

  useEffect(() => {
    let live = true
    fetch(ENDPOINT[optionKey])
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json: { data?: OptionRef[] }) => {
        if (!live) return
        const list = (json.data ?? []).filter((o) => o.documentId && o.name)
        setOptions(list)
        onNames(Object.fromEntries(list.map((o) => [o.documentId, o.name])))
      })
      .catch(() => {})

    return () => {
      live = false
    }
    // onNames is a stable state setter from the wizard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionKey])

  const add = () => {
    const name = draft.trim().replaceAll(/\s+/g, " ").slice(0, 80)
    if (!name) return
    const issue = checkText(name)
    if (issue) {
      setMessage(issue)

      return
    }
    const existing = options.find(
      (o) => o.name.toLowerCase() === name.toLowerCase()
    )
    setDraft("")
    if (existing) {
      if (!selected.includes(existing.documentId))
        onSelect([...selected, existing.documentId])
      setMessage(
        `“${existing.name}” is already in the list, so we’ve added it.`
      )

      return
    }
    if (suggested.some((s) => s.toLowerCase() === name.toLowerCase())) return
    if (suggested.length >= 5) {
      setMessage("That’s five new ones. Send these first.")

      return
    }
    setMessage(null)
    onSuggest([...suggested, name])
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        className="text-[15px] font-semibold"
        htmlFor={id}
        style={{ color: T.ink.base }}
      >
        Not in the list?{" "}
        <span className="font-normal" style={{ color: T.ink.dim }}>
          Suggest a new {noun}. Our editorial board considers new additions
          monthly.
        </span>
      </label>
      <div className="flex gap-2">
        <input
          aria-describedby={message ? `${id}-message` : undefined}
          className="w-full rounded-[14px] border border-(--t-border-hi) bg-white px-4 py-3 text-[16px] outline-none focus:border-(--t-accent-primary)"
          id={id}
          maxLength={80}
          onChange={(e) => {
            setDraft(e.target.value)
            setMessage(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder={
            optionKey === "accessibility"
              ? "e.g. Changing Places toilet"
              : "e.g. Seed library"
          }
          style={{ color: T.ink.base }}
          value={draft}
        />
        <button
          className="inline-flex h-[50px] shrink-0 items-center rounded-full border bg-white px-5 text-[15px] font-semibold hover:bg-(--t-bg-surface)"
          onClick={add}
          style={{ borderColor: T.border.hi, color: T.ink.base }}
          type="button"
        >
          {tUi("add")}{" "}
        </button>
      </div>
      {message ? (
        <p
          id={`${id}-message`}
          aria-live="polite"
          className="m-0 text-[14px]"
          style={{ color: T.ink.dim }}
        >
          {message}
        </p>
      ) : null}
      {suggested.length ? (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {suggested.map((name) => (
            <li
              key={name}
              className="inline-flex items-center gap-1.5 rounded-full py-1 pr-1 pl-3 text-[14px] font-semibold"
              style={{ background: T.accent.chip, color: T.accent.primary }}
            >
              New: {name}
              <button
                aria-label={`Remove ${name}`}
                className="flex size-7 items-center justify-center rounded-full hover:bg-white"
                onClick={() => onSuggest(suggested.filter((s) => s !== name))}
                type="button"
              >
                <Icon
                  aria-hidden="true"
                  height={15}
                  icon="mdi:close"
                  width={15}
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function CorrectionEditor({
  category,
  current,
  edit,
  onChange,
  onNames,
  changedKeys,
}: {
  readonly category: string
  readonly current: CorrectionRecord
  readonly edit: RecordEdit
  readonly onChange: (edit: RecordEdit) => void
  /** Option names by documentId, for the review summary. */
  readonly onNames: (names: Record<string, string>) => void
  /** Record fields that differ from the library, marked "Changed". */
  readonly changedKeys: readonly string[]
}) {
  const kind = editorFor(category, current.libraryType)
  const [stopId, setStopId] = useState("")
  const changed = useMemo(
    () => new Set(changedKeys as (keyof FormData)[]),
    [changedKeys]
  )
  const text = (key: TextKey) => edit[key] ?? current[key]
  const setText = (key: keyof FormData, value: string) =>
    onChange({ ...edit, [key]: value })

  const field = (key: TextKey, type = "text") => (
    <Field
      key={key}
      hint={TEXT_HINTS[key]}
      id={key}
      label={TEXT_LABELS[key]}
      onChange={setText}
      placeholder={type === "url" ? "https://" : undefined}
      type={type}
      value={text(key)}
    />
  )

  const options = (key: OptionKey) => {
    const selected = edit[key] ?? current[key].map((o) => o.documentId)

    return (
      <div key={key} className="flex flex-col gap-4">
        <TagSelector
          endpoint={ENDPOINT[key]}
          fieldKey={key}
          label={OPTION_LABEL[key].title}
          onChange={(ids) => onChange({ ...edit, [key]: ids })}
          value={selected}
        />
        <SuggestOption
          onNames={onNames}
          onSelect={(ids) => onChange({ ...edit, [key]: ids })}
          onSuggest={(names) =>
            onChange({
              ...edit,
              suggested: { ...edit.suggested, [key]: names },
            })
          }
          optionKey={key}
          selected={selected}
          suggested={edit.suggested?.[key] ?? []}
        />
      </div>
    )
  }

  let body: React.ReactNode = null
  switch (kind) {
    case "timetable": {
      const timetable =
        edit.mobileTimetable === undefined
          ? (current.mobileTimetable ?? null)
          : edit.mobileTimetable
      const chosenStop = timetable?.stops.find((stop) => stop.id === stopId)
      body = (
        <div className="space-y-4">
          <p>
            Choose a stop to change its visits, remove every visit if the
            vehicle no longer stops there, or move its pin. This suggestion
            includes the full timetable and will be checked against the version
            you loaded.
          </p>
          {timetable && (
            <div className="space-y-3">
              <label className="block">
                Which stop?
                <select
                  className="mt-1 min-h-11 w-full rounded-md border px-3"
                  style={{ borderColor: T.border.hi, background: T.bg.deep }}
                  value={stopId}
                  onChange={(event) => setStopId(event.target.value)}
                >
                  <option value="">Choose a stop</option>
                  {timetable.stops.map((stop) => (
                    <option key={stop.id} value={stop.id}>
                      {stop.name}
                    </option>
                  ))}
                </select>
              </label>
              {chosenStop && (
                <button
                  type="button"
                  className="min-h-11 rounded-md border px-3"
                  style={{ borderColor: T.border.hi }}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove every visit to ${chosenStop.name}?`
                      )
                    )
                      onChange({
                        ...edit,
                        mobileTimetable: {
                          ...timetable,
                          stops: timetable.stops.filter(
                            (stop) => stop.id !== chosenStop.id
                          ),
                          visits: timetable.visits.filter(
                            (visit) => visit.stopId !== chosenStop.id
                          ),
                        },
                      })
                  }}
                >
                  No longer stops here
                </button>
              )}
            </div>
          )}
          <TimetableEditor
            value={timetable}
            onChange={(mobileTimetable) =>
              onChange({ ...edit, mobileTimetable })
            }
          />
        </div>
      )
      break
    }
    case "hours":
      body = (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
            {current.openingTimes
              ? "These are the hours on the record now. Change the days that are wrong."
              : "There are no hours on the record yet. Switch on each open day and set its times."}
          </p>
          <OpeningTimesEditor
            onChange={(openingTimes) => onChange({ ...edit, openingTimes })}
            value={edit.openingTimes ?? hoursOf(current.openingTimes)}
          />
        </div>
      )
      break
    case "address":
      body = (["streetAddress", "district", "city", "postalCode"] as const).map(
        (k) => field(k)
      )
      break
    case "name":
      body = [field("name"), field("shortName")]
      break
    case "links":
      body = [
        field("website", "url"),
        field("phone", "tel"),
        field("email", "email"),
        field("catalogueUrl", "url"),
      ]
      break
    case "status":
      body = (
        <>
          <WizardSelect
            id="operationalStatus"
            label={TEXT_LABELS.operationalStatus}
            onChange={setText}
            options={OPERATIONAL_STATUSES}
            value={text("operationalStatus")}
          />
          {text("operationalStatus") && text("operationalStatus") !== "open" ? (
            <TextareaField
              hint="Optional. Shown on the library page."
              id="closureReason"
              label={TEXT_LABELS.closureReason}
              onChange={setText}
              placeholder="e.g. Closed for refurbishment until spring 2027"
              value={text("closureReason")}
            />
          ) : null}
        </>
      )
      break
    case "accessibility":
      body = options("accessibility")
      break
    case "facilities":
      body = (
        <div className="flex flex-col gap-8">
          {options("services")}
          {options("amenities")}
        </div>
      )
      break

    default:
      return null
  }

  return (
    <ChangedFieldsContext.Provider value={changed}>
      <div className="flex flex-col gap-5">{body}</div>
    </ChangedFieldsContext.Provider>
  )
}
