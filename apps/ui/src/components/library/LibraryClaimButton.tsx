"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { useCreateSubmission } from "@/hooks/useSubmissions"
import { T } from "@/lib/design-tokens"
import { auroraCtaSm } from "@/lib/styles"

interface LibraryClaimButtonProps {
  readonly libraryDocumentId: string
  readonly librarySlug: string
  readonly libraryName: string
  readonly isAuthenticated: boolean
}

export function LibraryClaimButton({
  libraryDocumentId,
  librarySlug,
  libraryName,
  isAuthenticated,
}: LibraryClaimButtonProps) {
  const [showForm, setShowForm] = useState(false)
  const [note, setNote] = useState("")
  const { mutate, isPending } = useCreateSubmission()

  if (!isAuthenticated) {
    return (
      <Link
        href="/auth/signin?callbackUrl=/contribute"
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: T.ink.faint,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
        }}
        className="transition-colors hover:text-white"
      >
        Sign in to claim this library
      </Link>
    )
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className={auroraCtaSm}
        style={{ border: "none", cursor: "pointer" }}
      >
        Claim this library
      </button>
    )
  }

  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "16px",
        padding: "20px",
        background: "rgba(255,255,255,.02)",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        maxWidth: "480px",
      }}
    >
      <div>
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: T.accent.aurora,
            marginBottom: "6px",
          }}
        >
          Claim {libraryName}
        </p>
        <p
          style={{
            fontSize: "13px",
            color: T.ink.dim,
            lineHeight: "1.6",
            margin: 0,
          }}
        >
          Tell us your role at this institution. A moderator will verify and
          approve your claim before you can submit data updates.
        </p>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Your role at this library, your institutional email, or any verification details…"
        rows={4}
        style={{
          padding: "12px 14px",
          borderRadius: "10px",
          border: `1px solid ${T.border.hi}`,
          background: "rgba(255,255,255,.04)",
          color: T.ink.base,
          fontSize: "13px",
          resize: "vertical",
          outline: "none",
          fontFamily: T.font.sans,
          lineHeight: "1.6",
        }}
      />

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          disabled={isPending || note.trim().length < 10}
          onClick={() =>
            mutate(
              {
                submissionType: "library_claim",
                targetEntityType: "library",
                targetDocumentId: libraryDocumentId,
                targetSlug: librarySlug,
                note,
              },
              {
                onSuccess: () => {
                  toast.success(
                    "Claim submitted — a moderator will review it shortly."
                  )
                  setShowForm(false)
                },
                onError: (err) =>
                  toast.error(err?.message ?? "Submission failed"),
              }
            )
          }
          className={auroraCtaSm}
          style={{
            border: "none",
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending || note.trim().length < 10 ? 0.5 : 1,
          }}
        >
          {isPending ? "Submitting…" : "Submit claim"}
        </button>
        <button
          onClick={() => setShowForm(false)}
          style={{
            padding: "8px 16px",
            borderRadius: "10px",
            border: `1px solid ${T.border.line}`,
            background: "transparent",
            color: T.ink.dim,
            fontSize: "13px",
            cursor: "pointer",
            fontFamily: T.font.sans,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
