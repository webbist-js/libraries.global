// apps/ui/src/components/ds/FilterPanel.tsx
//
// Shared faceted-filter sidebar primitives (the /index "Find libraries"
// style): no card wrapper, a "Filters" header with an underlined Reset,
// fieldset groups with an indigo stroke-icon legend, 35px option rows with
// native inputs and right-aligned counts (long lists scroll inside their
// group), a sticky desktop sidebar that can be hidden, and a left slide-in
// drawer + toggle button for mobile.
"use client"

import {
  Children,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"

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

/**
 * "Filters" title, underlined Reset and (desktop, when `sidebar` is given) a
 * Hide button. The row is 44px, the height of the results toolbar beside
 * it, so the two line up.
 */
export function FilterPanelHeader({
  title = "Filters",
  onReset,
  resetLabel = "Reset",
  sidebar,
}: {
  readonly title?: string
  readonly onReset: () => void
  readonly resetLabel?: string
  /** From useFilterSidebar: adds the desktop Hide control. */
  readonly sidebar?: FilterSidebarState
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-2">
      <h2 className="m-0 text-[20px] font-bold">{title}</h2>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onReset}
          className="cursor-pointer rounded-full border-0 bg-transparent px-2 py-1 text-[14px] font-semibold underline"
          style={{ color: T.ink.dim, textUnderlineOffset: 3 }}
        >
          {resetLabel}
        </button>
        {sidebar ? (
          <button
            type="button"
            id={sidebar.hideId}
            onClick={sidebar.hide}
            aria-controls={sidebar.sidebarId}
            aria-expanded
            className="hidden cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-2 py-1 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-muted2) lg:inline-flex"
            style={{ color: T.ink.dim }}
          >
            <PanelIcon />
            Hide
          </button>
        ) : null}
      </div>
    </div>
  )
}

function PanelIcon() {
  return (
    <svg {...LEGEND_ICON_PROPS} stroke="currentColor" width={17} height={17}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
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
/** More options than this and the list scrolls inside its group. */
const MAX_VISIBLE_OPTIONS = 7

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
  const count = Children.count(children)
  const scrolls = count > MAX_VISIBLE_OPTIONS

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
      {scrolls ? (
        <>
          {/* ~6.5 rows, so the cut-off row shows there's more. Inner
              padding keeps focus rings inside the scroll box. */}
          <div
            className="clear-both -mx-1 max-h-[232px] overflow-y-auto overscroll-contain border-b px-1 pb-1"
            style={{ borderColor: T.border.divider }}
          >
            {children}
          </div>
          <FilterHelper>{count} options · scroll for more</FilterHelper>
        </>
      ) : (
        <div className="clear-both flex flex-col">{children}</div>
      )}
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
      <span className="min-w-0 flex-1 truncate" title={label}>
        {label}
      </span>
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
    <FilterPill
      onClick={onClick}
      activeCount={activeCount}
      expanded={expanded}
      label={label}
      className="flex lg:hidden"
    />
  )
}

/** Desktop "Filters" pill that brings a hidden sidebar back. */
export function FilterShowButton({
  sidebar,
  activeCount = 0,
}: {
  readonly sidebar: FilterSidebarState
  readonly activeCount?: number
}) {
  if (!sidebar.collapsed) return null

  return (
    <FilterPill
      id={sidebar.showId}
      onClick={sidebar.show}
      activeCount={activeCount}
      expanded={false}
      controls={sidebar.sidebarId}
      label="Filters"
      icon
      className="hidden lg:flex"
    />
  )
}

function FilterPill({
  id,
  onClick,
  activeCount,
  expanded,
  controls,
  label,
  icon = false,
  className,
}: {
  readonly id?: string
  readonly onClick: () => void
  readonly activeCount: number
  readonly expanded?: boolean
  readonly controls?: string
  readonly label: string
  readonly icon?: boolean
  readonly className: string
}) {
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={controls}
      className={`${className} min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-[15px] font-semibold`}
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.hi}`,
        color: T.ink.base,
      }}
    >
      {icon ? <PanelIcon /> : null}
      {label}
      {activeCount > 0 ? (
        <span
          className="flex size-5 items-center justify-center rounded-full text-[12px] font-bold text-white"
          style={{ background: T.accent.primary }}
        >
          {activeCount}
          <span className="sr-only"> active</span>
        </span>
      ) : null}
    </button>
  )
}

export type FilterSidebarState = {
  collapsed: boolean
  hide: () => void
  show: () => void
  sidebarId: string
  hideId: string
  showId: string
}

/**
 * Whether the desktop filter sidebar is hidden, remembered per viewer and
 * page (`key`). Starts expanded and reads the preference after mount, so
 * server and client render alike. Focus follows the control that replaces
 * the one just pressed.
 */
export function useFilterSidebar(key: string): FilterSidebarState {
  const storageKey = `filters.collapsed.${key}`
  const [collapsed, setCollapsed] = useState(false)
  const focusNext = useRef<string | null>(null)
  const id = useId()
  const sidebarId = `${id}-sidebar`
  const hideId = `${id}-hide`
  const showId = `${id}-show`

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount
      setCollapsed(globalThis.localStorage?.getItem(storageKey) === "1")
    } catch {
      // storage unavailable (private mode, blocked): keep the default
    }
  }, [storageKey])

  useEffect(() => {
    if (!focusNext.current) return
    document.getElementById(focusNext.current)?.focus()
    focusNext.current = null
  }, [collapsed])

  const update = useCallback(
    (next: boolean) => {
      focusNext.current = next ? showId : hideId
      setCollapsed(next)
      try {
        globalThis.localStorage?.setItem(storageKey, next ? "1" : "0")
      } catch {
        // storage unavailable: the choice lasts for this visit only
      }
    },
    [storageKey, showId, hideId]
  )

  return {
    collapsed,
    hide: useCallback(() => update(true), [update]),
    show: useCallback(() => update(false), [update]),
    sidebarId,
    hideId,
    showId,
  }
}

/**
 * The desktop sidebar: sticky under the header, never taller than the
 * viewport (it scrolls on its own), and hidden when collapsed. Mobile uses
 * FilterDrawer instead.
 */
export function FilterSidebar({
  sidebar,
  children,
}: {
  readonly sidebar: FilterSidebarState
  readonly children: ReactNode
}) {
  return (
    <aside
      id={sidebar.sidebarId}
      aria-label="Filters"
      className={[
        "sticky top-[90px] w-[290px] shrink-0 overflow-y-auto overscroll-contain",
        // Inner padding keeps focus rings clear of the scroll box's edge.
        "-mx-1 max-h-[calc(100dvh-110px)] px-1 pb-4",
        sidebar.collapsed ? "hidden" : "hidden lg:block",
      ].join(" ")}
    >
      {children}
    </aside>
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
