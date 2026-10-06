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
 * panel below the header, as flex children of a full-height column.
 */
export function Drawer({
  titleId,
  title,
  subtitle,
  icon,
  onClose,
  initialFocus = firstControl,
  children,
}: {
  /** The header title's id: the dialog's accessible name. */
  readonly titleId: string
  readonly title: ReactNode
  /** One line under the title, e.g. the library and its place. */
  readonly subtitle?: ReactNode
  /** Iconify id and its tint pair, shown in a circle before the title. */
  readonly icon?: {
    readonly name: string
    readonly bg: string
    readonly fg: string
  }
  readonly onClose: () => void
  /** Picks the element focused on open; the first control by default. */
  readonly initialFocus?: (panel: HTMLElement) => HTMLElement | null
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

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        aria-label="Close"
        className="absolute inset-0 cursor-default border-0"
        onClick={() => close.current()}
        style={{ background: "rgba(23,22,43,.32)" }}
        tabIndex={-1}
        type="button"
      />
      <div
        ref={panel}
        aria-labelledby={titleId}
        aria-modal="true"
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l sm:w-[min(760px,100vw)]"
        role="dialog"
        style={{ background: T.bg.void, borderColor: T.border.hi }}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-4 border-b px-5 py-4 sm:px-6"
          style={{ background: T.bg.deep, borderColor: T.border.line }}
        >
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
            <div className="min-w-0">
              <h2
                id={titleId}
                className="m-0"
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "clamp(22px,3vw,28px)",
                  fontWeight: 500,
                  lineHeight: 1.15,
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
          </div>
          <button
            aria-label="Close"
            className="flex size-11 shrink-0 items-center justify-center rounded-full border bg-white hover:bg-(--t-bg-surface)"
            onClick={() => close.current()}
            style={{ borderColor: T.border.line, color: T.ink.base }}
            type="button"
          >
            <Icon aria-hidden="true" height={20} icon="mdi:close" width={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
