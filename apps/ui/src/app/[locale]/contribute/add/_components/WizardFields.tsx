"use client"

import { useEffect, useState } from "react"

import {
  Select as RadixSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { T } from "@/lib/design-tokens"

import { fieldInputStyle, fieldLabelStyle } from "./wizard.constants"
import type { FormData } from "./wizard.types"

// ── ScoreTag — aurora diamond shown on fields that count toward the score ─────

export function ScoreTag() {
  return (
    <span
      title="This field counts toward your completeness score"
      style={{
        fontFamily: T.font.mono,
        fontSize: "9px",
        letterSpacing: ".1em",
        color: T.accent.aurora,
        opacity: 0.7,
        userSelect: "none",
      }}
    >
      ◈
    </span>
  )
}

// ── Field primitive ───────────────────────────────────────────────────────────

export function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  score,
  hint,
  autoComplete,
}: {
  label: string
  id: keyof FormData
  value: string
  onChange: (name: keyof FormData, val: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  score?: boolean
  hint?: string
  autoComplete?: string
}) {
  const hintId = hint ? `${id}-hint` : undefined

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label htmlFor={id} style={fieldLabelStyle}>
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: T.accent.danger }}>
            *
          </span>
        )}
        {score && <ScoreTag />}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(id, e.target.value)}
        placeholder={placeholder}
        required={required}
        aria-required={required}
        aria-describedby={hintId}
        autoComplete={autoComplete}
        style={fieldInputStyle}
      />
      {hint && (
        <p
          id={hintId}
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            color: T.ink.faint,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  )
}

// ── WizardSelect primitive (Radix, accessible) ────────────────────────────────

