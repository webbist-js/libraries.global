"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"

import { Breadcrumb } from "@/components/ds/Breadcrumb"
import { useCreateSubmission } from "@/hooks/useSubmissions"
import { T } from "@/lib/design-tokens"
import { primaryCtaSm } from "@/lib/styles"

import { DiffFieldRow } from "./DiffFieldRow"
import { EditSourcesSection } from "./EditSourcesSection"

type LibrarySafe = {
  documentId: string
  slug: string
  name: string
  entityRef: string
  city: string
  libraryType: string
  catalogueUrl: string
  website: string
  foundedYear: string
  architect: string
  description: string
  lat: string
  lng: string
}

type DraftStore = {
  editedFields: Partial<LibrarySafe>
  savedAt: string
}

const EDITABLE_FIELDS: { key: keyof LibrarySafe; label: string }[] = [
  { key: "catalogueUrl", label: "Catalogue URL" },
  { key: "website", label: "Website URL" },
  { key: "foundedYear", label: "Founded year" },
  { key: "architect", label: "Architect" },
]

function formatSavedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function loadDraft(slug: string): DraftStore | null {
  try {
    const raw = localStorage.getItem(`edit_draft_${slug}`)
    if (!raw) return null

    return JSON.parse(raw) as DraftStore
  } catch {
    return null
  }
}

interface EditLibraryDiffProps {
  library: LibrarySafe
}

