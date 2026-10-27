"use client"

import type { ReactNode } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { T } from "@/lib/design-tokens"

/** Keep longer history and collection text available without expanding the page. */
export function LibraryAboutDisclosure({
  children,
  links,
  label = "Read the full history",
  title = "History and collections",
}: {
  readonly children?: ReactNode
  readonly links?: ReactNode
  readonly label?: string
  readonly title?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-base">
      {children ? (
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className="inline-flex min-h-11 cursor-pointer items-center rounded-full border bg-white px-4 font-semibold transition-colors hover:border-(--t-accent-primary) hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
              style={{ borderColor: T.border.hi, color: T.ink.base }}
            >
              {label}
            </button>
          </DialogTrigger>
          <DialogContent
            className="max-h-[85dvh] overflow-y-auto rounded-3xl border p-6 sm:max-w-3xl sm:p-8"
            style={{
              background: T.bg.deep,
              borderColor: T.border.line,
              color: T.ink.base,
            }}
          >
            <DialogHeader className="text-left">
              <DialogTitle className="type-h2 pr-7">{title}</DialogTitle>
              <DialogDescription
                className="text-sm"
                style={{ color: T.ink.dim }}
              >
                The history, building and collections recorded for this library.
              </DialogDescription>
            </DialogHeader>
            <div
              className="text-base leading-[1.65]"
              style={{ color: T.ink.dim }}
            >
              {children}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
      {links}
    </div>
  )
}
