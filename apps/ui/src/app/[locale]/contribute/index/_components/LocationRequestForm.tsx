"use client"

import { Icon } from "@iconify/react"
import { findUnsafeContent } from "@repo/shared-data"
import { type FormEvent, useId, useState } from "react"

import { T } from "@/lib/design-tokens"

import { fieldInputStyle, fieldLabelStyle } from "./wizard.constants"

export type LocationRequestKind = "region" | "area"

export const LOCATION_REQUEST_SENT =
  "Thanks. A moderator will add it, and your library will be linked when both are approved."

const NAME_MIN = 2
const NAME_MAX = 120
const TYPE_LABEL_MAX = 60
const NOTE_MAX = 1000

const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-full bg-(--t-accent-primary) px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
const SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-5 py-2.5 text-[15px] font-semibold transition-colors hover:bg-(--t-bg-surface)"

function isHttpLink(v: string): boolean {
  try {
    const url = new URL(v)

    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export type LocationRequestInput = {
  kind: LocationRequestKind
  name: string
  typeLabel: string
  evidenceUrl: string
  note: string
  countryDocumentId: string
  regionDocumentId?: string
}

/**
 * The `fields` of a `location_request` (Strapi's rules), or what's wrong
 * with the input. Empty optional values are left out.
 */
export function locationRequestFields(
  input: LocationRequestInput
):
  | { ok: true; fields: Record<string, string> }
  | { ok: false; message: string } {
  const name = input.name.trim()
  const typeLabel = input.typeLabel.trim()
  const evidenceUrl = input.evidenceUrl.trim()
  const note = input.note.trim()
  if (name.length < NAME_MIN || name.length > NAME_MAX)
    return {
      ok: false,
      message: `Give the place a name of ${NAME_MIN} to ${NAME_MAX} characters.`,
    }
  if (typeLabel.length > TYPE_LABEL_MAX)
    return {
      ok: false,
      message: `Keep the type to ${TYPE_LABEL_MAX} characters or fewer.`,
    }
  if (!isHttpLink(evidenceUrl))
    return {
      ok: false,
      message:
        "Add a link that shows the place exists, starting with http or https.",
    }
  if (note.length > NOTE_MAX)
    return {
      ok: false,
      message: `Keep the note to ${NOTE_MAX} characters or fewer.`,
    }
  if (!input.countryDocumentId)
    return { ok: false, message: "Choose the country first." }
  if (input.kind === "area" && !input.regionDocumentId)
    return { ok: false, message: "Choose the region the area belongs to." }

  return {
    ok: true,
    fields: {
      kind: input.kind,
      name,
      ...(typeLabel ? { typeLabel } : {}),
      countryDocumentId: input.countryDocumentId,
      ...(input.kind === "area"
        ? { regionDocumentId: input.regionDocumentId! }
        : {}),
      ...(note ? { note } : {}),
      evidenceUrl,
    },
  }
}

async function readError(res: Response): Promise<string> {
  const fallback = "Couldn’t send your request. Please try again."
  try {
    const json = (await res.json()) as { error?: { message?: string } | string }
    if (typeof json.error === "string") return json.error

    return json.error?.message ?? fallback
  } catch {
    return fallback
  }
}

/**
 * Asks for a missing Region or Area (a `location_request`) under the
 * selected country (and, for an area, region). Shown inline under the
 * Region and Area selects; on success `onCreated` stores the proposal on
 * the wizard form so the `new_library` submission carries it.
 */
export function LocationRequestForm({
  kind,
  countryDocumentId,
  regionDocumentId,
  parentName,
  onCreated,
  onCancel,
}: {
  readonly kind: LocationRequestKind
  readonly countryDocumentId: string
  readonly regionDocumentId?: string
  /** The selected country or region, for the heading. */
  readonly parentName?: string
  readonly onCreated: (request: { documentId: string; name: string }) => void
  readonly onCancel: () => void
}) {
  const id = useId()
  const [name, setName] = useState("")
  const [typeLabel, setTypeLabel] = useState("")
  const [evidenceUrl, setEvidenceUrl] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const noun = kind === "region" ? "region" : "area"

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (sending) return
    const built = locationRequestFields({
      kind,
      name,
      typeLabel,
      evidenceUrl,
      note,
      countryDocumentId,
      regionDocumentId,
    })
    if (!built.ok) {
      setError(built.message)

      return
    }
    const unsafe = findUnsafeContent(built.fields)
    if (unsafe) {
      setError(unsafe.message)

      return
    }
    setError(null)
    setSending(true)
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionType: "location_request",
          targetEntityType: kind,
          fields: built.fields,
        }),
      })
      if (!res.ok) {
        setError(await readError(res))

        return
      }
      const json = (await res.json().catch(() => ({}))) as {
        data?: { documentId?: string }
      }
      const documentId = json.data?.documentId
      if (!documentId) {
        setError("Couldn’t send your request. Please try again.")

        return
      }
      onCreated({ documentId, name: built.fields.name! })
    } catch {
      setError("Couldn’t send your request. Please try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      aria-label={`Ask for a missing ${noun}`}
      className="flex flex-col gap-3 rounded-[14px] p-4"
      style={{ border: `1px solid ${T.border.line}`, background: T.bg.surface }}
      noValidate
    >
      <p
        className="m-0 text-[15px] font-semibold"
        style={{ color: T.ink.base, fontFamily: T.font.sans }}
      >
        {`Ask for a missing ${noun}${parentName ? ` in ${parentName}` : ""}`}
      </p>
      <div className="flex flex-col gap-1.5">
        <label style={fieldLabelStyle} htmlFor={`${id}-name`}>
          Name
        </label>
        <input
          id={`${id}-name`}
          value={name}
          maxLength={NAME_MAX}
          required
          onChange={(e) => setName(e.target.value)}
          style={fieldInputStyle}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label style={fieldLabelStyle} htmlFor={`${id}-type`}>
          Type{" "}
          <span style={{ color: T.ink.faint, fontWeight: 400 }}>
            (optional, for example County or Borough)
          </span>
        </label>
        <input
          id={`${id}-type`}
          value={typeLabel}
          maxLength={TYPE_LABEL_MAX}
          onChange={(e) => setTypeLabel(e.target.value)}
          style={fieldInputStyle}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label style={fieldLabelStyle} htmlFor={`${id}-evidence`}>
          Evidence link
        </label>
        <input
          id={`${id}-evidence`}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={evidenceUrl}
          required
          onChange={(e) => setEvidenceUrl(e.target.value)}
          style={fieldInputStyle}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label style={fieldLabelStyle} htmlFor={`${id}-note`}>
          Note{" "}
          <span style={{ color: T.ink.faint, fontWeight: 400 }}>
            (optional)
          </span>
        </label>
        <textarea
          id={`${id}-note`}
          value={note}
          maxLength={NOTE_MAX}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
          style={{ ...fieldInputStyle, minHeight: "88px" }}
        />
      </div>
      {error ? (
        <p
          role="alert"
          className="m-0 flex items-center gap-1.5 text-[14px]"
          style={{ color: T.accent.danger }}
        >
          <Icon
            aria-hidden="true"
            icon="mdi:alert-circle-outline"
            width={16}
            height={16}
          />
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={PRIMARY} disabled={sending}>
          {sending ? "Sending…" : `Ask for this ${noun}`}
        </button>
        <button
          type="button"
          className={SECONDARY}
          style={{ color: T.ink.base }}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
