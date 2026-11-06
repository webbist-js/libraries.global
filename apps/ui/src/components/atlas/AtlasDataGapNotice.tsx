"use client"

import { useTranslations } from "next-intl"
import { useId, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import type { AtlasDataGap } from "./atlas-data-gaps"

/**
 * Mount once per encounter, not per render. Opens by itself unless the
 * reader has hidden these explanations (`hidden`); the details button always
 * stays, so the gap is still marked. Closing acknowledges this encounter;
 * only "Don't show this again" with Continue calls `onHide`.
 */
export function AtlasDataGapNotice({
  gap,
  layer,
  scope,
  hidden = false,
  signedIn = false,
  onHide,
}: {
  readonly gap: AtlasDataGap
  readonly layer: string
  readonly scope: string
  readonly hidden?: boolean
  readonly signedIn?: boolean
  /** Hide future explanations; resolves false when it couldn't be saved. */
  readonly onHide?: () => Promise<boolean>
}) {
  const t = useTranslations("atlasDataGaps")
  const [open, setOpen] = useState(!hidden)
  const [dontShow, setDontShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const hintId = useId()
  // Keep the choice on screen while a successful hide closes the dialog.
  const offerChoice = Boolean(onHide) && (!hidden || dontShow)

  async function acknowledge() {
    if (saving) return
    setError(false)
    if (dontShow && onHide) {
      setSaving(true)
      const saved = await onHide()
      setSaving(false)
      if (!saved) {
        setError(true)

        return
      }
    }
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return
        if (next) {
          setDontShow(false)
          setError(false)
        }
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="min-h-11 rounded-xl border border-(--t-border-line) bg-(--t-bg-surface) px-4 py-2 text-sm font-semibold text-(--t-ink-base)"
        >
          {t("details")}
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto"
        showCloseButton={!saving}
        aria-busy={saving}
        onEscapeKeyDown={(event) => {
          if (saving) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (saving) event.preventDefault()
        }}
      >
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
        {offerChoice ? (
          <div>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm font-medium">
              <input
                type="checkbox"
                name="hide-atlas-data-gap"
                checked={dontShow}
                disabled={saving}
                aria-describedby={hintId}
                onChange={(event) => {
                  setDontShow(event.target.checked)
                  setError(false)
                }}
                className="mt-0.5 size-5 shrink-0 accent-(--t-accent-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
              />
              {t(signedIn ? "dontShowAgain" : "dontShowAgainVisit")}
            </label>
            <p id={hintId} className="m-0 mt-1 text-sm text-(--t-ink-dim)">
              {t(signedIn ? "hideHintSignedIn" : "hideHintSignedOut", {
                button: t("details"),
              })}
            </p>
          </div>
        ) : hidden ? (
          <p className="m-0 text-sm text-(--t-ink-dim)">
            {t(signedIn ? "hiddenSignedIn" : "hiddenSignedOut")}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="m-0 text-sm">
            {t("saveError")}
          </p>
        ) : null}
        <button
          type="button"
          disabled={saving}
          onClick={() => void acknowledge()}
          className="min-h-11 rounded-xl bg-(--t-action-primary) px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary) disabled:opacity-60"
        >
          {saving ? t("saving") : t("continue")}
        </button>
      </DialogContent>
    </Dialog>
  )
}
