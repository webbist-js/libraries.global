"use client"

import { useState } from "react"

import { VisibilityCards } from "@/components/settings/VisibilityCards"
import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"

export function OnboardingVisibility({
  initialProfile,
  saving,
  onNext,
  onSkip,
}: {
  initialProfile: UserProfile | null
  saving: boolean
  onNext: (data: Partial<UserProfile>) => void
  onSkip: () => void
}) {
  const [visibility, setVisibility] = useState<
    "public" | "limited" | "private"
  >(initialProfile?.profileVisibility ?? "public")

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "28px",
            fontWeight: 700,
            fontFamily: "Fraunces, serif",
            color: T.ink.base,
          }}
        >
          Profile visibility
        </h1>
        <p style={{ margin: 0, fontSize: "14px", color: T.ink.faint }}>
          Control who can see your profile. You can change this any time in
          settings.
        </p>
      </div>

      <VisibilityCards value={visibility} onChange={setVisibility} />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: "10px",
        }}
      >
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: "none",
            border: "none",
            color: T.ink.faint,
            fontSize: "13px",
            cursor: "pointer",
            fontFamily: "Roboto, sans-serif",
          }}
        >
          Skip for now
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onNext({ profileVisibility: visibility })}
          style={{
            padding: "10px 24px",
            borderRadius: "10px",
            border: "1px solid rgba(127,223,255,0.35)",
            background: "rgba(127,223,255,0.1)",
            color: T.accent.aurora,
            fontSize: "13px",
            fontFamily: "Roboto, sans-serif",
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Enter your profile →"}
        </button>
      </div>
    </div>
  )
}
