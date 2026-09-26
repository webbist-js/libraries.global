"use client"

import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

import {
  fieldHintStyle,
  fieldInputStyle,
  fieldLabelStyle,
} from "../../../add/_components/wizard.constants"

const EVIDENCE_OPTIONS: { key: string; label: string }[] = [
  { key: "institutional_url", label: "Institutional URL" },
  { key: "on_site_photo", label: "On-site evidence (photo)" },
  { key: "press_release", label: "Press release" },
  { key: "personal_communication", label: "Personal communication" },
  {
    key: "my_institutional_affiliation",
    label: "My institutional affiliation",
  },
  { key: "other", label: "Other" },
]

interface EditSourcesSectionProps {
  evidenceType: string[]
  evidenceUrl: string
  onChange: (type: string[], url: string) => void
}

export function EditSourcesSection({
  evidenceType,
  evidenceUrl,
  onChange,
}: EditSourcesSectionProps) {
  function toggleType(key: string) {
    const next = evidenceType.includes(key)
      ? evidenceType.filter((k) => k !== key)
      : [...evidenceType, key]
    onChange(next, evidenceUrl)
  }

  function handleUrlChange(val: string) {
    onChange(evidenceType, val)
  }

  return (
    <section
      className="mt-10 rounded-[20px] p-6 sm:p-8"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend
          className="p-0"
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(22px,2.4vw,26px)",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: T.ink.base,
          }}
        >
          What&apos;s your evidence?
        </legend>
        <p className="mt-1 mb-5 text-[15px]" style={{ color: T.ink.dim }}>
          Select all that apply
        </p>

        {/* Evidence chips */}
        <div className="mb-6 flex flex-wrap gap-2.5">
          {EVIDENCE_OPTIONS.map((opt) => {
            const selected = evidenceType.includes(opt.key)

            return (
              <button
                key={opt.key}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleType(opt.key)}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-semibold transition-colors"
                style={{
                  fontFamily: T.font.sans,
                  border: `1px solid ${selected ? T.accent.primary : T.border.hi}`,
                  background: selected ? T.accent.chip : T.bg.deep,
                  color: selected ? T.accent.primary : T.ink.dim,
                  cursor: "pointer",
                }}
              >
                {selected && (
                  <Icon
                    icon="mdi:check"
                    width={14}
                    height={14}
                    aria-hidden="true"
                  />
                )}
                {opt.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* Evidence URL */}
      <div className="flex flex-col gap-2">
        <label htmlFor="edit-evidence-url" style={fieldLabelStyle}>
          Source link
        </label>
        <input
          id="edit-evidence-url"
          type="url"
          value={evidenceUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://example.com/source-url"
          aria-describedby="edit-evidence-url-hint"
          style={fieldInputStyle}
        />
        <p id="edit-evidence-url-hint" style={fieldHintStyle}>
          Optional. A page that backs up your change.
        </p>
      </div>
    </section>
  )
}
