"use client"

import { useTranslations } from "next-intl"
import { useState, type FormEvent } from "react"

import { SelectField } from "@/components/ds/SelectField"
import { RequiredTag } from "@/components/library-editor/WizardFields"
import { STAFF_FIELD } from "@/components/staff/StaffPanel"
import { Button } from "@/components/ui/button"
import { useCreateSubmission } from "@/hooks/useSubmissions"
import type { ClaimLibrary } from "@/lib/library-claim"

const ROLES = [
  "librarian",
  "head_librarian",
  "archivist",
  "cataloguer",
  "systems_administrator",
  "volunteer",
  "researcher",
  "other",
] as const

/** One form and one moderated submission contract for Contribute and Staff. */
export function LibraryClaimForm({
  library,
  onSuccess,
  onPendingChange,
}: {
  readonly library: ClaimLibrary
  readonly onSuccess: () => void
  readonly onPendingChange: (pending: boolean) => void
}) {
  const t = useTranslations("libraryClaim")
  const [role, setRole] = useState("")
  const [department, setDepartment] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const { mutate, isPending } = useCreateSubmission()
  const pending = isPending || sending
  const canSubmit = Boolean(role) && note.trim().length >= 10 && !pending
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    setError("")
    setSending(true)
    onPendingChange(true)
    mutate(
      {
        submissionType: "library_claim",
        targetEntityType: "library",
        targetDocumentId: library.libraryDocumentId,
        targetSlug: library.librarySlug,
        note: note.trim(),
        fields: {
          name: library.libraryName,
          ...(library.libraryEntityRef
            ? { entityRef: library.libraryEntityRef }
            : {}),
          role,
          department: department.trim() || undefined,
          verificationMethod: "contact_us",
        },
      },
      {
        onSuccess,
        onError: (err) => {
          setSending(false)
          onPendingChange(false)
          setError(err?.message || t("failed"))
        },
      }
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6"
      aria-label={t("affiliation")}
      aria-busy={pending}
    >
      <div>
        <h3 className="type-h3 m-0">{t("affiliation")}</h3>
        <p
          id="claim-private"
          className="mt-2 mb-0 text-base leading-relaxed text-(--t-ink-dim)"
        >
          {t("private")}
        </p>
      </div>
      <fieldset
        disabled={pending}
        className="m-0 grid min-w-0 gap-6 border-0 p-0"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="claim-role"
              className="mb-2 flex flex-wrap items-baseline gap-x-2 text-base font-semibold"
            >
              {t("role")} <RequiredTag />
            </label>
            <SelectField
              id="claim-role"
              required
              value={String(role ?? "")}
              onValueChange={(selectedValue) => setRole(selectedValue)}
              className={STAFF_FIELD}
              options={[
                { value: "", label: String(t("chooseRole")) },
                ...ROLES.map((value) => ({
                  value: String(value),
                  label: String(t(`roles.${value}`)),
                })),
              ]}
            />
          </div>
          <div>
            <label
              htmlFor="claim-department"
              className="mb-2 block text-base font-semibold"
            >
              {t("department")}
            </label>
            <input
              id="claim-department"
              value={department}
              maxLength={200}
              onChange={(e) => setDepartment(e.target.value)}
              className={STAFF_FIELD}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="claim-note"
            className="mb-2 flex flex-wrap items-baseline gap-x-2 text-base font-semibold"
          >
            {t("verification")} <RequiredTag />
          </label>
          <textarea
            id="claim-note"
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("placeholder")}
            aria-describedby="claim-private claim-note-hint"
            className={STAFF_FIELD + " resize-y"}
          />
          <p
            id="claim-note-hint"
            className="mt-2 mb-0 text-sm leading-relaxed text-(--t-ink-dim)"
          >
            {t("noteHint")}
          </p>
        </div>
      </fieldset>
      {error ? (
        <p
          role="alert"
          className="m-0 rounded-xl bg-(--t-bg-surface) p-4 text-base"
        >
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-4 border-t border-(--t-border-line) pt-5">
        <Button
          type="submit"
          variant="primary"
          size="pill"
          disabled={!canSubmit}
        >
          {pending ? t("sending") : t("submit")}
        </Button>
        <span className="text-sm text-(--t-ink-dim)">
          {t("noInstantAccess")}
        </span>
      </div>
    </form>
  )
}
