"use client"

import { Icon } from "@iconify/react"
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
    <div className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-32 sm:px-8 lg:pt-12">
      <div className="max-w-[960px]">
        {/* Breadcrumb + draft status */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Contribute", href: "/contribute" },
              { label: "Edit a library", href: "/contribute/edit" },
              { label: library.name },
            ]}
          />
          <p
            aria-live="polite"
            className="m-0 inline-flex items-center gap-1.5 text-[14px]"
            style={{ color: T.ink.dim }}
          >
            {draftSavedAt && (
              <Icon
                icon="mdi:content-save-outline"
                width={16}
                height={16}
                aria-hidden="true"
              />
            )}
            {draftSavedAt
              ? `Draft saved ${formatSavedAt(draftSavedAt)} · ${changedCount} edit${changedCount !== 1 ? "s" : ""}`
              : `${changedCount} edit${changedCount !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* H1 */}
        <h1
          className="m-0 mb-3"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            fontSize: "clamp(2rem, 4.5vw, 3rem)",
            letterSpacing: "-0.01em",
            color: T.ink.base,
            lineHeight: 1.1,
          }}
        >
          Refine an{" "}
          <em style={{ fontStyle: "italic", color: T.accent.primary }}>
            existing record.
          </em>
        </h1>
        <p
          className="m-0 mb-7 max-w-[62ch] text-[16px] leading-[1.6]"
          style={{ color: T.ink.dim }}
        >
          Side-by-side: current published values on the left, your proposed
          changes on the right. Editorial reviews only what&apos;s actually
          changed.
        </p>

        {/* Status bar */}
        <div
          className="mb-8 grid grid-cols-1 overflow-hidden rounded-[20px] sm:grid-cols-2"
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.line}`,
          }}
        >
          <div className="px-5 py-3.5">
            <span className="text-[14px]" style={{ color: T.ink.dim }}>
              Currently published · Entity ref{" "}
              <span style={{ fontFamily: T.font.mono, color: T.ink.base }}>
                {library.entityRef || "—"}
              </span>
            </span>
          </div>
          <div className="border-(--t-divider) px-5 py-3.5 max-sm:border-t sm:border-l">
            <span
              className="inline-flex items-center gap-1.5 text-[14px]"
              style={{
                color: changedCount > 0 ? T.accent.primary : T.ink.dim,
                fontWeight: changedCount > 0 ? 600 : 400,
              }}
            >
              {changedCount > 0 && (
                <Icon
                  icon="mdi:pencil"
                  width={14}
                  height={14}
                  aria-hidden="true"
                />
              )}
              Your proposed edits · {changedCount} field
              {changedCount !== 1 ? "s" : ""} changed
            </span>
          </div>
        </div>

        {/* Column headers */}
        <div
          aria-hidden="true"
          className="mb-2.5 hidden grid-cols-2 gap-3 px-1 sm:grid"
        >
          <span
            className="text-[14px] font-semibold"
            style={{ color: T.ink.dim }}
          >
            Current value
          </span>
          <span
            className="text-[14px] font-semibold"
            style={{ color: T.ink.dim }}
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
      </div>

      {/* Sticky footer bar */}
      <div
        className="sticky z-10 mt-10 py-3"
        style={{
          bottom: "60px",
          background: T.bg.void,
          borderTop: `1px solid ${T.border.line}`,
        }}
      >
        <div className="flex max-w-[960px] flex-wrap items-center justify-between gap-3">
          {/* Left: stats */}
          <span className="text-[14px]" style={{ color: T.ink.dim }}>
            {changedCount} changed · Estimated review time: ~4h (verified)
          </span>

          {/* Right: action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDiscard}
              className="rounded-full px-3 py-2.5 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-muted-2)"
              style={{ color: T.accent.danger, background: "transparent" }}
            >
              Discard changes
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              className="rounded-full px-5 py-2.5 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-muted-2)"
              style={{
                color: T.ink.base,
                background: T.bg.deep,
                border: `1px solid ${T.border.hi}`,
              }}
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || changedCount === 0}
              className={`${primaryCtaSm} disabled:cursor-not-allowed disabled:opacity-45`}
            >
              {isPending ? "Submitting…" : "Submit for review"}
              {!isPending && (
                <Icon
                  icon="mdi:arrow-right"
                  width={16}
                  height={16}
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
