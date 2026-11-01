"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog"

import type { AtlasDataGap } from "./atlas-data-gaps"

/** Mount once per encounter, not per render; dismissal is never persisted. */
export function AtlasDataGapNotice({
  gap,
  layer,
  scope,
}: {
  readonly gap: AtlasDataGap
  readonly layer: string
  readonly scope: string
}) {
  const t = useTranslations("atlasDataGaps")
  const [open, setOpen] = useState(true)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="min-h-11 rounded-xl border border-(--t-border-line) bg-(--t-bg-surface) px-4 py-2 text-sm font-semibold text-(--t-ink-base)"
        >
          {t("details")}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="type-h3">{t("title", { layer })}</DialogTitle>
          <DialogDescription>{scope}</DialogDescription>
        </DialogHeader>
        <ul className="m-0 space-y-3 pl-5 text-sm leading-relaxed">
          {gap.reasons.map((reason) => (
            <li key={reason}>{t(`reasons.${reason}`)}</li>
          ))}
        </ul>
        {gap.count !== undefined ? (
          <p className="m-0 text-sm">{t("affected", { count: gap.count })}</p>
        ) : null}
        {[...new Set(gap.details)].map((detail) => (
          <p key={detail} className="m-0 text-sm leading-relaxed">
            {detail}
          </p>
        ))}
        {gap.available?.length ? (
          <p className="m-0 text-sm">
            {t("available", { places: gap.available.join(", ") })}
          </p>
        ) : null}
        <p className="m-0 text-sm text-(--t-ink-dim)">{t("unknown")}</p>
        <DialogClose asChild>
          <button
            type="button"
            className="min-h-11 rounded-xl bg-(--t-accent-primary) px-4 py-2 text-sm font-semibold text-white"
          >
            {t("continue")}
          </button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}
