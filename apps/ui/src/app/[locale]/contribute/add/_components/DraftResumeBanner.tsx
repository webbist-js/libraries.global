"use client"

import { useMemo } from "react"

import { T } from "@/lib/design-tokens"
import { primaryCtaSm } from "@/lib/styles"

export function DraftResumeBanner({
  savedStep,
  savedAt,
  onResume,
  onDiscard,
}: {
  savedStep: number
  savedAt: string
  onResume: () => void
  onDiscard: () => void
}) {
  const relTime = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const diff = Date.now() - new Date(savedAt).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 2) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`

    return `${Math.floor(hrs / 24)}d ago`
  }, [savedAt])

  return (
    <div
      role="region"
      aria-label="Saved draft"
      className="flex flex-wrap items-center justify-between gap-4"
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "20px",
        padding: "18px 22px",
        background: T.accent.chip,
        marginBottom: "32px",
      }}
    >
      <div>
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "16px",
            fontWeight: 600,
            color: T.ink.base,
            margin: "0 0 2px",
          }}
        >
          Draft found · Step {savedStep} · saved {relTime}
        </p>
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "15px",
            color: T.ink.dim,
            margin: 0,
          }}
        >
          You have unsaved progress. Resume where you left off?
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onResume}
          className={primaryCtaSm}
          style={{ border: "none", cursor: "pointer" }}
        >
          Continue
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-full px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-(--t-bg-muted-2)"
          style={{
            border: `1px solid ${T.border.hi}`,
            background: T.bg.deep,
            color: T.ink.base,
            fontFamily: T.font.sans,
            cursor: "pointer",
          }}
        >
          Start fresh
        </button>
      </div>
    </div>
  )
}
