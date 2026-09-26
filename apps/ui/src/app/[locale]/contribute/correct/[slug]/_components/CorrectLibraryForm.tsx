"use client"

import { Icon } from "@iconify/react"
import type React from "react"
import { useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import { primaryCtaSm } from "@/lib/styles"

import { ContributeSectionHeader } from "../../../_components/ContributeSectionHeader"
import {
  fieldHintStyle,
  fieldInputStyle,
  fieldLabelStyle,
} from "../../../add/_components/wizard.constants"
import { RequiredTag } from "../../../add/_components/WizardFields"

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

const selectStyle: React.CSSProperties = {
  ...fieldInputStyle,
  appearance: "none",
  cursor: "pointer",
  paddingRight: "44px",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2355536A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 16px center",
}

const cardStyle: React.CSSProperties = {
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
}

const REVIEW_STEPS = [
  {
    icon: "mdi:send-outline",
    copy: "Your note is saved and waits for a reviewer.",
  },
  {
    icon: "mdi:magnify",
    copy: "A trusted contributor checks it against the library's own sources.",
  },
  {
    icon: "mdi:check",
    copy: "Accepted corrections are published and credited to you.",
  },
] as const

function ReviewSidebar() {
  return (
    <aside
      aria-labelledby="correct-review-heading"
      className="self-start rounded-[20px] p-6 lg:sticky lg:top-[128px]"
      style={cardStyle}
    >
      <h2
        id="correct-review-heading"
        className="m-0"
        style={{
          fontFamily: T.font.serif,
          fontSize: "22px",
          fontWeight: 500,
          color: T.ink.base,
        }}
      >
        How review works
      </h2>
      <ol className="mt-4 mb-0 flex list-none flex-col gap-4 p-0">
        {REVIEW_STEPS.map((step) => (
          <li key={step.icon} className="flex items-start gap-3">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: T.accent.chip, color: T.accent.primary }}
            >
              <Icon
                icon={step.icon}
                width={16}
                height={16}
                aria-hidden="true"
              />
            </span>
            <span
              className="text-[15px] leading-[1.55]"
              style={{ color: T.ink.dim }}
            >
              {step.copy}
            </span>
          </li>
        ))}
      </ol>
      <p
        className="mt-5 mb-0 pt-5 text-[15px] leading-[1.6]"
        style={{ color: T.ink.dim, borderTop: `1px solid ${T.border.divider}` }}
      >
        The more specific you are — the right hours, the new address, a link to
        the source — the faster it goes through.
      </p>
    </aside>
  )
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

  const disabled = pending || !category || !note.trim()

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        compact
        section="Suggest a correction"
        title={`Correct *${libraryName}.*`}
        lead="Spotted something wrong on this library's page? Tell us what needs fixing and an editor will review it."
      />

      <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8 lg:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          {submitted ? (
            <section
              role="status"
              aria-labelledby="correct-success-heading"
              className="min-w-0 self-start rounded-[20px] p-6 sm:p-8"
              style={cardStyle}
            >
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[14px] font-semibold"
                style={{ background: "#E6EFE6", color: T.accent.ok }}
              >
                <Icon
                  icon="mdi:check-circle-outline"
                  width={16}
                  height={16}
                  aria-hidden="true"
                />
                Submitted
              </span>
              <h2
                id="correct-success-heading"
                className="mt-4 mb-0"
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "clamp(26px,3vw,32px)",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  color: T.ink.base,
                }}
              >
                Correction submitted
              </h2>
              <p
                className="mt-2 mb-6 max-w-[56ch] text-[16px] leading-[1.6]"
                style={{ color: T.ink.dim }}
              >
                Thanks for helping keep {libraryName} accurate. Our team will
                review your note shortly.
              </p>
              <GlobalLink
                href="/contribute/submissions"
                className={primaryCtaSm}
              >
                View my submissions
                <Icon
                  icon="mdi:arrow-right"
                  width={16}
                  height={16}
                  aria-hidden="true"
                />
              </GlobalLink>
            </section>
          ) : (
            <section
              aria-labelledby="correct-form-heading"
              className="min-w-0 self-start rounded-[20px] p-6 sm:p-8"
              style={cardStyle}
            >
              <h2
                id="correct-form-heading"
                className="m-0"
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "clamp(24px,2.6vw,28px)",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  color: T.ink.base,
                }}
              >
                What needs fixing?
              </h2>
              <p
                className="mt-2 mb-6 max-w-[62ch] text-[15px] leading-[1.6]"
                style={{ color: T.ink.dim }}
              >
                You&apos;re suggesting a change to{" "}
                <strong style={{ color: T.ink.base, fontWeight: 600 }}>
                  {libraryName}
                </strong>
                .
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label style={fieldLabelStyle} htmlFor="category">
                    What needs correcting?
                    <RequiredTag />
                  </label>
                  <select
                    id="category"
                    required
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as CorrectionCategory)
                    }
                    style={{
                      ...selectStyle,
                      color: category ? T.ink.base : T.ink.dim,
                    }}
                  >
                    <option value="">Select a category…</option>
                    {CORRECTION_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label style={fieldLabelStyle} htmlFor="note">
                    What&apos;s wrong?
                    <RequiredTag />
                  </label>
                  <textarea
                    id="note"
                    required
                    rows={5}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Describe the issue. Include the correct information if you know it."
                    aria-describedby="note-hint"
                    style={{
                      ...fieldInputStyle,
                      resize: "vertical",
                      minHeight: "140px",
                      lineHeight: 1.6,
                    }}
                  />
                  <p id="note-hint" style={fieldHintStyle}>
                    If you have a source (the library&apos;s website, a notice,
                    a photo), mention it here.
                  </p>
                </div>

                {error ? (
                  <p
                    role="alert"
                    className="m-0 flex items-start gap-2 rounded-[14px] px-4 py-3 text-[15px] leading-normal"
                    style={{ background: "#F6E3DA", color: T.accent.danger }}
                  >
                    <Icon
                      icon="mdi:alert-circle-outline"
                      width={18}
                      height={18}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0"
                    />
                    {error}
                  </p>
                ) : null}

                <div
                  className="flex flex-wrap items-center gap-3 pt-6"
                  style={{ borderTop: `1px solid ${T.border.divider}` }}
                >
                  <button
                    type="submit"
                    disabled={disabled}
                    className={`${primaryCtaSm} text-[15px] disabled:cursor-not-allowed disabled:opacity-45`}
                  >
                    {pending ? "Submitting…" : "Submit correction"}
                    {!pending && (
                      <Icon
                        icon="mdi:arrow-right"
                        width={16}
                        height={16}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </div>
              </form>
            </section>
          )}

          <ReviewSidebar />
        </div>
      </div>
    </div>
  )
}
