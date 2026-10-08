"use client"

import { Icon } from "@iconify/react"
import { type ReactNode, useEffect, useRef } from "react"

import { T } from "@/lib/design-tokens"

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Where focus starts when a drawer opens: the chosen radio card, else the
 * first field, else the first button (Close, in the header).
 */
function firstControl(panel: HTMLElement): HTMLElement | null {
  return (
    panel.querySelector<HTMLElement>("input[type=radio]:checked") ??
    panel.querySelector<HTMLElement>("select, textarea, input") ??
    panel.querySelector<HTMLElement>("button")
  )
}

/**
 * A modal side drawer: a dimmed backdrop, a `role="dialog"` panel on the
 * right with `aria-modal`, and a header (tinted icon, serif title, an
 * optional line under it, Close). While open it locks the page's scroll,
 * keeps Tab inside the panel, closes on Escape or a backdrop click, and
 * gives focus back to whatever had it when it opened. `children` fill the
 * panel below the header, as flex children of a column.
 * `size="md"` is an inset, rounded paper panel (the staff drawer); the
 * default is the wider full-height paper sheet.
 */
export function Drawer({
  titleId,
  title,
  subtitle,
  eyebrow,
  headerContent,
  footer,
  icon,
  onClose,
  initialFocus = firstControl,
  size = "lg",
  children,
}: {
  /** The header title's id: the dialog's accessible name. */
  readonly titleId: string
  readonly title: ReactNode
  /** One line under the title, e.g. the library and its place. */
  readonly subtitle?: ReactNode
  /** A badge above the title, sharing a row with the close button. */
  readonly eyebrow?: ReactNode
  /** Controls beneath the title, inside the tinted header. */
  readonly headerContent?: ReactNode
  /** Fixed below the scrolling content in an inset panel. */
  readonly footer?: ReactNode
  /** Iconify id and its tint pair, shown in a circle before the title. */
  readonly icon?: {
    readonly name: string
    readonly bg: string
    readonly fg: string
  }
  readonly onClose: () => void
  /** Picks the element focused on open; the first control by default. */
  readonly initialFocus?: (panel: HTMLElement) => HTMLElement | null
  /** `lg`: full-height 760 px sheet. `md`: inset 440 px paper panel. */
  readonly size?: "lg" | "md"
  readonly children?: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  // Read through refs, so a new callback each render never re-runs the
  // open/close effect (which would restore and re-take focus).
  const close = useRef(onClose)
  const start = useRef(initialFocus)
  useEffect(() => {
    close.current = onClose
    start.current = initialFocus
  })

  useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null
    const root = document.documentElement
    const overflow = root.style.overflow
    root.style.overflow = "hidden"
    if (panel.current) start.current(panel.current)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close.current()

        return
      }
      if (e.key !== "Tab" || !panel.current) return
      // Keep Tab inside the dialog.
      const items = [
        ...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ].filter((el) => el.offsetParent !== null)
      if (items.length === 0) return
      const first = items[0]!
      const last = items.at(-1)!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)

    return () => {
      document.removeEventListener("keydown", onKey)
      root.style.overflow = overflow
      returnFocus?.focus?.()
    }
  }, [])

  const heading = (
    <div className="min-w-0">
      <h2
        id={titleId}
        className="m-0"
        style={{
          fontFamily: T.font.serif,
          fontSize:
            size === "md" ? "clamp(26px,4vw,34px)" : "clamp(22px,3vw,28px)",
          fontWeight: 500,
          lineHeight: size === "md" ? 1.1 : 1.15,
          letterSpacing: "-0.01em",
          color: T.ink.base,
        }}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className="m-0 mt-0.5 truncate text-[15px]"
          style={{ color: T.ink.dim }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  )
  const closeButton = (
    <button
      aria-label="Close"
      className="flex size-11 shrink-0 items-center justify-center rounded-full border bg-white hover:bg-(--t-bg-surface)"
      onClick={() => close.current()}
      style={{ borderColor: T.border.line, color: T.ink.base }}
      type="button"
    >
      <Icon aria-hidden="true" height={20} icon="mdi:close" width={20} />
    </button>
  )

  const header = (
    <div
      className={`shrink-0 border-b px-5 ${size === "md" ? "py-5" : "py-4 sm:px-6"}`}
      style={{
        background: size === "md" ? T.bg.space : T.bg.deep,
        borderColor: T.border.line,
      }}
    >
      {eyebrow ? (
        <>
          <div className="mb-3 flex items-center justify-between gap-4">
            {eyebrow}
            {closeButton}
          </div>
          {heading}
        </>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            {icon ? (
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: icon.bg, color: icon.fg }}
              >
                <Icon height={20} icon={icon.name} width={20} />
              </span>
            ) : null}
            {heading}
          </div>
          {closeButton}
        </div>
      )}
      {headerContent ? <div className="mt-4">{headerContent}</div> : null}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        aria-hidden="true"
        className="absolute inset-0 cursor-default border-0"
        onClick={() => close.current()}
        style={{ background: T.overlay.scrim }}
        tabIndex={-1}
        type="button"
      />
      <div
        ref={panel}
        aria-labelledby={titleId}
        aria-modal="true"
        className={[
          "absolute flex flex-col overscroll-contain",
          size === "md"
            ? "inset-y-2 right-4 w-[calc(100%-2rem)] max-w-[440px] overflow-hidden rounded-[28px] border"
            : "inset-y-0 right-0 w-full border-l sm:w-[min(760px,100vw)]",
        ].join(" ")}
        role="dialog"
        style={{
          background: T.bg.void,
          borderColor: T.border.hi,
        }}
      >
        {size === "md" ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {header}
            {children}
          </div>
        ) : (
          <>
            {header}
            {children}
          </>
        )}
        {footer}
      </div>
    </div>
  )
}
