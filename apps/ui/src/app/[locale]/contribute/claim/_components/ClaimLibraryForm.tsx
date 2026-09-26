"use client"

import { Icon } from "@iconify/react"
import { useRouter } from "next/navigation"
import type React from "react"
import { useState } from "react"
import { toast } from "sonner"

import { useCreateSubmission } from "@/hooks/useSubmissions"
import { T } from "@/lib/design-tokens"
import { primaryCtaSm } from "@/lib/styles"

import { ContributeSectionHeader } from "../../_components/ContributeSectionHeader"
import {
  fieldHintStyle,
  fieldInputStyle,
  fieldLabelStyle,
} from "../../add/_components/wizard.constants"
import { RequiredTag } from "../../add/_components/WizardFields"

interface ClaimLibraryFormProps {
  libraryDocumentId: string
  librarySlug: string
  libraryName: string
  libraryEntityRef?: string
}

const ROLE_OPTIONS = [
  { value: "", label: "Select your role…" },
  { value: "librarian", label: "Librarian" },
  { value: "head_librarian", label: "Head Librarian / Director" },
  { value: "archivist", label: "Archivist" },
  { value: "cataloguer", label: "Cataloguer" },
  { value: "systems_administrator", label: "Systems Administrator" },
  { value: "volunteer", label: "Volunteer" },
  { value: "researcher", label: "Researcher / Academic" },
  { value: "other", label: "Other" },
]

const selectStyle: React.CSSProperties = {
  ...fieldInputStyle,
  appearance: "none",
  cursor: "pointer",
  paddingRight: "44px",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2355536A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 16px center",
}

const NEXT_STEPS = [
  {
    icon: "mdi:send-outline",
    copy: "Your claim goes to a moderator with the details you give here.",
  },
  {
    icon: "mdi:clock-outline",
    copy: "They check your affiliation, usually within 2–5 days.",
  },
  {
    icon: "mdi:check-decagram-outline",
    copy: "Once approved, you're a verified librarian for this record.",
  },
] as const

