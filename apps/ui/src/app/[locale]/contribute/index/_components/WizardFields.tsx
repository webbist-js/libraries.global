"use client"

import { Icon } from "@iconify/react"
import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"

import {
  Select as RadixSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { T } from "@/lib/design-tokens"

import { useIsChanged } from "./ChangedFieldsContext"
import {
  fieldHintStyle,
  fieldInputStyle,
  fieldLabelStyle,
} from "./wizard.constants"
import type { FormData } from "./wizard.types"

// ── ChangedTag — improve mode marks fields that differ from the record ───────

export function ChangedTag() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12.5px] font-semibold"
      style={{ background: T.accent.chip, color: T.accent.primary }}
    >
      <Icon icon="mdi:pencil" width={12} aria-hidden="true" />
      Changed
    </span>
  )
}

/** Wraps a field so a changed one carries an indigo rule and tag. */
function FieldFrame({
  changed,
  children,
}: {
  changed: boolean
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        ...(changed
          ? {
              borderLeft: `3px solid ${T.accent.primary}`,
              paddingLeft: "14px",
              marginLeft: "-17px",
            }
          : {}),
      }}
    >
      {children}
    </div>
  )
}

// ── Shared fields — translation mode locks what every language shares ──────

/**
 * The form keys that may change, or `null` when all may. Translation mode
 * sets it to the localized fields; the rest render read-only.
 */
export const EditableFieldsContext = createContext<ReadonlySet<string> | null>(
  null
)

/** True when `key` is shared across languages and can't change here. */
export function useIsShared(key?: keyof FormData): boolean {
  const editable = useContext(EditableFieldsContext)

  return !!editable && !!key && !editable.has(key)
}

export function SharedTag({ id }: { id?: string }) {
  return (
    <span
      id={id}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12.5px] font-semibold"
      style={{ background: T.bg.muted, color: T.ink.dim }}
    >
      <Icon icon="mdi:earth" width={12} aria-hidden="true" />
      Shared across languages
    </span>
  )
}

const sharedInputStyle: React.CSSProperties = {
  background: T.bg.muted,
  color: T.ink.dim,
  cursor: "not-allowed",
}

/**
 * Wraps an editor with its own controls (hours, relations, photos): in
 * translation mode a disabled fieldset renders it read-only with the tag.
 */
export function SharedBlock({
  fields,
  children,
}: {
  fields: readonly (keyof FormData)[]
  children: React.ReactNode
}) {
  const editable = useContext(EditableFieldsContext)
  const shared = !!editable && fields.every((f) => !editable.has(f))
  if (!shared) return <>{children}</>

  return (
    <fieldset
      disabled
      style={{
        border: "none",
        padding: 0,
        margin: 0,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        opacity: 0.75,
      }}
    >
      <legend className="sr-only">Shared across languages</legend>
      <div>
        <SharedTag />
      </div>
      {children}
    </fieldset>
  )
}

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

// ── Field errors — the wizard reveals them when a step can't be left ──────────

/** The form keys showing a "required" error. Empty outside the wizard. */
export const FieldErrorsContext = createContext<ReadonlySet<string>>(new Set())

function useFieldError(key: keyof FormData): { invalid: boolean; id: string } {
  return {
    invalid: useContext(FieldErrorsContext).has(key),
    id: `${key}-error`,
  }
}

// `border`, not `borderColor`: fieldInputStyle sets the shorthand.
const invalidInputStyle: React.CSSProperties = {
  border: `1px solid ${T.accent.danger}`,
}

function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p
      id={id}
      style={{
        ...fieldHintStyle,
        color: T.accent.danger,
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      <Icon icon="mdi:alert-circle-outline" width={16} aria-hidden="true" />
      {children}
    </p>
  )
}

