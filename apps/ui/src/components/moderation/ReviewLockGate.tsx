"use client"

import { Icon } from "@iconify/react"
import { type ReactNode, useState } from "react"

import { primaryCtaSm, secondaryCtaSm } from "@/components/ui/action-styles"
import { cn } from "@/lib/styles"

import { useReviewLock } from "./useReviewLock"

/**
 * Wraps a submission's decision controls in its Review Lock (ADR-0008):
 * the holder works as normal, anyone else reads the page with the
 * controls paused and can take over after confirming.
 */
export function ReviewLockGate({
  documentId,
  active,
  children,
}: {
  readonly documentId: string
  /** Only a pending submission is locked. */
  readonly active: boolean
  readonly children: ReactNode
}) {
  const { view, takeOver } = useReviewLock(documentId, active)
  const [confirming, setConfirming] = useState(false)
  const [taking, setTaking] = useState(false)
  const paused = view.state === "held"
  const who =
    view.state === "held" ? (view.holderName ?? "Another moderator") : ""

  return (
    <div className="flex flex-col gap-4">
      {view.state === "mine" ? (
        <p
          role="status"
          className="m-0 flex items-center gap-2 text-sm text-(--t-ink-dim)"
        >
          <Icon aria-hidden icon="mdi:lock-outline" width={16} />
          You’re reviewing this. Other moderators see it as in review.
        </p>
      ) : null}
      {view.state === "held" ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-2xl border border-(--t-border-line) bg-(--t-palette-amber-soft) p-4 text-base leading-relaxed"
        >
          <p className="m-0 flex items-start gap-2 font-semibold">
            <Icon
              aria-hidden
              icon="mdi:account-lock-outline"
              width={20}
              className="mt-0.5 shrink-0"
            />
            {view.takenOver
              ? `${who} took over this review.`
              : `${who} is reviewing this submission.`}
          </p>
          <p className="m-0 text-sm">
            You can read everything, but decisions are paused until they finish
            or their lock lapses after two minutes away.
          </p>
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="m-0 w-full text-sm font-semibold">
                Take over from {who}? Their decision form pauses straight away.
              </p>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className={cn(secondaryCtaSm, "min-h-11 cursor-pointer")}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={taking}
                onClick={async () => {
                  setTaking(true)
                  await takeOver()
                  setTaking(false)
                  setConfirming(false)
                }}
                className={cn(
                  primaryCtaSm,
                  "min-h-11 cursor-pointer disabled:opacity-50"
                )}
              >
                Take over review
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={cn(secondaryCtaSm, "min-h-11 w-fit cursor-pointer")}
            >
              Take over
            </button>
          )}
        </div>
      ) : null}
      <fieldset
        disabled={paused}
        aria-disabled={paused || undefined}
        className={cn(
          "m-0 min-w-0 border-0 p-0",
          paused && "opacity-60 select-none"
        )}
      >
        {children}
      </fieldset>
    </div>
  )
}