export function ClaimLibraryForm({
  libraryDocumentId,
  librarySlug,
  libraryName,
  libraryEntityRef,
}: ClaimLibraryFormProps) {
  const router = useRouter()
  const [role, setRole] = useState("")
  const [department, setDepartment] = useState("")
  const [note, setNote] = useState("")
  const { mutate, isPending } = useCreateSubmission()

  const handleSubmit = () => {
    mutate(
      {
        submissionType: "library_claim",
        targetEntityType: "library",
        targetDocumentId: libraryDocumentId,
        targetSlug: librarySlug,
        note,
        fields: {
          name: libraryName,
          ...(libraryEntityRef ? { entityRef: libraryEntityRef } : {}),
          role: role || undefined,
          department: department || undefined,
          verificationMethod: "contact_us",
        },
      },
      {
        onSuccess: () => {
          toast.success("Claim submitted — a moderator will review it shortly.")
          router.push("/contribute/submissions")
        },
        onError: (err) => toast.error(err?.message ?? "Submission failed"),
      }
    )
  }

  const canSubmit = note.trim().length >= 10 && !isPending
  const noteTooShort = note.trim().length < 10 && note.length > 0

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        compact
        section="Claim a library"
        title={`Claim *${libraryName}.*`}
        lead="Tell us your role at this institution. A moderator will verify and approve your claim before you can submit edits on behalf of this library."
      />

      <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8 lg:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          {/* ── Form card ── */}
          <section
            aria-labelledby="claim-form-heading"
            className="min-w-0 rounded-[20px] p-6 sm:p-8"
            style={{
              background: T.bg.deep,
              border: `1px solid ${T.border.line}`,
            }}
          >
            <h2
              id="claim-form-heading"
              className="m-0"
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(24px,2.6vw,28px)",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                color: T.ink.base,
              }}
            >
              Your affiliation
            </h2>
            <p
              className="mt-2 mb-6 max-w-[62ch] text-[15px] leading-[1.6]"
              style={{ color: T.ink.dim }}
            >
              Details here are only seen by the moderators reviewing your claim.
            </p>

            <div className="flex flex-col gap-6">
              {/* Role + Department row */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="claim-role" style={fieldLabelStyle}>
                    Your role
                    <RequiredTag />
                  </label>
                  <select
                    id="claim-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    aria-required="true"
                    style={{
                      ...selectStyle,
                      color: role ? T.ink.base : T.ink.dim,
                    }}
                  >
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="claim-department" style={fieldLabelStyle}>
                    Department
                  </label>
                  <input
                    id="claim-department"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Special Collections"
                    style={fieldInputStyle}
                  />
                </div>
              </div>

              {/* Verification note */}
              <div className="flex flex-col gap-2">
                <label htmlFor="claim-note" style={fieldLabelStyle}>
                  Verification details
                  <RequiredTag />
                </label>
                <textarea
                  id="claim-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Your institutional email, staff ID, or any details that will help our moderators confirm your affiliation with this library…"
                  rows={5}
                  aria-required="true"
                  aria-describedby="claim-note-count"
                  aria-invalid={noteTooShort || undefined}
                  style={{
                    ...fieldInputStyle,
                    resize: "vertical",
                    lineHeight: 1.6,
                  }}
                />
                <p
                  id="claim-note-count"
                  aria-live="polite"
                  className="flex items-center gap-1.5"
                  style={{
                    ...fieldHintStyle,
                    color: noteTooShort ? "var(--tint-special-fg)" : T.ink.dim,
                  }}
                >
                  {noteTooShort && (
                    <Icon
                      icon="mdi:alert-circle-outline"
                      width={16}
                      height={16}
                      aria-hidden="true"
                    />
                  )}
                  {note.trim().length < 10
                    ? `${10 - note.trim().length} more characters required`
                    : `${note.trim().length} characters`}
                </p>
              </div>

              {/* Actions */}
              <div
                className="flex flex-wrap items-center gap-3 pt-6"
                style={{ borderTop: `1px solid ${T.border.divider}` }}
              >
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                  className={`${primaryCtaSm} text-[15px] disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  {isPending ? "Submitting…" : "Submit claim"}
                  {!isPending && (
                    <Icon
                      icon="mdi:arrow-right"
                      width={16}
                      height={16}
                      aria-hidden="true"
                    />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="inline-flex items-center rounded-full px-5 py-2.5 text-[15px] font-semibold transition-colors hover:bg-(--t-bg-muted-2)"
                  style={{
                    background: T.bg.deep,
                    border: `1px solid ${T.border.hi}`,
                    color: T.ink.base,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>

          {/* ── Sidebar: what happens next ── */}
          <aside
            aria-labelledby="claim-next-heading"
            className="self-start rounded-[20px] p-6 lg:sticky lg:top-[128px]"
            style={{
              background: T.bg.deep,
              border: `1px solid ${T.border.line}`,
            }}
          >
            <h2
              id="claim-next-heading"
              className="m-0"
              style={{
                fontFamily: T.font.serif,
                fontSize: "22px",
                fontWeight: 500,
                color: T.ink.base,
              }}
            >
              What happens next
            </h2>
            <ol className="mt-4 mb-0 flex list-none flex-col gap-4 p-0">
              {NEXT_STEPS.map((step) => (
                <li key={step.icon} className="flex items-start gap-3">
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: T.accent.chip,
                      color: T.accent.primary,
                    }}
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
              style={{
                color: T.ink.dim,
                borderTop: `1px solid ${T.border.divider}`,
              }}
            >
              If approved, you become a verified librarian for{" "}
              <strong style={{ color: T.ink.base, fontWeight: 600 }}>
                {libraryName}
              </strong>{" "}
              and can submit edits that bypass the standard review queue.
            </p>
          </aside>
        </div>
      </div>
    </div>
  )
}