const joinIds = (...ids: (string | false | null | undefined)[]) =>
  ids.filter(Boolean).join(" ") || undefined

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
  const changed = useIsChanged(id)
  const shared = useIsShared(id)
  const error = useFieldError(id)

  return (
    <FieldFrame changed={changed}>
      <label htmlFor={id} style={fieldLabelStyle}>
        {label}
        {required && !shared && <RequiredTag />}
        {changed && <ChangedTag />}
        {shared && <SharedTag id={`${id}-shared`} />}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(id, e.target.value)}
        placeholder={shared ? undefined : placeholder}
        required={required && !shared}
        aria-required={required && !shared}
        aria-invalid={error.invalid || undefined}
        readOnly={shared}
        aria-describedby={joinIds(
          error.invalid && error.id,
          shared && `${id}-shared`,
          hintId
        )}
        autoComplete={autoComplete}
        style={{
          ...fieldInputStyle,
          ...(shared ? sharedInputStyle : {}),
          ...(error.invalid ? invalidInputStyle : {}),
        }}
      />
      {error.invalid && (
        <FieldError id={error.id}>Fill this in to continue.</FieldError>
      )}
      {hint && (
        <p id={hintId} style={fieldHintStyle}>
          {hint}
        </p>
      )}
    </FieldFrame>
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
  const changed = useIsChanged(id)
  const shared = useIsShared(id)
  const error = useFieldError(id)

  return (
    <FieldFrame changed={changed}>
      {/* Radix Select doesn't support htmlFor; aria-labelledby used instead */}
      <span id={`${id}-label`} style={fieldLabelStyle}>
        {label}
        {required && !shared && <RequiredTag />}
        {changed && <ChangedTag />}
        {shared && <SharedTag id={`${id}-shared`} />}
      </span>
      <RadixSelect
        value={value}
        onValueChange={(v) => onChange(id, v)}
        required={required && !shared}
        disabled={shared}
        name={id}
      >
        <SelectTrigger
          id={id}
          aria-labelledby={`${id}-label`}
          aria-describedby={joinIds(
            error.invalid && error.id,
            shared && `${id}-shared`
          )}
          aria-required={required && !shared}
          aria-invalid={error.invalid || undefined}
          style={{
            ...fieldInputStyle,
            color: value ? T.ink.base : T.ink.dim,
            height: "auto",
            justifyContent: "space-between",
            ...(shared ? sharedInputStyle : {}),
            ...(error.invalid ? invalidInputStyle : {}),
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
      {error.invalid && (
        <FieldError id={error.id}>Choose one to continue.</FieldError>
      )}
    </FieldFrame>
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
  const changed = useIsChanged(id)
  const shared = useIsShared(id)
  const error = useFieldError(id)

  return (
    <FieldFrame changed={changed}>
      <label htmlFor={id} style={fieldLabelStyle}>
        {label}
        {required && !shared && <RequiredTag />}
        {changed && <ChangedTag />}
        {shared && <SharedTag id={`${id}-shared`} />}
      </label>
      <textarea
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(id, e.target.value)}
        placeholder={shared ? undefined : placeholder}
        rows={rows}
        readOnly={shared}
        required={required && !shared}
        aria-required={required && !shared}
        aria-invalid={error.invalid || undefined}
        aria-describedby={joinIds(
          error.invalid && error.id,
          shared && `${id}-shared`,
          hintId
        )}
        style={{
          ...fieldInputStyle,
          resize: "vertical",
          lineHeight: 1.6,
          ...(shared ? sharedInputStyle : {}),
          ...(error.invalid ? invalidInputStyle : {}),
        }}
      />
      {error.invalid && (
        <FieldError id={error.id}>Fill this in to continue.</FieldError>
      )}
      {hint && (
        <p id={hintId} style={fieldHintStyle}>
          {hint}
        </p>
      )}
    </FieldFrame>
  )
}

// ── TagSelector — chip multi-select for relation fields ───────────────────────

export function TagSelector({
  label,
  endpoint,
  value,
  onChange,
  hint,
  fieldKey,
}: {
  label: string
  endpoint: string
  value: string[]
  onChange: (ids: string[]) => void
  hint?: string
  /** The form field this selects, for improve-mode change marking. */
  fieldKey?: keyof FormData
}) {
  const changed = useIsChanged(fieldKey ?? "services") && !!fieldKey
  const shared = useIsShared(fieldKey)
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
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        ...(changed
          ? {
              borderLeft: `3px solid ${T.accent.primary}`,
              paddingLeft: "14px",
              marginLeft: "-17px",
            }
          : {}),
      }}
    >
      <span style={fieldLabelStyle}>
        {label}
        {changed && <ChangedTag />}
        {shared && <SharedTag />}
      </span>
      <fieldset
        disabled={shared}
        style={{
          border: "none",
          padding: 0,
          margin: 0,
          minWidth: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          opacity: shared ? 0.75 : 1,
        }}
      >
        <legend className="sr-only">
          {shared ? `${label}: shared across languages` : label}
        </legend>
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
      </fieldset>
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
