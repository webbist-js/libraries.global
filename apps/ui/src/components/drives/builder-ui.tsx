"use client"

import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"

import { type BuilderField, fieldId } from "./builder.logic"

/**
 * The drive builder's building blocks, in the role application form's
 * conventions (`RoleApplicationForm.tsx`): its inputs, cards, card titles,
 * legends, hints and tags, plus the builder's own pills and disclosures.
 */

const fmt = (n: number) => n.toLocaleString("en-GB")

export const input: React.CSSProperties = {
  padding: "12px 16px",
  minHeight: 48,
  borderRadius: 14,
  border: `1px solid ${T.border.hi}`,
  background: T.bg.deep,
  color: T.ink.base,
  fontSize: "var(--type-body-size)",
  fontFamily: T.font.sans,
  width: "100%",
  boxSizing: "border-box",
}

export const invalidInput: React.CSSProperties = {
  ...input,
  borderColor: T.accent.danger,
}

export const card = "rounded-[24px] p-6 sm:p-7"
export const cardStyle: React.CSSProperties = {
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
}
export const cardTitle: React.CSSProperties = {
  color: T.ink.base,
}
export const legendClass = "m-0 p-0 text-base font-semibold"
export const hintClass = "mt-0.5 mb-3 text-sm"

/** The side column's cards, as `RoleApplicationAside` draws them. */
export const railCard = "rounded-[20px] p-5 sm:p-6"
export const railTitleClass = "m-0 text-base font-semibold"

export const PRIMARY =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-(--t-accent-primary) px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
export const SECONDARY =
  "inline-flex cursor-pointer items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-60"
export const SECONDARY_LINK =
  "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
export const secondaryStyle: React.CSSProperties = {
  background: T.bg.deep,
  border: `1px solid ${T.border.hi}`,
  color: T.ink.base,
}

/** The focus ring for a label wrapping a visually hidden control. */
export const RING =
  "has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--t-accent-primary) has-[:focus-visible]:outline-solid"

/** A pill that holds a real checkbox or radio. */
export const CHIP = `inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ${RING}`

/** A chosen card or row: the indigo border on a wash of the chip colour. */
export const chosenBackground =
  "color-mix(in srgb, var(--t-accent-chip) 45%, var(--t-bg-deep))"

export const linkStyle: React.CSSProperties = { color: T.accent.primary }
export const linkClass = "font-semibold underline underline-offset-[3px]"

/** "Optional" / "Required" after a field's name. */
export function Tag({ children }: { readonly children: ReactNode }) {
  return (
    <span className="font-normal" style={{ color: T.ink.dim }}>
      {" "}
      {children}
    </span>
  )
}

/** A hairline between the groups of one card. */
export function Divider() {
  return (
    <div
      aria-hidden="true"
      className="h-px w-full"
      style={{ background: T.border.divider }}
    />
  )
}

/**
 * A numbered step of the builder, as a card with a fieldset: the step's
 * number in an indigo chip, or a green check once it's complete (with the
 * word "done" for screen readers, so the state isn't colour alone).
 */
