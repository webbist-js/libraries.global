"use client"

import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import StrapiBlocksContent from "@/components/library/StrapiBlocksContent"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { T } from "@/lib/design-tokens"

export function LibraryFeatureDetails({
  name,
  summary,
  description,
  detailCategory,
  children,
  className = "inline-flex items-center gap-1.5 text-left underline decoration-dotted underline-offset-4",
}: {
  readonly name: string
  readonly summary?: string | null
  readonly description?: unknown
  readonly detailCategory?: string | null
  readonly children?: ReactNode
  readonly className?: string
}) {
  const blocks = Array.isArray(description) ? description : []
  if (!summary?.trim() && blocks.length === 0) return <>{children ?? name}</>

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={`${className} cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2`}
          aria-label={`More about ${name}`}
        >
          {children ?? name}
          <Icon
            aria-hidden="true"
            icon="mdi:information-outline"
            width={15}
            height={15}
            className="shrink-0"
          />
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto rounded-3xl border p-6 sm:max-w-2xl sm:p-8"
        style={{
          background: T.bg.deep,
          borderColor: T.border.line,
          color: T.ink.base,
        }}
      >
        <DialogHeader className="text-left">
          {detailCategory ? (
            <p
              className="m-0 text-[13px] font-semibold"
              style={{ color: T.accent.primary }}
            >
              {detailCategory}
            </p>
          ) : null}
          <DialogTitle
            className="pr-7 text-[30px] leading-tight"
            style={{ fontFamily: T.font.serif, fontWeight: 500 }}
          >
            {name}
          </DialogTitle>
          <DialogDescription
            className="text-[14px] leading-relaxed"
            style={{ color: T.ink.dim }}
          >
            About this feature. Check with the library for availability and any
            requirements.
          </DialogDescription>
        </DialogHeader>
        {summary?.trim() ? (
          <p className="m-0 text-[16px] leading-relaxed">{summary}</p>
        ) : null}
        {blocks.length > 0 ? (
          <StrapiBlocksContent
            blocks={
              blocks as Parameters<typeof StrapiBlocksContent>[0]["blocks"]
            }
            className="text-[15px]"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