export function WizardSelect({
  label,
  id,
  value,
  onChange,
  options,
  required,
  score,
}: {
  label: string
  id: keyof FormData
  value: string
  onChange: (name: keyof FormData, val: string) => void
  options: { value: string; label: string }[]
  required?: boolean
  score?: boolean
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {/* Radix Select doesn't support htmlFor; aria-labelledby used instead */}
      <span id={`${id}-label`} style={fieldLabelStyle} aria-hidden="false">
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: T.accent.danger }}>
            *
          </span>
        )}
        {score && <ScoreTag />}
      </span>
      <RadixSelect
        value={value}
        onValueChange={(v) => onChange(id, v)}
        required={required}
        name={id}
      >
        <SelectTrigger
          aria-labelledby={`${id}-label`}
          aria-required={required}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: "8px",
            border: `1px solid ${T.border.hi}`,
            background: "rgba(5,8,22,1)",
            color: value ? T.ink.base : T.ink.faint,
            fontSize: "14px",
            fontFamily: T.font.sans,
            height: "auto",
            minHeight: "42px",
            justifyContent: "space-between",
            outline: "none",
            boxSizing: "border-box",
          }}
        >
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent
          style={{
            background: "rgba(6,9,26,0.98)",
            border: "1px solid rgba(255,255,255,0.09)",
            backdropFilter: "blur(20px)",
            borderRadius: "8px",
            zIndex: 9999,
          }}
        >
          {options.map((o) => (
            <SelectItem
              key={o.value}
              value={o.value}
              style={{
                color: T.ink.base,
                fontSize: "14px",
                fontFamily: T.font.sans,
                cursor: "pointer",
              }}
            >
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </RadixSelect>
    </div>
  )
}

// ── TextareaField primitive ───────────────────────────────────────────────────

export function TextareaField({
  label,
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
  hint,
  score,
}: {
  label: string
  id: keyof FormData
  value: string
  onChange: (name: keyof FormData, val: string) => void
  placeholder?: string
  rows?: number
  hint?: string
  score?: boolean
}) {
  const hintId = hint ? `${id}-hint` : undefined

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label htmlFor={id} style={fieldLabelStyle}>
        {label}
        {score && <ScoreTag />}
      </label>
      <textarea
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(id, e.target.value)}
        placeholder={placeholder}
        rows={rows}
        aria-describedby={hintId}
        style={{ ...fieldInputStyle, resize: "vertical", lineHeight: 1.6 }}
      />
      {hint && (
        <p
          id={hintId}
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            color: T.ink.faint,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  )
}

// ── TagSelector — chip multi-select for relation fields ───────────────────────

export function TagSelector({
  label,
  endpoint,
  value,
  onChange,
  hint,
}: {
  label: string
  endpoint: string
  value: string[]
  onChange: (ids: string[]) => void
  hint?: string
}) {
  const [options, setOptions] = useState<
    { documentId: string; name: string }[]
  >([])
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetch(endpoint)
      .then((r) => r.json())
      .then((j) => setOptions(j.data ?? []))
      .catch(() => {})
  }, [endpoint])

  const toggle = (id: string) => {
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id]
    )
  }

  const selected = options.filter((o) => value.includes(o.documentId))
  const unselected = options.filter((o) => !value.includes(o.documentId))
  const LIMIT = 12
  const visibleUnselected = showAll ? unselected : unselected.slice(0, LIMIT)
  const overflow = unselected.length - LIMIT

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <span style={fieldLabelStyle}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {selected.map((o) => (
          <button
            key={o.documentId}
            type="button"
            onClick={() => toggle(o.documentId)}
            style={{
              padding: "6px 12px",
              borderRadius: "20px",
              border: `1px solid ${T.accent.aurora}`,
              background: "rgba(127,223,255,0.1)",
              color: T.accent.aurora,
              fontSize: "13px",
              fontFamily: T.font.sans,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              lineHeight: 1,
            }}
          >
            {o.name}
            <span style={{ opacity: 0.6, fontSize: "11px" }}>×</span>
          </button>
        ))}
        {visibleUnselected.map((o) => (
          <button
            key={o.documentId}
            type="button"
            onClick={() => toggle(o.documentId)}
            style={{
              padding: "6px 12px",
              borderRadius: "20px",
              border: `1px solid ${T.border.hi}`,
              background: "transparent",
              color: T.ink.dim,
              fontSize: "13px",
              fontFamily: T.font.sans,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            + {o.name}
          </button>
        ))}
        {!showAll && overflow > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            style={{
              padding: "6px 12px",
              borderRadius: "20px",
              border: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.faint,
              fontSize: "13px",
              fontFamily: T.font.sans,
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            + search {overflow} more…
          </button>
        )}
      </div>
      {hint && (
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            color: T.ink.faint,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  )
}

// ── SubSection divider ────────────────────────────────────────────────────────

export function SubSection({ label, sub }: { label: string; sub?: string }) {
  return (
    <div
      style={{
        borderTop: `1px solid ${T.border.line}`,
        paddingTop: "18px",
        marginTop: "4px",
      }}
    >
      <p
        style={{
          fontFamily: T.font.mono,
          fontSize: "11px",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: T.ink.faint,
          margin: "0 0 4px",
        }}
      >
        Sub-section
      </p>
      <h3
        style={{
          fontFamily: T.font.serif,
          fontSize: "22px",
          fontWeight: 600,
          color: T.ink.base,
          margin: "0 0 4px",
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </h3>
      {sub && (
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.ink.dim,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {sub}
        </p>
      )}
    </div>
  )
}

// ── StepHeader ────────────────────────────────────────────────────────────────

export function StepHeader({
  n,
  title,
  sub,
}: {
  n: number
  title: string
  sub: string
}) {
  return (
    <div style={{ marginBottom: "4px" }}>
      <p
        style={{
          fontFamily: T.font.mono,
          fontSize: "11px",
          letterSpacing: ".16em",
          textTransform: "uppercase",
          color: T.accent.aurora,
          margin: "0 0 6px",
          opacity: 0.8,
        }}
      >
        Step {n} of 7
      </p>
      <h2
        style={{
          fontFamily: T.font.serif,
          fontSize: "32px",
          fontWeight: 600,
          color: T.ink.base,
          margin: "0 0 8px",
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "14px",
          color: T.ink.dim,
          margin: 0,
          lineHeight: 1.55,
          maxWidth: "54ch",
        }}
      >
        {sub}
      </p>
    </div>
  )
}
