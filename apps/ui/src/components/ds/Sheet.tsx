"use client"
import * as Dialog from "@radix-ui/react-dialog"
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"

/**
 * A modal sheet from the right or the bottom. Radix names the dialog from
 * its Title; pass `labelledBy` only to name it from another element.
 */
export function Sheet({
  open,
  onClose,
  side,
  title,
  children,
  footer,
  labelledBy,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly side: "right" | "bottom"
  readonly title: string
  readonly children: ReactNode
  readonly footer?: ReactNode
  readonly labelledBy?: string
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[80]"
          style={{ background: T.overlay.scrim }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          {...(labelledBy ? { "aria-labelledby": labelledBy } : {})}
          className={`fixed z-[81] flex max-h-[95dvh] flex-col overflow-y-auto overscroll-contain border p-6 ${side === "right" ? "inset-y-0 right-0 w-full sm:max-w-2xl" : "inset-x-0 bottom-0 rounded-t-[20px]"}`}
          style={{ background: T.bg.void, borderColor: T.border.hi }}
        >
          <div className="flex items-center justify-between gap-4">
            <Dialog.Title
              {...(labelledBy ? { id: labelledBy } : {})}
              className="m-0 text-2xl"
              style={{ fontFamily: T.font.serif }}
            >
              {title}
            </Dialog.Title>
            <Dialog.Close
              className="min-h-11 shrink-0 rounded-full border bg-white px-4 font-semibold hover:bg-(--t-bg-surface)"
              style={{ borderColor: T.border.hi, color: T.ink.base }}
            >
              Close
            </Dialog.Close>
          </div>
          <div className="py-5">{children}</div>
          {footer ? (
            <footer
              className="border-t pt-4"
              style={{ borderColor: T.border.line }}
            >
              {footer}
            </footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
