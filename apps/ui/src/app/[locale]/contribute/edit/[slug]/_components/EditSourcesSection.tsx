"use client"

import { T } from "@/lib/design-tokens"

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
    <div style={{ marginTop: "40px" }}>
      <h2
        style={{
          fontFamily: T.font.serif,
          fontWeight: 700,
          fontSize: "20px",
          color: T.ink.base,
          margin: "0 0 6px",
        }}
      >
        What&apos;s your evidence?
      </h2>
      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "13px",
          color: T.ink.faint,
          marginBottom: "20px",
        }}
      >
        Select all that apply
      </p>

      {/* Evidence chips */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        {EVIDENCE_OPTIONS.map((opt) => {
          const selected = evidenceType.includes(opt.key)

          return (
            <button
              key={opt.key}
              onClick={() => toggleType(opt.key)}
              style={{
                fontFamily: T.font.sans,
                fontSize: "13px",
                padding: "7px 14px",
                borderRadius: "10px",
                border: selected
                  ? `1px solid var(--t-aurora-edge)`
                  : `1px solid ${T.border.line}`,
                background: selected ? "var(--t-aurora-soft)" : "transparent",
                color: selected ? T.accent.aurora : T.ink.faint,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Evidence URL */}
      <input
        type="url"
        value={evidenceUrl}
        onChange={(e) => handleUrlChange(e.target.value)}
        placeholder="https://example.com/source-url (optional)"
        style={{
          width: "100%",
          padding: "12px 16px",
          border: `1px solid ${T.border.line}`,
          borderRadius: "10px",
          background: T.bg.surface,
          color: T.ink.base,
          fontSize: "13px",
          fontFamily: T.font.sans,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  )
}
