"use client"

import { useState } from "react"

import { Breadcrumb } from "@/components/ds/Breadcrumb"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

const CORRECTION_CATEGORIES = [
  { value: "opening_hours", label: "Opening hours" },
  { value: "address", label: "Address or location" },
  { value: "status", label: "Operational status" },
  { value: "contact", label: "Contact details" },
  { value: "website", label: "Website or links" },
  { value: "other", label: "Something else" },
] as const

type CorrectionCategory = (typeof CORRECTION_CATEGORIES)[number]["value"]

interface CorrectLibraryFormProps {
  slug: string
  libraryName: string
  sessionUser: { id: string; email: string; name: string }
}

export function CorrectLibraryForm({
  slug,
  libraryName,
}: CorrectLibraryFormProps) {
  const [category, setCategory] = useState<CorrectionCategory | "">("")
  const [note, setNote] = useState("")
  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category || !note.trim()) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionType: "correction",
          targetEntityType: "library",
          targetSlug: slug,
          fields: { category, libraryName },
          note: note.trim(),
        }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? "Failed to submit correction.")
      } else {
        setSubmitted(true)
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setPending(false)
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: "10px",
    border: `1px solid ${T.border.hi}`,
    background: T.bg.surface,
    color: T.ink.base,
    fontSize: "14px",
    fontFamily: T.font.sans,
    outline: "none",
    boxSizing: "border-box" as const,
  }

  const labelStyle = {
    fontFamily: T.font.sans,
    fontSize: "13px",
    color: T.ink.low,
    display: "block",
    marginBottom: "6px",
  }

  if (submitted) {
    return (
      <div
        style={{
          maxWidth: "480px",
          margin: "80px auto",
          padding: "0 20px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: T.font.serif,
            fontSize: "28px",
            color: T.ink.base,
            marginBottom: "12px",
          }}
        >
          Correction submitted.
        </p>
        <p style={{ fontSize: "14px", color: T.ink.low, marginBottom: "28px" }}>
          Thanks for helping keep {libraryName} accurate. Our team will review
          your note shortly.
        </p>
        <GlobalLink
          href="/contribute/submissions"
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.accent.aurora,
            textDecoration: "none",
          }}
        >
          View my submissions →
        </GlobalLink>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: "560px", margin: "60px auto", padding: "0 20px" }}>
      <Breadcrumb
        className="mb-8"
        items={[
          { label: "Home", href: "/" },
          { label: "Contribute", href: "/contribute" },
          { label: "Suggest a correction" },
        ]}
      />

      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "13px",
          color: T.ink.faint,
          marginBottom: "10px",
        }}
      >
        Corrections
      </p>
      <h1
        style={{
          fontFamily: T.font.serif,
          fontSize: "clamp(1.8rem,4vw,2.4rem)",
          fontWeight: 400,
          letterSpacing: "-0.02em",
          color: T.ink.base,
          margin: "0 0 6px",
        }}
      >
        Suggest a correction
      </h1>
      <p
        style={{
          fontSize: "14px",
          color: T.ink.low,
          marginBottom: "32px",
          lineHeight: "1.6",
        }}
      >
        Spotted something wrong on the{" "}
        <strong style={{ color: T.ink.base }}>{libraryName}</strong> page? Let
        us know and we&apos;ll review it.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "20px" }}
      >
        <div>
          <label style={labelStyle} htmlFor="category">
            What needs correcting?
          </label>
          <select
            id="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value as CorrectionCategory)}
            style={{
              ...inputStyle,
              appearance: "none",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23ffffff44'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 14px center",
              paddingRight: "36px",
            }}
            className="focus:border-(--t-aurora-edge)"
          >
            <option value="">Select a category…</option>
            {CORRECTION_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle} htmlFor="note">
            What&apos;s wrong?
          </label>
          <textarea
            id="note"
            required
            rows={5}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe the issue. Include the correct information if you know it."
            style={{
              ...inputStyle,
              resize: "vertical",
              minHeight: "110px",
              lineHeight: "1.6",
            }}
            className="focus:border-(--t-aurora-edge) focus:bg-(--t-aurora-soft)"
          />
        </div>

        {error ? (
          <p style={{ fontSize: "13px", color: T.accent.danger }}>{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending || !category || !note.trim()}
          style={{
            padding: "13px",
            borderRadius: "10px",
            background: T.ink.base,
            color: T.bg.void,
            fontFamily: T.font.sans,
            fontWeight: 600,
            fontSize: "14px",
            border: "none",
            cursor:
              pending || !category || !note.trim() ? "not-allowed" : "pointer",
            opacity: pending || !category || !note.trim() ? 0.5 : 1,
            transition: "opacity 150ms",
          }}
        >
          {pending ? "Submitting…" : "Submit correction →"}
        </button>
      </form>
    </div>
  )
}
