"use client"

import { useState } from "react"

import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"

import { LibraryClaimSearch } from "./LibraryClaimSearch"

const AFFILIATION_TYPES = [
  {
    value: "librarian",
    label: "Librarian / Archivist",
    desc: "I work in a library or archive.",
    showClaim: true,
  },
  {
    value: "researcher",
    label: "Researcher",
    desc: "I conduct research using library resources.",
    showClaim: true,
  },
  {
    value: "educator",
    label: "Educator",
    desc: "I teach or train in an educational institution.",
    showClaim: false,
  },
  {
    value: "reader",
    label: "Reader / Visitor",
    desc: "I use libraries for personal learning.",
    showClaim: false,
  },
  {
    value: "other",
    label: "Other",
    desc: "Something else entirely.",
    showClaim: false,
  },
]

export function OnboardingAffiliation({
  sessionUser,
  initialProfile,
  saving,
  onNext,
  onSkip,
}: {
  sessionUser: { email: string }
  initialProfile: UserProfile | null
  saving: boolean
  onNext: (data: Partial<UserProfile>) => void
  onSkip: () => void
}) {
  const [affiliationType, setAffiliationType] = useState<string>(
    initialProfile?.affiliationType ?? ""
  )
  const [claimResult, setClaimResult] = useState<{
    libraryName: string
    entityRef: string
    status: string
  } | null>(null)

  const selected = AFFILIATION_TYPES.find((a) => a.value === affiliationType)
  const showClaim = selected?.showClaim && !claimResult

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
          Your affiliation
        </h1>
        <p style={{ margin: 0, fontSize: "14px", color: T.ink.faint }}>
          How do you primarily engage with libraries?
        </p>
      </div>

      {/* Affiliation type cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {AFFILIATION_TYPES.map((type) => {
          const active = affiliationType === type.value

          return (
            <button
              key={type.value}
              type="button"
              onClick={() => setAffiliationType(type.value)}
              style={{
                padding: "14px 18px",
                borderRadius: "8px",
                border: `1px solid ${active ? "rgba(127,223,255,0.4)" : T.border.line}`,
                background: active ? "rgba(127,223,255,0.06)" : T.bg.surface,
                cursor: "pointer",
                textAlign: "left",
                transition: "border-color 150ms, background 150ms",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: 600,
                  color: active ? T.ink.base : T.ink.dim,
                }}
              >
                {type.label}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "12px",
                  color: T.ink.faint,
                }}
              >
                {type.desc}
              </p>
            </button>
          )
        })}
      </div>

      {/* Library claim section */}
      {showClaim && affiliationType && (
        <div
          style={{
            borderTop: `1px solid ${T.border.line}`,
            paddingTop: "20px",
          }}
        >
          <p
            style={{
              margin: "0 0 16px",
              fontSize: "13px",
              fontWeight: 600,
              color: T.ink.base,
            }}
          >
            Claim your library affiliation
          </p>
          <p
            style={{ margin: "0 0 16px", fontSize: "12px", color: T.ink.faint }}
          >
            Find your institution below. If your email domain matches the
            library&apos;s website, you&apos;ll be verified instantly. Otherwise
            your claim will be reviewed.
          </p>
          <LibraryClaimSearch onClaimed={(result) => setClaimResult(result)} />
        </div>
      )}

      {/* Already claimed */}
      {claimResult && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "8px",
            border: `1px solid ${claimResult.status === "verified" ? "rgba(142,240,179,0.3)" : "rgba(255,207,122,0.3)"}`,
            background:
              claimResult.status === "verified"
                ? "rgba(142,240,179,0.05)"
                : "rgba(255,207,122,0.05)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color:
                claimResult.status === "verified" ? T.accent.ok : T.accent.warn,
            }}
          >
            {claimResult.status === "verified"
              ? `Verified at ${claimResult.libraryName}`
              : `Claim pending for ${claimResult.libraryName}`}
          </p>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: "8px",
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
          onClick={() =>
            onNext({
              affiliationType:
                affiliationType as UserProfile["affiliationType"],
            })
          }
          style={{
            padding: "10px 24px",
            borderRadius: "8px",
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