export function Step({
  n,
  title,
  hint,
  id,
  done,
  disabled,
  children,
}: {
  readonly n: number
  readonly title: string
  readonly hint?: ReactNode
  readonly id?: string
  readonly done: boolean
  readonly disabled?: boolean
  readonly children: ReactNode
}) {
  return (
    <fieldset
      id={id}
      tabIndex={id ? -1 : undefined}
      disabled={disabled}
      className={`${card} m-0 min-w-0 disabled:opacity-70`}
      style={cardStyle}
    >
      <legend className="sr-only">{title}</legend>
      <div className="mb-6 flex items-start gap-3">
        <span
          aria-hidden="true"
          data-done={done}
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-base font-bold"
          style={
            done
              ? {
                  background: "var(--tint-public-bg)",
                  color: T.accent.ok,
                  border: `1.5px solid ${T.accent.ok}`,
                }
              : { background: T.accent.chip, color: T.accent.primaryHover }
          }
        >
          {done ? <Icon icon="mdi:check" width={18} height={18} /> : n}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="type-h2 m-0" style={cardTitle}>
            <span className="sr-only">
              Step {n}
              {done ? ", done" : ""}:{" "}
            </span>
            {title}
          </h2>
          {hint ? (
            <p
              className="m-0 text-base leading-[1.6]"
              style={{ color: T.ink.dim }}
            >
              {hint}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-7">{children}</div>
    </fieldset>
  )
}

/**
 * A labelled control as the role application form lays one out: its name
 * (and Tag), the hint, then the control and its error. `count` sits at the
 * end of the name's row; `hintBelow` moves the hint under the control.
 */
export function Field({
  id,
  label,
  tag,
  hint,
  hintId,
  hintBelow = false,
  count,
  children,
}: {
  readonly id: string
  readonly label: ReactNode
  readonly tag?: ReactNode
  readonly hint?: ReactNode
  readonly hintId?: string
  readonly hintBelow?: boolean
  readonly count?: ReactNode
  readonly children: ReactNode
}) {
  const hintLine = hint ? (
    <p
      id={hintId}
      className={hintBelow ? "mt-2 mb-0 text-sm" : hintClass}
      style={{ color: T.ink.dim }}
    >
      {hint}
    </p>
  ) : null

  return (
    <div className="flex min-w-0 flex-col">
      <div
        className={`flex flex-wrap items-baseline justify-between gap-2 ${hint && !hintBelow ? "" : "mb-2"}`}
      >
        <label
          htmlFor={id}
          className={legendClass}
          style={{ color: T.ink.base }}
        >
          {label}
          {tag ? <Tag>{tag}</Tag> : null}
        </label>
        {count}
      </div>
      {hintBelow ? null : hintLine}
      {children}
      {hintBelow ? hintLine : null}
    </div>
  )
}

/** A field's own error line, under it; status as icon and text. */
export function FieldMessage({
  field,
  message,
}: {
  readonly field: BuilderField
  readonly message?: string
}) {
  if (!message) return null

  return (
    <p
      id={`${fieldId(field)}-error`}
      className="mt-2 mb-0 flex items-start gap-1.5 text-sm font-semibold"
      style={{ color: T.accent.danger }}
    >
      <Icon
        aria-hidden="true"
        icon="mdi:alert-circle-outline"
        width={17}
        className="mt-px shrink-0"
      />
      {message}
    </p>
  )
}

/** "46 of 120" at the end of a field's name row. */
export function CharCount({
  id,
  length,
  max,
}: {
  readonly id: string
  readonly length: number
  readonly max: number
}) {
  return (
    <span
      id={id}
      className="text-sm font-semibold"
      style={{ color: length > max ? T.accent.danger : T.ink.dim }}
    >
      {fmt(length)} of {fmt(max)}
      <span className="sr-only"> characters</span>
    </span>
  )
}

/**
 * A toggle pill: a real checkbox with an icon (or a coloured dot) and,
 * when known, a count badge ("Opening hours 12"), read out with its noun.
 */
export function CheckChip({
  checked,
  disabled,
  onChange,
  icon,
  dot,
  count,
  countNoun,
  children,
}: {
  readonly checked: boolean
  readonly disabled?: boolean
  readonly onChange: () => void
  readonly icon?: string
  /** A small dot in this colour instead of an icon. */
  readonly dot?: string
  readonly count?: number | null
  /** What the count is, for screen readers: "missing it". */
  readonly countNoun?: string
  readonly children: ReactNode
}) {
  let mark: ReactNode = null
  if (dot) {
    mark = (
      <span
        aria-hidden="true"
        className="inline-block size-2 shrink-0 rounded-full"
        style={{ background: dot }}
      />
    )
  } else if (icon) {
    mark = <Icon aria-hidden="true" icon={icon} width={15} height={15} />
  }

  return (
    <label
      className={CHIP}
      style={{
        background: checked ? T.accent.chip : T.bg.deep,
        borderColor: checked ? T.accent.primary : T.border.hi,
        color: checked ? T.accent.primaryHover : T.ink.base,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
      {mark}
      {children}
      {count == null ? null : (
        <>
          <span
            aria-hidden="true"
            className="ml-0.5 rounded-full px-1.5 py-px text-xs font-semibold"
            style={{
              background: checked ? T.bg.deep : T.bg.muted,
              color: checked ? T.accent.primaryHover : T.ink.dim,
            }}
          >
            {fmt(count)}
          </span>
          <span className="sr-only">
            , {fmt(count)} {countNoun ?? ""}
          </span>
        </>
      )}
    </label>
  )
}

/**
 * A row of radio pills ("2 weeks", "4 weeks"…) as a fieldset with its
 * legend. A value that isn't one of the options leaves none chosen.
 */
export function Segments<V extends string | number>({
  id,
  name,
  legend,
  tag,
  options,
  value,
  onChange,
  describedBy,
  children,
}: {
  readonly id?: string
  readonly name: string
  readonly legend: ReactNode
  readonly tag?: ReactNode
  readonly options: readonly { value: V; label: string }[]
  readonly value: V | null
  readonly onChange: (value: V) => void
  readonly describedBy?: string
  /** Under the pills: the hint and the error. */
  readonly children?: ReactNode
}) {
  return (
    <fieldset
      id={id}
      tabIndex={id ? -1 : undefined}
      aria-describedby={describedBy}
      className="m-0 min-w-0 border-0 p-0"
    >
      <legend className={`${legendClass} mb-2`} style={{ color: T.ink.base }}>
        {legend}
        {tag ? <Tag>{tag}</Tag> : null}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const chosen = o.value === value

          return (
            <label
              key={String(o.value)}
              className={`inline-flex min-h-12 cursor-pointer items-center rounded-[14px] px-4 text-base font-medium transition-colors ${RING}`}
              style={{
                border: `1.5px solid ${chosen ? T.accent.primary : T.border.hi}`,
                background: chosen ? T.accent.chip : T.bg.deep,
                color: chosen ? T.accent.primaryHover : T.ink.base,
              }}
            >
              <input
                type="radio"
                name={name}
                value={String(o.value)}
                checked={chosen}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          )
        })}
      </div>
      {children}
    </fieldset>
  )
}

/**
 * A row that opens a group of optional fields. The fields stay in the
 * page while closed (`hidden`), so the form's state never depends on it.
 */
export function Disclosure({
  id,
  open,
  onToggle,
  icon,
  title,
  hint,
  tinted = false,
  children,
}: {
  readonly id: string
  readonly open: boolean
  readonly onToggle: () => void
  readonly icon?: string
  readonly title: string
  readonly hint?: string
  /** The surface background, as "Narrow it further". */
  readonly tinted?: boolean
  readonly children: ReactNode
}) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className={`flex w-full cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-1 text-left ${tinted ? "rounded-[14px] px-4 py-3.5" : "rounded-[10px] py-1"}`}
        style={{
          background: tinted ? T.bg.surface : "transparent",
          border: tinted ? `1px solid ${T.border.divider}` : "none",
          color: T.ink.base,
          fontFamily: T.font.sans,
        }}
      >
        {icon ? (
          <Icon
            aria-hidden="true"
            icon={icon}
            width={18}
            height={18}
            style={{ color: T.accent.primary }}
          />
        ) : null}
        <span className="text-base font-semibold">{title}</span>
        {hint ? (
          <span className="text-sm" style={{ color: T.ink.dim }}>
            {hint}
          </span>
        ) : null}
        <Icon
          aria-hidden="true"
          icon={open ? "mdi:chevron-up" : "mdi:chevron-down"}
          width={20}
          height={20}
          className="ml-auto"
          style={{ color: T.ink.dim }}
        />
      </button>
      <div
        id={id}
        hidden={!open}
        className={open ? "mt-5 flex flex-col gap-7" : undefined}
      >
        {children}
      </div>
    </div>
  )
}
