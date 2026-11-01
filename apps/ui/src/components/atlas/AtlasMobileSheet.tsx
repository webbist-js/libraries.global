"use client"

import { useTranslations } from "next-intl"
import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react"

import { Icon } from "./atlas-ui"
import { useAtlasMotion } from "./useAtlasMotion"

import panelStyles from "./AtlasAnalysisStack.module.css"

export type AtlasSheetSize = "closed" | "peek" | "half" | "full"
const SIZES: AtlasSheetSize[] = ["closed", "peek", "half", "full"]
const HEIGHTS = {
  closed: "0px",
  peek: "188px",
  half: "54%",
  full: "calc(100% - 12px)",
}

/** Reveal inputs without shrinking a panel the reader already expanded. */
export const expandAtlasSheet = (size: AtlasSheetSize): AtlasSheetSize =>
  size === "full" ? "full" : "half"

/** Mobile-only map sheet; dragging its handle never competes with content scrolling. */
export function AtlasMobileSheet({
  size,
  onSizeChange,
  children,
}: {
  readonly size: AtlasSheetSize
  readonly onSizeChange: (size: AtlasSheetSize) => void
  readonly children: ReactNode
}) {
  const t = useTranslations("ui")
  const animate = useAtlasMotion()
  const panel = useRef<HTMLElement>(null)
  const handle = useRef<HTMLButtonElement>(null)
  const reopen = useRef<HTMLButtonElement>(null)
  const focusAfterResize = useRef<"handle" | "reopen" | null>(null)
  const drag = useRef<{
    id: number
    x: number
    y: number
    heights: number[]
    start: number
  } | null>(null)
  const suppressClick = useRef(false)
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const closed = size === "closed"

  useEffect(() => {
    if (focusAfterResize.current) {
      const target = focusAfterResize.current === "handle" ? handle : reopen
      target.current?.focus({ preventScroll: true })
      focusAfterResize.current = null
    } else if (closed && panel.current?.contains(document.activeElement))
      reopen.current?.focus({ preventScroll: true })
    else if (!closed && document.activeElement === reopen.current)
      handle.current?.focus({ preventScroll: true })
  }, [closed])

  function resize(next: AtlasSheetSize) {
    // Hiding the focused button can blur it before React's effect runs.
    if (next === "closed") focusAfterResize.current = "reopen"
    else if (closed) focusAfterResize.current = "handle"
    onSizeChange(next)
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    suppressClick.current = false
    if (event.button !== 0 || event.isPrimary === false) return
    const available =
      panel.current?.parentElement?.clientHeight || window.innerHeight
    const heights = [
      0,
      Math.min(188, available - 12),
      available * 0.54,
      available - 12,
    ]
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      heights,
      start: heights[SIZES.indexOf(size)]!,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current
    if (!start || start.id !== event.pointerId) return
    const dy = event.clientY - start.y
    if (Math.abs(dy) < 8) return
    suppressClick.current = true
    setDragHeight(Math.max(0, Math.min(start.heights[3]!, start.start - dy)))
  }

  function cancelDrag() {
    drag.current = null
    setDragHeight(null)
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current
    if (!start || start.id !== event.pointerId) return
    const dy = event.clientY - start.y
    cancelDrag()
    if (Math.abs(dy) < 40 || Math.abs(event.clientX - start.x) > Math.abs(dy))
      return
    suppressClick.current = true
    const target = start.start - dy
    let index = start.heights.reduce(
      (best, height, i) =>
        Math.abs(height - target) < Math.abs(start.heights[best]! - target)
          ? i
          : best,
      0
    )
    const current = SIZES.indexOf(size)
    // A deliberate short swipe still advances one position.
    if (index === current)
      index = Math.max(0, Math.min(3, current + (dy > 0 ? -1 : 1)))
    resize(SIZES[index]!)
  }

  return (
    <>
      <section
        ref={panel}
        aria-label="Explore panel"
        aria-hidden={closed || undefined}
        inert={closed}
        className={`${panelStyles.stack} absolute inset-x-0 bottom-0 z-30 flex min-h-0 flex-col overflow-clip rounded-t-[24px] border-t border-(--t-border-hi) bg-(--t-bg-deep) pb-[env(safe-area-inset-bottom)]`}
        style={{
          height: dragHeight ?? HEIGHTS[size],
          visibility: closed ? "hidden" : undefined,
          viewTransitionName: "var(--atlas-mobile-sheet-transition, none)",
        }}
      >
        <div className="relative flex h-11 shrink-0">
          <button
            ref={handle}
            type="button"
            aria-label={`Panel size: ${size}. Change size`}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={cancelDrag}
            onLostPointerCapture={cancelDrag}
            onClick={(event) => {
              if (suppressClick.current && event.detail !== 0) return
              suppressClick.current = false
              animate(() => resize(size === "full" ? "half" : "full"))
            }}
            onKeyDown={(event) => {
              if (!["ArrowUp", "ArrowDown", "Escape"].includes(event.key))
                return
              event.preventDefault()
              const index =
                SIZES.indexOf(size) + (event.key === "ArrowUp" ? 1 : -1)
              animate(() =>
                resize(
                  event.key === "Escape"
                    ? "closed"
                    : SIZES[Math.max(0, Math.min(3, index))]!
                )
              )
            }}
            className="flex flex-1 touch-none items-center justify-center select-none"
          >
            <span className="h-[5px] w-10 rounded-full bg-(--t-border-hi)" />
          </button>
          <button
            type="button"
            aria-label={t("atlas_hide_controls")}
            onClick={() => animate(() => resize("closed"))}
            className="absolute right-2 flex size-11 items-center justify-center rounded-full text-(--t-ink-dim)"
          >
            <Icon name="chevD" size={18} />
          </button>
        </div>
        {children}
      </section>
      <button
        ref={reopen}
        type="button"
        aria-label={t("atlas_show_controls")}
        onClick={() => animate(() => resize("half"))}
        hidden={!closed}
        className="absolute bottom-[calc(48px+env(safe-area-inset-bottom))] left-1/2 z-30 min-h-11 -translate-x-1/2 items-center gap-2 rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-4 text-sm font-semibold shadow-sm"
        style={{ display: closed ? "flex" : "none" }}
      >
        <span className="rotate-180">
          <Icon name="chevD" size={16} />
        </span>
        {t("atlas_controls")}
      </button>
    </>
  )
}
