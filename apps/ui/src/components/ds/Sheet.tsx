"use client"

import { type ReactNode, useId } from "react"

import { T } from "@/lib/design-tokens"

import { Drawer } from "./Drawer"

/** Controlled drawer with standard body padding and a fixed action footer. */
export function Sheet({
  open,
  onClose,
  side,
  title,
  children,
  footer,
  labelledBy,
  size = "lg",
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly side: "right" | "bottom"
  readonly title: string
  readonly children: ReactNode
  readonly footer?: ReactNode
  readonly labelledBy?: string
  readonly size?: "md" | "lg" | "xl"
}) {
  const id = useId()

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side={side}
      size={size}
      title={title}
      titleId={labelledBy ?? id}
      footer={
        footer ? (
          <footer
            className="shrink-0 border-t px-5 py-4 sm:px-6"
            style={{ borderColor: T.border.line }}
          >
            {footer}
          </footer>
        ) : undefined
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
        {children}
      </div>
    </Drawer>
  )
}
