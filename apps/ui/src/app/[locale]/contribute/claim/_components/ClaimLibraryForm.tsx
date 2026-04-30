"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { DotHeroCanvas } from "@/components/ui/DotHeroCanvas"
import { useCreateSubmission } from "@/hooks/useSubmissions"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { auroraCtaSm } from "@/lib/styles"

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
  width: "100%",
  padding: "10px 14px",
  borderRadius: "8px",
  border: `1px solid ${T.border.hi}`,
  background: "rgba(255,255,255,0.03)",
  color: T.ink.base,
  fontSize: "14px",
  fontFamily: "inherit",
  outline: "none",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238e8ea9' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  boxSizing: "border-box",
  cursor: "pointer",
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "8px",
  border: `1px solid ${T.border.hi}`,
  background: "rgba(255,255,255,0.03)",
  color: T.ink.base,
  fontSize: "14px",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
}

const labelStyle: React.CSSProperties = {
  fontFamily: T.font.mono,
  fontSize: "10px",
  letterSpacing: ".14em",
  textTransform: "uppercase",
  color: T.ink.faint,
  display: "block",
  marginBottom: "6px",
}

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

  return (
    <>
      {/* ── Hero ── */}
      <section
        data-transparent-header=""
        style={{
          position: "relative",
          background: T.bg.void,
          borderBottom: `1px solid ${T.border.line}`,
          overflow: "hidden",
        }}
        className="-mt-14"
      >
        <DotHeroCanvas />

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(3,5,17,0) 0%, rgba(3,5,17,0.65) 100%)",
          }}
        />

        <div
          className="relative z-10 mx-auto w-full max-w-[900px]"
          style={{ padding: "110px 24px 44px" }}
        >
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".20em",
              textTransform: "uppercase",
              color: T.ink.faint,
              margin: "0 0 22px",
            }}
          >
            <Link
              href="/contribute"
              style={{ color: T.ink.faint, textDecoration: "none" }}
              className="transition-colors hover:text-white/60"
            >
              Contribute
            </Link>
            <span style={{ margin: "0 8px", opacity: 0.4 }}>/</span>
            <span style={{ color: T.ink.low }}>Claim a library</span>
          </p>

          <h1
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(2.6rem, 5vw, 4rem)",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 0.95,
              color: T.ink.base,
              margin: "0 0 18px",
            }}
          >
            Claim{" "}
            <em
              style={{
                fontStyle: "italic",
                fontWeight: 400,
                color: T.accent.aurora,
              }}
            >
              {libraryName}.
            </em>
          </h1>

          <p
            style={{
              fontFamily: T.font.sans,
              fontSize: "15px",
              color: T.ink.dim,
              maxWidth: "52ch",
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            Tell us your role at this institution. A moderator will verify and
            approve your claim before you can submit edits on behalf of this
            library.
          </p>
        </div>
      </section>

      {/* ── Form body ── */}
      <div
        style={{
          background: T.bg.space,
          minHeight: "60vh",
        }}
      >
        <div
          className="mx-auto w-full max-w-[900px]"
          style={{ padding: "48px 24px 80px" }}
        >
          <div style={{ maxWidth: "600px" }}>
            {/* Info callout */}
            <div
              style={{
                border: `1px solid rgba(127,223,255,0.18)`,
                borderRadius: "12px",
                padding: "18px 22px",
                background: "rgba(127,223,255,0.04)",
                marginBottom: "32px",
              }}
            >
              <p
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".18em",
                  textTransform: "uppercase",
                  color: T.accent.aurora,
                  margin: "0 0 8px",
                }}
              >
                What happens next
              </p>
              <p
                style={{
                  fontFamily: T.font.sans,
                  fontSize: "13px",
                  color: T.ink.dim,
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                Your claim is reviewed within 2–5 days. If approved, you become
                a verified librarian for{" "}
                <strong style={{ color: T.ink.base, fontWeight: 600 }}>
                  {libraryName}
                </strong>{" "}
                and can submit edits that bypass the standard review queue.
              </p>
            </div>

            {/* Role + Department row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px",
                marginBottom: "16px",
              }}
            >
              <div>
                <label htmlFor="claim-role" style={labelStyle}>
                  Your role <span style={{ color: T.accent.danger }}>*</span>
                </label>
                <select
                  id="claim-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={selectStyle}
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option
                      key={o.value}
                      value={o.value}
                      style={{ background: "#050816" }}
                    >
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="claim-department" style={labelStyle}>
                  Department
                </label>
                <input
                  id="claim-department"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Special Collections"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Verification note */}
            <div style={{ marginBottom: "24px" }}>
              <label htmlFor="claim-note" style={labelStyle}>
                Verification details{" "}
                <span style={{ color: T.accent.danger }}>*</span>
              </label>
              <textarea
                id="claim-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Your institutional email, staff ID, or any details that will help our moderators confirm your affiliation with this library…"
                rows={5}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  lineHeight: 1.6,
                }}
              />
              <p
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".08em",
                  color:
                    note.trim().length < 10 && note.length > 0
                      ? T.accent.warn
                      : T.ink.faint,
                  margin: "6px 0 0",
                }}
              >
                {note.trim().length < 10
                  ? `${10 - note.trim().length} more characters required`
                  : `${note.trim().length} characters`}
              </p>
            </div>

            {/* Divider */}
            <div
              style={{
                borderTop: `1px solid ${T.border.line}`,
                margin: "0 0 24px",
              }}
            />

            {/* Actions */}
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button
                disabled={!canSubmit}
                onClick={handleSubmit}
                className={auroraCtaSm}
                style={{
                  border: "none",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  opacity: canSubmit ? 1 : 0.45,
                }}
              >
                {isPending ? "Submitting…" : "Submit claim →"}
              </button>
              <button
                onClick={() => router.back()}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: `1px solid ${T.border.hi}`,
                  background: "transparent",
                  color: T.ink.dim,
                  fontSize: "13px",
                  fontFamily: T.font.sans,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
