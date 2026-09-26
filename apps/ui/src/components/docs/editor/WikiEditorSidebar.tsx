"use client"

import { useState } from "react"

import { T } from "@/lib/design-tokens"

type SubmitState = "idle" | "submitting" | "submitted" | "error"

export function WikiEditorSidebar({
  submissionId,
  onSubmit,
}: {
  readonly submissionId?: number
  readonly onSubmit: () => Promise<void>
}) {
  const [submitState, setSubmitState] = useState<SubmitState>("idle")

  async function handleSubmit() {
    if (!submissionId) return
    setSubmitState("submitting")
    try {
      await onSubmit()
      setSubmitState("submitted")
    } catch {
      setSubmitState("error")
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "20px",
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: "18px",
        position: "sticky",
        top: "80px",
      }}
    >
      <span className="text-[14px] font-semibold" style={{ color: T.ink.base }}>
        Edit session
      </span>

      {/* Status indicator */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              flexShrink: 0,
              background:
                submitState === "submitted"
                  ? T.accent.ok
                  : submitState === "error"
                    ? T.accent.danger
                    : submissionId
                      ? T.accent.aurora
                      : T.ink.faint,
            }}
          />
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: T.ink.low,
            }}
          >
            {submitState === "submitted"
              ? "Submitted for review"
              : submitState === "error"
                ? "Submission failed"
                : submissionId
                  ? "Draft saved"
                  : "No changes yet"}
          </span>
        </div>

        {submissionId && submitState !== "submitted" && (
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              color: T.ink.faint,
            }}
          >
            Draft #{submissionId}
          </span>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: T.border.line }} />

      {/* Info */}
      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "11px",
          color: T.ink.dim,
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        Changes are auto-saved as a draft. When ready, submit for editorial
        review. Approved edits publish immediately.
      </p>

      {/* Submit button */}
      {submitState !== "submitted" && (
        <button
          onClick={handleSubmit}
          disabled={!submissionId || submitState === "submitting"}
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color:
              !submissionId || submitState === "submitting"
                ? T.ink.faint
                : T.accent.aurora,
            background:
              !submissionId || submitState === "submitting"
                ? T.bg.surface
                : "rgba(127,223,255,.08)",
            border: `1px solid ${!submissionId || submitState === "submitting" ? T.border.line : "rgba(127,223,255,.25)"}`,
            borderRadius: "6px",
            padding: "10px",
            cursor:
              !submissionId || submitState === "submitting"
                ? "not-allowed"
                : "pointer",
            width: "100%",
          }}
        >
          {submitState === "submitting" ? "Submitting…" : "Submit for review →"}
        </button>
      )}

      {submitState === "error" && (
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            color: T.accent.danger,
            textAlign: "center",
          }}
        >
          Try again or reload the page.
        </span>
      )}
    </div>
  )
}
