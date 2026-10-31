"use client"

import { Icon } from "@iconify/react"
import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { useTranslations as useUiTranslations } from "next-intl"
import { type CSSProperties, type ReactNode, useRef } from "react"

import { T } from "@/lib/design-tokens"
import { cn } from "@/lib/styles"

const DRAWER_WIDTH = { md: "440px", lg: "760px", xl: "1120px" } as const

/**
 * Where focus starts when a drawer opens: the chosen radio card, else the
 * first field, else the first button (Close, in the header).
 */
function firstControl(panel: HTMLElement): HTMLElement | null {
  return (
    panel.querySelector<HTMLElement>(
      "input[type=radio]:checked:not(:disabled)"
    ) ??
    panel.querySelector<HTMLElement>(
      "select:not(:disabled), textarea:not(:disabled), input:not(:disabled):not([type=hidden])"
    ) ??
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
 * `edgeAligned` pins a workspace drawer to the viewport, with a fixed
 * header/footer and independently scrolling body. Radix handles
 * focus trapping, page scroll locking, background isolation and nesting.
 */
export function Drawer({
  open = true,
  side = "right",
  titleId,
  title,
  subtitle,
  eyebrow,
  headerContent,
  headerActions,
  footer,
  icon,
  onClose,
  initialFocus = firstControl,
  size = "lg",
  edgeAligned = false,
  className,
  onAfterClose,
  returnFocusTo,
  children,
}: {
  readonly open?: boolean
  readonly side?: "right" | "left" | "bottom"
  /** The header title's id: the dialog's accessible name. */
  readonly titleId: string
  readonly title: ReactNode
  /** One line under the title, e.g. the library and its place. */
  readonly subtitle?: ReactNode
  /** A badge above the title, sharing a row with the close button. */
  readonly eyebrow?: ReactNode
  /** Controls beneath the title, inside the tinted header. */
  readonly headerActions?: ReactNode
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
  /** Inset paper panels: `md` 440 px, `lg` 760 px, `xl` 1120 px. */
  readonly size?: "lg" | "md" | "xl"
  readonly edgeAligned?: boolean
  readonly className?: string
  /** Run after focus restoration when handing off to another dialog. */
  readonly onAfterClose?: () => void
  /** Explicit opener for browsers that do not focus buttons on pointer click. */
  readonly returnFocusTo?: HTMLElement | null
  readonly children?: ReactNode
}) {
  const tUi = useUiTranslations("ui")

  const returnFocus = useRef<HTMLElement | null>(null)
  const heading = (
    <div className="min-w-0">
      <div id={titleId}>
        <Dialog.Title className="type-h2" asChild>
          <h2
            className="type-h2 m-0"
            style={{
              color: T.ink.base,
            }}
          >
            {title}
          </h2>
        </Dialog.Title>
      </div>
      {subtitle ? (
        <p
          className="m-0 mt-0.5 truncate text-base"
          style={{ color: T.ink.dim }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  )
  const closeButton = (
    <button
      aria-label={tUi("close")}
      className="flex size-11 shrink-0 items-center justify-center rounded-full border bg-(--t-bg-deep) hover:bg-(--t-bg-surface)"
      onClick={onClose}
      style={{ borderColor: T.border.line, color: T.ink.base }}
      type="button"
    >
      <X aria-hidden="true" height={20} width={20} />
    </button>
  )

  const header = (
    <div
      className={`shrink-0 border-b px-5 ${size === "md" ? "py-5" : "py-4 sm:px-6"}`}
      style={{
        background: T.bg.space,
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
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            {closeButton}
          </div>
        </div>
      )}
      {headerContent ? <div className="mt-4">{headerContent}</div> : null}
    </div>
  )

  const panelClass = edgeAligned
    ? cn(
        "inset-y-0 w-full rounded-none border-0",
        side === "left" ? "left-0 border-r" : "right-0 border-l",
        size === "md"
          ? "max-w-[440px]"
          : size === "xl"
            ? "max-w-[1120px]"
            : "max-w-[760px]"
      )
    : side === "bottom"
      ? "inset-x-0 bottom-0 max-h-[95dvh] rounded-t-[28px] border"
      : [
          "inset-y-2 w-[calc(100%-1rem)] rounded-[28px] border sm:inset-y-4 sm:w-[calc(100%-2rem)]",
          side === "left" ? "left-2 sm:left-4" : "right-2 sm:right-4",
          size === "md"
            ? "max-w-[440px]"
            : size === "xl"
              ? "max-w-[1120px]"
              : "max-w-[760px]",
        ].join(" ")

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          aria-hidden="true"
          data-drawer-backdrop=""
          className="fixed inset-0 z-[80]"
          onClick={onClose}
          style={{ background: T.overlay.scrim }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          aria-labelledby={titleId}
          aria-modal="true"
          data-drawer-panel={side}
          data-drawer-edge={edgeAligned || undefined}
          className={cn(
            "fixed z-[81] flex flex-col overflow-hidden overscroll-contain",
            panelClass,
            className
          )}
          onOpenAutoFocus={(event) => {
            returnFocus.current =
              returnFocusTo ?? (document.activeElement as HTMLElement | null)
            event.preventDefault()
            const panel = event.currentTarget as HTMLElement
            ;(initialFocus(panel) ?? panel).focus({ preventScroll: true })
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocus.current?.focus({ preventScroll: true })
            onAfterClose?.()
          }}
          style={
            {
              background: T.bg.void,
              borderColor: T.border.hi,
              "--drawer-max-width": DRAWER_WIDTH[size],
            } as CSSProperties
          }
        >
          {size === "md" && !edgeAligned ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {header}
              {children}
            </div>
          ) : (
            <>
              {header}
              {edgeAligned ? (
                <div
                  data-drawer-body=""
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
                >
                  {children}
                </div>
              ) : (
                children
              )}
            </>
          )}
          {footer}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
