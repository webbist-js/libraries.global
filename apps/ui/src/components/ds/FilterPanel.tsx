// apps/ui/src/components/ds/FilterPanel.tsx
//
// Shared faceted-filter sidebar primitives (the /index "Find libraries"
// style): no card wrapper, a "Filters" header with an underlined Reset,
// collapsible fieldset groups with an indigo stroke-icon legend, 35px option
// rows with native inputs and right-aligned counts (long lists cut to a
// preview with "Show all"), a sticky desktop sidebar that can be hidden, and
// a left slide-in drawer + toggle button for mobile.
"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import {
  Children,
  createContext,
  isValidElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"

import { T } from "@/lib/design-tokens"

import { Drawer } from "./Drawer"

const FilterDrawerContext = createContext(false)

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
  const tUi = useUiTranslations("ui")

  const inDrawer = useContext(FilterDrawerContext)

  return (
    <div
      className={`flex min-h-11 items-center gap-2 ${inDrawer ? "justify-end" : "justify-between"}`}
    >
      {inDrawer ? null : <h2 className="m-0 text-[20px] font-bold">{title}</h2>}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onReset}
          className="min-h-10 cursor-pointer rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-3 text-[13px] font-semibold transition-colors hover:bg-(--t-bg-muted)"
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
            className="hidden min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-3 text-[13px] font-semibold transition-colors hover:bg-(--t-bg-muted2) lg:inline-flex"
            style={{ color: T.ink.dim }}
          >
            <PanelIcon />
            {tUi("hide")}{" "}
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

/** More options than this and the list is cut to PREVIEW_OPTIONS. */
const MAX_VISIBLE_OPTIONS = 7
const PREVIEW_OPTIONS = 5

/**
 * Whether an option narrows the results: a ticked checkbox, or a chosen
 * radio other than the first (the first radio is the "any" default).
 */
function isActiveOption(child: ReactNode, index: number): boolean {
  if (!isValidElement<FilterOptionProps>(child) || !child.props.checked) {
    return false
  }

  return child.props.type === "checkbox" || index > 0
}

/**
 * A collapsible fieldset filter group: the title is a button that opens and
 * closes it. A group with an active option starts open whatever
 * `defaultOpen` says, and a closed group shows how many options are active.
 * Long lists show the first few with a "Show all" toggle, and stay expanded
 * while a ticked option sits past the cut. `icon` is the inner SVG markup
 * (paths etc.) of a 24×24 stroke icon, rendered inside an indigo stroke <svg>.
 * A group of other controls (selects, nested fieldsets) passes its own
 * `activeCount`.
 */
export function FilterGroup({
  title,
  icon,
  children,
  helper,
  dimmed = false,
  defaultOpen = true,
  activeCount,
}: {
  readonly title: string
  readonly icon: React.ReactNode
  readonly children?: React.ReactNode
  readonly helper?: React.ReactNode
  readonly dimmed?: boolean
  readonly defaultOpen?: boolean
  readonly activeCount?: number
}) {
  const options = Children.toArray(children)
  const activeFlags = options.map(isActiveOption)
  const active = activeCount ?? activeFlags.filter(Boolean).length
  const long = options.length > MAX_VISIBLE_OPTIONS
  const hiddenChecked = long && activeFlags.slice(PREVIEW_OPTIONS).some(Boolean)

  const [open, setOpen] = useState(() => defaultOpen || active > 0)
  const [showAll, setShowAll] = useState(false)
  const bodyId = useId()
  const handleToggle = () => setOpen((o) => !o)
  const handleShowAll = () => setShowAll((s) => !s)
  const expanded = !long || showAll || hiddenChecked

  return (
    <fieldset
      className="m-0 border-0 p-0 pt-4 pb-3"
      style={{ borderBottom: `1px solid ${T.border.divider}` }}
    >
      {/* float pulls the legend out of the border slot so the fieldset's
          top padding sits above the title instead of below it */}
      <legend className="float-left w-full p-0">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-h-10 w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left text-[16px] font-semibold text-(--t-ink-base) transition-colors hover:text-(--t-accent-primary)"
          style={{ opacity: dimmed ? 0.55 : 1 }}
        >
          <svg {...LEGEND_ICON_PROPS}>{icon}</svg>
          <span className="min-w-0 flex-1">{title}</span>
          {!open && active > 0 ? (
            <span
              className="rounded-full px-2 py-0.5 text-[12px] font-semibold"
              style={{ background: T.accent.chip, color: T.accent.primary }}
            >
              {active} selected
            </span>
          ) : null}
          <ChevronIcon open={open} />
        </button>
      </legend>
      <div
        id={bodyId}
        hidden={!open}
        className="clear-both pt-1"
        style={{ opacity: dimmed ? 0.55 : 1 }}
      >
        <div className="flex flex-col">
          {expanded ? options : options.slice(0, PREVIEW_OPTIONS)}
        </div>
        {long && !hiddenChecked ? (
          <button
            type="button"
            onClick={handleShowAll}
            aria-expanded={showAll}
            className="mt-1 cursor-pointer rounded-full border-0 bg-transparent p-0 text-[14px] font-semibold underline"
            style={{ color: T.accent.primary, textUnderlineOffset: 3 }}
          >
            {showAll ? "Show fewer" : `Show all ${options.length}`}
          </button>
        ) : null}
        {helper ? <FilterHelper>{helper}</FilterHelper> : null}
      </div>
    </fieldset>
  )
}

function ChevronIcon({ open }: { readonly open: boolean }) {
  return (
    <svg
      {...LEGEND_ICON_PROPS}
      stroke={T.ink.low}
      width={16}
      height={16}
      className="shrink-0 transition-transform"
      style={{ transform: open ? "rotate(180deg)" : undefined }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

type FilterOptionProps = {
  readonly type: "checkbox" | "radio"
  readonly name: string
  readonly label: string
  readonly checked: boolean
  readonly count?: number | null
  readonly disabled?: boolean
  readonly onChange: () => void
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
}: FilterOptionProps) {
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
  const tUi = useUiTranslations("ui")

  if (!sidebar.collapsed) return null

  return (
    <FilterPill
      id={sidebar.showId}
      onClick={sidebar.show}
      activeCount={activeCount}
      expanded={false}
      controls={sidebar.sidebarId}
      label={tUi("filters")}
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
  const tUi = useUiTranslations("ui")

  return (
    <aside
      id={sidebar.sidebarId}
      aria-label={tUi("filters")}
      className={[
        "scrollbar-thin sticky top-[90px] w-[290px] shrink-0 overflow-x-hidden overflow-y-auto overscroll-contain",
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
  const tUi = useUiTranslations("ui")

  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const desktop = window.matchMedia("(min-width: 1024px)")
    const closeOnDesktop = () => {
      if (desktop.matches) onClose()
    }
    closeOnDesktop()
    desktop.addEventListener("change", closeOnDesktop)

    return () => desktop.removeEventListener("change", closeOnDesktop)
  }, [open, onClose])

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="left"
      size="md"
      title={tUi("filters")}
      titleId={titleId}
      footer={
        showLabel ? (
          <div
            className="shrink-0 border-t p-4"
            style={{ borderColor: T.border.line }}
          >
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 w-full rounded-full border-0 bg-(--t-accent-primary) px-5 py-3 text-[16px] font-semibold text-white hover:bg-(--t-accent-primary-hover)"
            >
              {showLabel}
            </button>
          </div>
        ) : undefined
      }
    >
      <FilterDrawerContext.Provider value>
        <div className="px-5 py-4">{children}</div>
      </FilterDrawerContext.Provider>
    </Drawer>
  )
}
