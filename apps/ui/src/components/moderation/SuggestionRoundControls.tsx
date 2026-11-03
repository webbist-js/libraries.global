"use client"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ds/Badge"
import GlobalLink from "@/components/global/GlobalLink"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { SuggestionReviewRound } from "@/lib/community/suggestions"
import { T } from "@/lib/design-tokens"

export function SuggestionRoundControls({
  initial,
}: {
  initial?: SuggestionReviewRound | null
}) {
  const t = useTranslations("optionSuggestions")
  const [round, setRound] = useState(initial ?? null)
  const [cutoff, setCutoff] = useState(initial?.cutoffAt.slice(0, 16) ?? "")
  const [review, setReview] = useState(initial?.reviewAt.slice(0, 16) ?? "")
  const [capacity, setCapacity] = useState(initial?.capacity ?? 5)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(!initial)
  const [confirming, setConfirming] = useState(false)
  function adopt(value: SuggestionReviewRound) {
    setRound(value)
    setCutoff(value.cutoffAt.slice(0, 16))
    setReview(value.reviewAt.slice(0, 16))
    setCapacity(value.capacity)
  }
  useEffect(() => {
    if (initial) return
    const controller = new AbortController()
    fetch("/api/moderation/suggestion-round", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data && !controller.signal.aborted) adopt(json.data)
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [initial])
  async function save(action: "schedule" | "close"): Promise<boolean> {
    if (!round || busy) return false
    setBusy(true)
    setFailed(false)
    setMessage("")
    try {
      const res = await fetch("/api/moderation/suggestion-round", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          version: round.version,
          ...(action === "schedule"
            ? {
                cutoffAt: new Date(`${cutoff}Z`).toISOString(),
                reviewAt: new Date(`${review}Z`).toISOString(),
                capacity,
              }
            : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setFailed(true)
        setMessage(json.error?.message ?? t("roundFailed"))

        return false
      }
      adopt(json.data)
      setMessage(t("roundSaved"))

      return true
    } catch {
      setFailed(true)
      setMessage(t("roundFailed"))

      return false
    } finally {
      setBusy(false)
    }
  }
  if (!round)
    return (
      <p
        role="status"
        className="m-0 rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 text-base leading-relaxed text-(--t-ink-dim)"
      >
        {loading ? "Loading the review schedule…" : t("reviewUnavailable")}
      </p>
    )

  return (
    <section className="grid min-w-0 gap-5 rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5">
      <div className="flex flex-col items-start gap-3">
        <h2 className="type-h2 m-0">{t("manageRound")}</h2>
        <Badge
          label={t(round.state === "voting" ? "openVotes" : "reviewInProgress")}
          color={round.state === "voting" ? "ok" : "aurora"}
        />
      </div>
      {round.state === "voting" ? (
        <fieldset
          disabled={busy}
          className="m-0 grid min-w-0 gap-4 border-0 p-0"
        >
          <legend className="sr-only">{t("manageRound")}</legend>
          <label className="grid min-w-0 gap-2 text-sm font-semibold">
            {t("cutoffAt")}
            <input
              type="datetime-local"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
              className="min-h-[48px] w-full min-w-0 rounded-[14px] border border-(--t-border-hi) bg-(--t-bg-surface) px-3 py-2 text-base font-normal"
            />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-semibold">
            {t("reviewAt")}
            <input
              type="datetime-local"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              className="min-h-[48px] w-full min-w-0 rounded-[14px] border border-(--t-border-hi) bg-(--t-bg-surface) px-3 py-2 text-base font-normal"
            />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-semibold">
            {t("capacity")}
            <input
              type="number"
              min={1}
              max={20}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="min-h-[48px] w-full min-w-0 rounded-[14px] border border-(--t-border-hi) bg-(--t-bg-surface) px-3 py-2 text-base font-normal"
            />
          </label>
        </fieldset>
      ) : (
        <ol className="m-0 grid pl-5 text-base leading-relaxed">
          {round.shortlist.map((item) => (
            <li key={item.documentId}>
              <a
                href={`#moderation-suggestion-${item.documentId}`}
                className="inline-flex min-h-[44px] items-center font-semibold text-(--t-accent-primary) underline underline-offset-4"
              >
                {item.name}
              </a>{" "}
              · {t("votes", { count: item.votes })}
            </li>
          ))}
        </ol>
      )}
      {round.state === "voting" ? (
        <Button
          type="button"
          disabled={busy}
          onClick={() => void save("schedule")}
          variant="primary"
          size="pill"
          className="w-full"
        >
          {t("saveRound")}
        </Button>
      ) : (
        <>
          <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
            {t("completeLead")}
          </p>
          <Button
            type="button"
            disabled={busy}
            aria-haspopup="dialog"
            onClick={() => setConfirming(true)}
            variant="primary"
            size="pill"
            className="w-full"
          >
            {t("completeRound")}
          </Button>
          <Dialog open={confirming} onOpenChange={setConfirming}>
            <DialogContent
              className="flex max-h-[calc(100dvh-2rem)] flex-col gap-5 overflow-y-auto overscroll-contain rounded-3xl p-6 sm:max-w-xl sm:p-8"
              closeButtonClassName="grid size-11 place-items-center rounded-full border border-(--t-border-line) bg-(--t-bg-deep) opacity-100 hover:bg-(--t-bg-surface)"
              style={{ background: T.bg.deep, color: T.ink.base }}
            >
              <DialogHeader className="gap-3 text-left">
                <DialogTitle className="type-h2 m-0 pr-12">
                  {t("completeTitle")}
                </DialogTitle>
                <DialogDescription
                  className="m-0 text-base leading-relaxed"
                  style={{ color: T.ink.dim }}
                >
                  {t("completeBody")}
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-2xl bg-(--t-accent-chip) p-4 text-base leading-relaxed">
                <p className="m-0 font-semibold">{t("completeDriveTitle")}</p>
                <p className="m-0 mt-1">{t("completeDrive")}</p>
                <GlobalLink
                  href="/community/propose?gaps=facilities"
                  className="mt-2 inline-flex min-h-11 items-center font-semibold text-(--t-accent-primary) underline underline-offset-4"
                >
                  {t("planDrive")}
                </GlobalLink>
              </div>
              <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
                {t("completeNext")}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="surface"
                    size="pill"
                    disabled={busy}
                  >
                    {t("completeCancel")}
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  variant="primary"
                  size="pill"
                  disabled={busy}
                  onClick={async () => {
                    if (await save("close")) setConfirming(false)
                  }}
                >
                  {t("completeConfirm")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={`m-0 rounded-xl px-4 py-3 text-sm leading-relaxed ${failed ? "bg-(--t-palette-coral-soft) text-(--t-palette-coral-fg)" : "bg-(--t-palette-mint-soft) text-(--t-palette-mint-fg)"}`}
        >
          {message}
        </p>
      )}
    </section>
  )
}
