// apps/ui/src/components/ds/FilterPanel.tsx
//
// Shared faceted-filter sidebar primitives (the /index "Find libraries"
// style): no card wrapper, a "Filters" header with an underlined Reset,
// fieldset groups with an indigo stroke-icon legend, 35px option rows with
// native inputs and right-aligned counts, and a left slide-in drawer +
// toggle button for mobile.
"use client"

import { T } from "@/lib/design-tokens"

const LEGEND_ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "var(--t-accent-primary)",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
}

/** "Filters" title + underlined Reset text button. */
export function FilterPanelHeader({
  title = "Filters",
  onReset,
  resetLabel = "Reset",
}: {
  readonly title?: string
  readonly onReset: () => void
  readonly resetLabel?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="m-0 text-[20px] font-bold">{title}</h2>
      <button
        type="button"
        onClick={onReset}
        className="cursor-pointer rounded-full border-0 bg-transparent px-2 py-1 text-[14px] font-semibold underline"
        style={{ color: T.ink.dim, textUnderlineOffset: 3 }}
      >
        {resetLabel}
      </button>
    </div>
  )
}

/** Helper / empty-state text in the filter-group style. */
export function FilterHelper({
  children,
}: {
  readonly children: React.ReactNode
}) {
  return (
    <p
      className="mt-1.5 mb-0 text-[13px] leading-[1.4]"
      style={{ color: T.ink.low }}
    >
      {children}
    </p>
  )
}

/**
 * A fieldset filter group. `icon` is the inner SVG markup (paths etc.) of a
 * 24×24 stroke icon — it is rendered inside an indigo stroke <svg>.
 */
export function FilterGroup({
  title,
  icon,
  children,
  helper,
  dimmed = false,
}: {
  readonly title: string
  readonly icon: React.ReactNode
  readonly children?: React.ReactNode
  readonly helper?: React.ReactNode
  readonly dimmed?: boolean
}) {
  return (
    <fieldset
      className="m-0 border-0 p-0 pt-5 pb-4"
      style={{
        borderBottom: `1px solid ${T.border.divider}`,
        opacity: dimmed ? 0.55 : 1,
      }}
    >
      {/* float pulls the legend out of the border slot so the fieldset's
          top padding sits above the title instead of below it */}
      <legend className="float-left mb-1.5 flex w-full items-center gap-2 p-0 text-[16px] font-semibold">
        <svg {...LEGEND_ICON_PROPS}>{icon}</svg>
        {title}
      </legend>
      <div className="clear-both flex flex-col">{children}</div>
      {helper ? <FilterHelper>{helper}</FilterHelper> : null}
    </fieldset>
  )
}

/** A 35px checkbox/radio option row with an optional right-aligned count. */
export function FilterOption({
  type,
  name,
  label,
  checked,
  count,
  disabled = false,
  onChange,
}: {
  readonly type: "checkbox" | "radio"
  readonly name: string
  readonly label: string
  readonly checked: boolean
  readonly count?: number | null
  readonly disabled?: boolean
  readonly onChange: () => void
}) {
  return (
    <label
      className="flex h-[35px] items-center gap-2.5 text-[15px]"
      style={{
        cursor: disabled ? "not-allowed" : "pointer",
        color: T.ink.base,
      }}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="size-5 shrink-0"
        style={{
          accentColor: "var(--t-accent-primary)",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null ? (
        <span className="text-[14px] tabular-nums" style={{ color: T.ink.low }}>
          {count}
        </span>
      ) : null}
    </label>
  )
}

/** Mobile-only "Filters" pill that opens the drawer, with an active count. */
export function FilterToggleButton({
  onClick,
  activeCount = 0,
  expanded,
  label = "Filters",
}: {
  readonly onClick: () => void
  readonly activeCount?: number
  readonly expanded?: boolean
  readonly label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className="flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-[15px] font-semibold lg:hidden"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.hi}`,
        color: T.ink.base,
      }}
    >
      {label}
      {activeCount > 0 ? (
        <span
          className="flex size-5 items-center justify-center rounded-full text-[12px] font-bold text-white"
          style={{ background: T.accent.primary }}
        >
          {activeCount}
        </span>
      ) : null}
    </button>
  )
}

/**
 * Mobile slide-in filter drawer from the left with a dim backdrop.
 * `showLabel` renders the full-width indigo "Show N results" close button.
 */
export function FilterDrawer({
  open,
  onClose,
  children,
  showLabel,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly children: React.ReactNode
  readonly showLabel?: string
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] lg:hidden">
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 border-0"
        style={{ background: "rgba(23,22,43,.4)" }}
      />
      <div
        className="absolute inset-y-0 left-0 w-[min(340px,88vw)] overflow-y-auto p-5"
        style={{ background: T.bg.void }}
      >
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            aria-label="Close filters"
            onClick={onClose}
            className="flex size-9 cursor-pointer items-center justify-center rounded-full border-0 text-[18px]"
            style={{ background: T.bg.muted2, color: T.ink.base }}
          >
            ×
          </button>
        </div>
        {children}
        {showLabel ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full cursor-pointer rounded-full border-0 px-5 py-3 text-[16px] font-semibold text-white"
            style={{ background: T.accent.primary }}
          >
            {showLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}
