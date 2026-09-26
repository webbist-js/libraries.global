"use client"

import type React from "react"
import { useEffect, useState } from "react"

import {
  Select as RadixSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { T } from "@/lib/design-tokens"

import {
  fieldHintStyle,
  fieldInputStyle,
  fieldLabelStyle,
} from "./wizard.constants"
import type { FormData } from "./wizard.types"

// ── RequiredTag — subtle rust "required" marker next to a label ──────────────

export function RequiredTag() {
  return (
    <span
      style={{
        fontFamily: T.font.sans,
        fontSize: "14px",
        fontWeight: 500,
        color: "var(--tint-special-fg)",
      }}
    >
      required
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
  hint?: string
  autoComplete?: string
}) {
  const hintId = hint ? `${id}-hint` : undefined

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <label htmlFor={id} style={fieldLabelStyle}>
        {label}
        {required && <RequiredTag />}
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
        <p id={hintId} style={fieldHintStyle}>
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
}: {
  label: string
  id: keyof FormData
  value: string
  onChange: (name: keyof FormData, val: string) => void
  options: { value: string; label: string }[]
  required?: boolean
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Radix Select doesn't support htmlFor; aria-labelledby used instead */}
      <span id={`${id}-label`} style={fieldLabelStyle}>
        {label}
        {required && <RequiredTag />}
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
            ...fieldInputStyle,
            color: value ? T.ink.base : T.ink.dim,
            height: "auto",
            justifyContent: "space-between",
          }}
        >
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.line}`,
            borderRadius: "14px",
            zIndex: 9999,
          }}
        >
          {options.map((o) => (
            <SelectItem
              key={o.value}
              value={o.value}
              style={{
                color: T.ink.base,
                fontSize: "15px",
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
  required,
}: {
  label: string
  id: keyof FormData
  value: string
  onChange: (name: keyof FormData, val: string) => void
  placeholder?: string
  rows?: number
  hint?: string
  required?: boolean
}) {
  const hintId = hint ? `${id}-hint` : undefined

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <label htmlFor={id} style={fieldLabelStyle}>
        {label}
        {required && <RequiredTag />}
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
        <p id={hintId} style={fieldHintStyle}>
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

  const chipBase: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: "999px",
    fontSize: "14px",
    fontFamily: T.font.sans,
    cursor: "pointer",
    lineHeight: 1.1,
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
  }

  return (
    <div
      role="group"
      aria-label={label}
      style={{ display: "flex", flexDirection: "column", gap: "10px" }}
    >
      <span style={fieldLabelStyle}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {selected.map((o) => (
          <button
            key={o.documentId}
            type="button"
            aria-pressed="true"
            onClick={() => toggle(o.documentId)}
            style={{
              ...chipBase,
              border: `1px solid ${T.accent.primary}`,
              background: T.accent.chip,
              color: T.accent.primary,
              fontWeight: 600,
            }}
          >
            {o.name}
            <span aria-hidden="true">×</span>
          </button>
        ))}
        {visibleUnselected.map((o) => (
          <button
            key={o.documentId}
            type="button"
            aria-pressed="false"
            onClick={() => toggle(o.documentId)}
            style={{
              ...chipBase,
              border: `1px solid ${T.border.hi}`,
              background: T.bg.deep,
              color: T.ink.dim,
            }}
          >
            <span aria-hidden="true">+</span> {o.name}
          </button>
        ))}
        {!showAll && overflow > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            style={{
              ...chipBase,
              border: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.accent.primary,
              fontWeight: 600,
            }}
          >
            Show {overflow} more
          </button>
        )}
      </div>
      {hint && <p style={fieldHintStyle}>{hint}</p>}
    </div>
  )
}

// ── SubSection divider ────────────────────────────────────────────────────────

export function SubSection({ label, sub }: { label: string; sub?: string }) {
  return (
    <div
      style={{
        borderTop: `1px solid ${T.border.divider}`,
        paddingTop: "24px",
        marginTop: "8px",
      }}
    >
      <h3
        style={{
          fontFamily: T.font.serif,
          fontSize: "26px",
          fontWeight: 500,
          color: T.ink.base,
          margin: "0 0 6px",
          letterSpacing: "-0.01em",
          lineHeight: 1.2,
        }}
      >
        {label}
      </h3>
      {sub && (
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "15px",
            color: T.ink.dim,
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          {sub}
        </p>
      )}
    </div>
  )
}

// ── StepHeading — eyebrow + serif display heading + lead ─────────────────────

export function StepHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string
  title: string
  lead: string
}) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "15px",
          fontWeight: 600,
          color: T.accent.primary,
          margin: "0 0 12px",
        }}
      >
        {eyebrow}
      </p>
      <h2
        style={{
          fontFamily: T.font.serif,
          fontSize: "clamp(40px, 5vw, 64px)",
          fontWeight: 500,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          color: T.ink.base,
          margin: "0 0 16px",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "18px",
          color: T.ink.dim,
          margin: 0,
          lineHeight: 1.55,
          maxWidth: "58ch",
        }}
      >
        {lead}
      </p>
    </div>
  )
}

// ── StepHeader — numbered step heading (steps 1–7) ────────────────────────────

export function StepHeader({
  n,
  label,
  title,
  sub,
}: {
  n: number
  /** Short step name shown in the eyebrow, e.g. "Identity" */
  label: string
  title: string
  sub: string
}) {
  return (
    <StepHeading
      eyebrow={`Step ${n} of 7 · ${label}`}
      title={title}
      lead={sub}
    />
  )
}
