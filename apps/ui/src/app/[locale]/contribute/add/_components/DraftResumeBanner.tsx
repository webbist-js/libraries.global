"use client"

import { useMemo } from "react"

import { T } from "@/lib/design-tokens"

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
      style={{
        border: `1px solid rgba(127,223,255,0.25)`,
        borderRadius: "10px",
        padding: "14px 18px",
        background: "rgba(127,223,255,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        marginBottom: "24px",
        flexWrap: "wrap",
      }}
    >
      <div>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: T.accent.aurora,
            display: "block",
            marginBottom: "2px",
          }}
        >
          Draft found · Step {savedStep} · saved {relTime}
        </span>
        <span
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.ink.dim,
          }}
        >
          You have unsaved progress. Resume where you left off?
        </span>
      </div>
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <button
          onClick={onResume}
          style={{
            padding: "7px 16px",
            borderRadius: "6px",
            border: `1px solid rgba(127,223,255,0.35)`,
            background: "rgba(127,223,255,0.1)",
            color: T.accent.aurora,
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Continue →
        </button>
        <button
          onClick={onDiscard}
          style={{
            padding: "7px 16px",
            borderRadius: "6px",
            border: `1px solid ${T.border.line}`,
            background: "transparent",
            color: T.ink.faint,
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Start fresh
        </button>
      </div>
    </div>
  )
}
