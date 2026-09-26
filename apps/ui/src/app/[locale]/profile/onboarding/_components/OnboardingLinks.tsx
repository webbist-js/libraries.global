"use client"

import { useState } from "react"

import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"

export function OnboardingLinks({
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
  const [form, setForm] = useState({
    website: initialProfile?.website ?? "",
    orcid: initialProfile?.orcid ?? "",
    mastodon: initialProfile?.mastodon ?? "",
    linkedin: initialProfile?.linkedin ?? "",
  })

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "10px",
    border: `1px solid ${T.border.hi}`,
    background: T.bg.surface,
    color: T.ink.base,
    fontSize: "13px",
    fontFamily: "Roboto, sans-serif",
    outline: "none",
    boxSizing: "border-box" as const,
  }

  const labelStyle = {
    fontFamily: "JetBrains Mono, monospace",
    fontSize: "10px",
    letterSpacing: ".16em",
    textTransform: "uppercase" as const,
    color: T.ink.faint,
    display: "block",
    marginBottom: "6px",
  }

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
          External links
        </h1>
        <p style={{ margin: 0, fontSize: "14px", color: T.ink.faint }}>
          All optional — share what you&apos;re comfortable with.
        </p>
      </div>

      <div>
        <label style={labelStyle}>Website</label>
        <input
          style={inputStyle}
          type="url"
          value={form.website ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
          placeholder="https://yoursite.net"
        />
      </div>

      <div>
        <label style={labelStyle}>ORCID iD</label>
        <input
          style={inputStyle}
          type="text"
          value={form.orcid ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, orcid: e.target.value }))}
          placeholder="https://orcid.org/0000-0000-0000-0000"
        />
      </div>

      <div>
        <label style={labelStyle}>Mastodon / Bluesky</label>
        <input
          style={inputStyle}
          type="text"
          value={form.mastodon ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, mastodon: e.target.value }))}
          placeholder="@you@mastodon.social or @you.bsky.social"
        />
      </div>

      <div>
        <label style={labelStyle}>LinkedIn</label>
        <input
          style={inputStyle}
          type="url"
          value={form.linkedin ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))}
          placeholder="https://linkedin.com/in/yourhandle"
        />
      </div>

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
          onClick={() => onNext(form)}
          style={{
            padding: "10px 24px",
            borderRadius: "10px",
            border: "none",
            background: T.ink.base,
            color: T.bg.void,
            fontSize: "13px",
            fontFamily: "Roboto, sans-serif",
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Continue →"}
        </button>
      </div>
    </div>
  )
}