export function EditLibraryDiff({ library }: EditLibraryDiffProps) {
  const router = useRouter()
  const { mutateAsync: createSubmission, isPending } = useCreateSubmission()

  // Lazy initializers read localStorage once on mount — no synchronous setState in effects
  const [editedFields, setEditedFields] = useState<Partial<LibrarySafe>>(() => {
    const draft = loadDraft(library.slug)

    return draft?.editedFields ?? {}
  })
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(() => {
    const draft = loadDraft(library.slug)

    return draft?.savedAt ?? null
  })
  const [evidenceTypes, setEvidenceTypes] = useState<string[]>([])
  const [sourceUrl, setSourceUrl] = useState("")

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-save to localStorage (debounced 1500ms)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (Object.keys(editedFields).length === 0) return
    saveTimerRef.current = setTimeout(() => {
      const savedAt = new Date().toISOString()
      localStorage.setItem(
        `edit_draft_${library.slug}`,
        JSON.stringify({ editedFields, savedAt })
      )
      setDraftSavedAt(savedAt)
    }, 1500)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [editedFields, library.slug])

  const changedCount = Object.keys(editedFields).length

  const getValue = useCallback(
    (key: keyof LibrarySafe) =>
      key in editedFields ? (editedFields[key] ?? "") : (library[key] ?? ""),
    [editedFields, library]
  )

  function handleFieldChange(key: keyof LibrarySafe, val: string) {
    setEditedFields((prev) => {
      const next = { ...prev, [key]: val }
      // If the user resets to the original value, remove from editedFields
      if (val === (library[key] ?? "")) {
        delete next[key]
      }

      return next
    })
  }

  function handleSaveDraft() {
    const savedAt = new Date().toISOString()
    localStorage.setItem(
      `edit_draft_${library.slug}`,
      JSON.stringify({ editedFields, savedAt })
    )
    setDraftSavedAt(savedAt)
    toast.success("Draft saved.")
  }

  function handleDiscard() {
    setEditedFields({})
    setEvidenceTypes([])
    setSourceUrl("")
    localStorage.removeItem(`edit_draft_${library.slug}`)
    setDraftSavedAt(null)
    toast("Changes discarded.")
  }

  async function handleSubmit() {
    if (changedCount === 0) {
      toast.error("No changes to submit.")

      return
    }
    try {
      await createSubmission({
        submissionType: "library_edit",
        targetDocumentId: library.documentId,
        targetSlug: library.slug,
        fields: editedFields as Record<string, unknown>,
        note: [
          `${changedCount} fields changed`,
          evidenceTypes.length > 0
            ? `Evidence: ${evidenceTypes.join(", ")}`
            : null,
          sourceUrl ? `Source: ${sourceUrl}` : null,
        ]
          .filter(Boolean)
          .join(". "),
      })
      localStorage.removeItem(`edit_draft_${library.slug}`)
      toast.success("Submitted for review!")
      router.push("/contribute/submissions")
    } catch {
      toast.error("Submission failed. Please try again.")
    }
  }

  return (
    <div
      style={{
        maxWidth: "896px",
        margin: "0 auto",
        padding: "48px 24px 120px",
      }}
    >
      {/* Breadcrumb + draft status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Contribute", href: "/contribute" },
            { label: "Edit a library", href: "/contribute/edit" },
            { label: library.name },
          ]}
        />
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.ink.faint,
            margin: 0,
          }}
        >
          {draftSavedAt
            ? `Draft saved ${formatSavedAt(draftSavedAt)} · ${changedCount} edit${changedCount !== 1 ? "s" : ""}`
            : `${changedCount} edit${changedCount !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* H1 */}
      <h1
        style={{
          fontFamily: T.font.serif,
          fontWeight: 700,
          fontSize: "clamp(2rem, 5vw, 3.5rem)",
          color: T.ink.base,
          margin: "0 0 12px",
          lineHeight: 1.1,
        }}
      >
        Refine an <em>existing record.</em>
      </h1>
      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "14px",
          color: T.ink.dim,
          marginBottom: "28px",
          lineHeight: 1.6,
          maxWidth: "560px",
        }}
      >
        Side-by-side: current published values on the left, your proposed
        changes on the right. Editorial reviews only what&apos;s actually
        changed.
      </p>

      {/* Status bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1px",
          border: `1px solid ${T.border.line}`,
          borderRadius: "10px",
          overflow: "hidden",
          marginBottom: "32px",
          background: T.border.line,
        }}
      >
        <div style={{ padding: "12px 16px", background: T.bg.deep }}>
          <span
            style={{
              fontFamily: T.font.sans,
              fontSize: "13px",
              color: T.ink.faint,
            }}
          >
            Currently published · Entity ref {library.entityRef || "—"} · v.4.2
            · 12 Apr 2026
          </span>
        </div>
        <div style={{ padding: "12px 16px", background: T.bg.deep }}>
          <span
            style={{
              fontFamily: T.font.sans,
              fontSize: "13px",
              color: changedCount > 0 ? T.accent.aurora : T.ink.faint,
            }}
          >
            Your proposed edits · {changedCount} field
            {changedCount !== 1 ? "s" : ""} changed
          </span>
        </div>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginBottom: "10px",
          paddingLeft: "4px",
        }}
      >
        <span
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.ink.faint,
          }}
        >
          Current value
        </span>
        <span
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.ink.faint,
          }}
        >
          Your proposed change
        </span>
      </div>

      {/* Diff field rows */}
      {EDITABLE_FIELDS.map((field) => (
        <DiffFieldRow
          key={field.key}
          fieldKey={field.key}
          label={field.label}
          currentValue={library[field.key] ?? ""}
          proposedValue={getValue(field.key)}
          onChange={(val) => handleFieldChange(field.key, val)}
        />
      ))}

      {/* Evidence / sources section */}
      <EditSourcesSection
        evidenceType={evidenceTypes}
        evidenceUrl={sourceUrl}
        onChange={(types, url) => {
          setEvidenceTypes(types)
          setSourceUrl(url)
        }}
      />

      {/* Sticky footer bar */}
      <div
        style={{
          position: "sticky",
          bottom: "60px",
          background: T.bg.void,
          borderTop: `1px solid ${T.border.line}`,
          padding: "12px 0",
          zIndex: 10,
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ maxWidth: "896px", margin: "0 auto", padding: "0 24px" }}
        >
          {/* Left: stats */}
          <span
            style={{
              fontFamily: T.font.sans,
              fontSize: "13px",
              color: T.ink.faint,
            }}
          >
            {changedCount} changed · Estimated review time: ~4h (verified)
          </span>

          {/* Right: action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleDiscard}
              style={{
                fontFamily: T.font.sans,
                fontSize: "13px",
                color: T.accent.danger,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "8px 4px",
              }}
            >
              Discard changes
            </button>
            <button
              onClick={handleSaveDraft}
              style={{
                fontFamily: T.font.sans,
                fontSize: "13px",
                color: T.ink.dim,
                background: "transparent",
                border: `1px solid ${T.border.hi}`,
                borderRadius: "10px",
                cursor: "pointer",
                padding: "8px 16px",
              }}
            >
              Save draft
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending || changedCount === 0}
              className={primaryCtaSm}
              style={{
                opacity: isPending || changedCount === 0 ? 0.5 : 1,
                cursor:
                  isPending || changedCount === 0 ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? "Submitting…" : "Submit for review →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
