"use client"

import { longDate } from "@/components/drives/focus-meta"
import {
  SECTION_LABELS,
  sectionCheckedAt,
  sectionSummary,
  type VerifyRecord,
  type VerifySection,
} from "@/components/library/verify.logic"
import { T } from "@/lib/design-tokens"

// The correction drawer's own field style (ContributionWizard).
const FIELD =
  "w-full rounded-[14px] border border-(--t-border-hi) bg-white px-4 py-3 text-[16px] outline-none transition-colors focus:border-(--t-accent-primary)"

/** "Last checked 6 Oct 2025", or "" when the record carries no stamp. */
function lastCheckedOf(record: VerifyRecord, section: VerifySection): string {
  const day = longDate(sectionCheckedAt(record, section))

  return day ? `Last checked ${day}` : ""
}

/**
 * A checkbox row: the label names it; the current value, and when it was
 * last checked if the record says, describe it.
 */
function SectionChoice({
  id,
  label,
  summary,
  lastChecked: checkedOn,
  checked,
  onChange,
}: {
  readonly id: string
  readonly label: string
  readonly summary: string
  /** "Last checked 6 Oct 2025", or "" when unknown. */
  readonly lastChecked: string
  readonly checked: boolean
  readonly onChange: (checked: boolean) => void
}) {
  const describedBy = [
    summary ? `${id}-value` : "",
    checkedOn ? `${id}-checked` : "",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <label
      className="flex cursor-pointer items-start gap-3 rounded-[16px] border p-4"
      style={{
        background: checked ? T.accent.chip : T.bg.deep,
        borderColor: checked ? T.accent.primary : T.border.line,
      }}
    >
      <input
        aria-describedby={describedBy || undefined}
        aria-labelledby={`${id}-label`}
        checked={checked}
        className="mt-0.5 size-5 shrink-0"
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "var(--t-accent-primary)" }}
        type="checkbox"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          id={`${id}-label`}
          className="text-[16px] font-semibold"
          style={{ color: T.ink.base }}
        >
          {label}
        </span>
        {summary ? (
          <span
            id={`${id}-value`}
            className="text-[14.5px] break-words"
            style={{ color: T.ink.dim }}
          >
            {summary}
          </span>
        ) : null}
        {checkedOn ? (
          <span
            id={`${id}-checked`}
            className="text-[14.5px]"
            style={{ color: T.ink.dim }}
          >
            {checkedOn}
          </span>
        ) : null}
      </span>
    </label>
  )
}

/**
 * The body of "Is this still right?": the sections to confirm (each with
 * what the record says now), "Where did you check?", "I checked in
 * person", and the problem, announced with the field it's about.
 * Controlled, so the correction drawer (`LibraryVerify`) and a verify
 * drive's task panel host the same fields and send the same payload
 * (`verifyPayload`).
 */
export function VerifyFields({
  record,
  available,
  sections,
  onSections,
  source,
  onSource,
  inPerson,
  onInPerson,
  problem,
  problemField,
  idPrefix,
}: {
  readonly record: VerifyRecord
  /** The sections offered, in VERIFY_SECTIONS order. */
  readonly available: readonly VerifySection[]
  readonly sections: VerifySection[]
  readonly onSections: (next: VerifySection[]) => void
  readonly source: string
  readonly onSource: (v: string) => void
  readonly inPerson: boolean
  readonly onInPerson: (v: boolean) => void
  readonly problem: string | null
  /** The field `problem` is about, so it's announced with that field. */
  readonly problemField: "sections" | "source" | null
  readonly idPrefix: string
}) {
  const problemId = `${idPrefix}-problem`

  const toggle = (section: VerifySection, on: boolean) =>
    onSections(
      available.filter((s) => (s === section ? on : sections.includes(s)))
    )

  return (
    <>
      <fieldset
        aria-describedby={problemField === "sections" ? problemId : undefined}
        className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0"
      >
        <legend
          className="mb-2.5 p-0 text-[15px] font-semibold"
          style={{ color: T.ink.base }}
        >
          What did you check?
        </legend>
        {available.length === 0 ? (
          <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
            There’s nothing on this record to confirm yet.
          </p>
        ) : null}
        {available.map((s) => (
          <SectionChoice
            key={s}
            checked={sections.includes(s)}
            id={`${idPrefix}-${s}`}
            label={SECTION_LABELS[s]}
            lastChecked={lastCheckedOf(record, s)}
            onChange={(on) => toggle(s, on)}
            summary={sectionSummary(s, record)}
          />
        ))}
      </fieldset>

      <div>
        <label
          className="mb-2 block text-[15px] font-semibold"
          htmlFor={`${idPrefix}-source`}
          style={{ color: T.ink.base }}
        >
          Where did you check?{" "}
          <span className="font-normal" style={{ color: T.ink.dim }}>
            A link to the page
          </span>
        </label>
        <input
          aria-describedby={problemField === "source" ? problemId : undefined}
          aria-invalid={problemField === "source" ? true : undefined}
          autoComplete="url"
          className={FIELD}
          id={`${idPrefix}-source`}
          inputMode="url"
          onChange={(e) => onSource(e.target.value)}
          placeholder="https://"
          style={{ color: T.ink.base }}
          type="url"
          value={source}
        />
      </div>

      <label
        className="flex cursor-pointer items-start gap-3 text-[15px]"
        style={{ color: T.ink.base }}
      >
        <input
          checked={inPerson}
          className="mt-0.5 size-5 shrink-0"
          onChange={(e) => onInPerson(e.target.checked)}
          style={{ accentColor: "var(--t-accent-primary)" }}
          type="checkbox"
        />
        <span>I checked in person</span>
      </label>

      {problem ? (
        <p
          className="m-0 text-[15px] font-semibold"
          id={problemId}
          role="alert"
          style={{ color: T.accent.danger }}
        >
          {problem}
        </p>
      ) : null}
    </>
  )
}
