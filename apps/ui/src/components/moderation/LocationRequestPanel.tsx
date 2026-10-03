"use client"

import { Icon } from "@iconify/react"
import { useId, useState } from "react"

import { T } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"

import { KeyValueList } from "./KeyValueList"
import { decisionErrorMessage } from "./submissionMeta"

const SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-5 py-2.5 text-[15px] font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-60"

const INPUT =
  "w-full rounded-[14px] px-4 py-3 text-[16px] disabled:cursor-not-allowed disabled:opacity-60"

const NAME_MIN = 2
const NAME_MAX = 120
const TYPE_LABEL_MAX = 60

/** A parent place, resolved on the server: its name and public page. */
export type PlaceLabel = { name: string | null; href: string | null }

const asRecord = (v: unknown) =>
  (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<
    string,
    unknown
  >
const textOf = (v: unknown) => (typeof v === "string" ? v.trim() : "")

function ParentLink({
  label,
  place,
}: {
  readonly label: string
  readonly place: PlaceLabel | null
}) {
  const name = place?.name ?? "Not found"

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[13px] font-semibold" style={{ color: T.ink.dim }}>
        {label}
      </span>
      {place?.href ? (
        <Link
          href={place.href}
          className="text-[15px] font-semibold underline-offset-2 hover:underline"
          style={{ color: T.accent.primary }}
        >
          {name}
        </Link>
      ) : (
        <span
          className="text-[15px]"
          style={{ color: place?.name ? T.ink.base : T.ink.faint }}
        >
          {name}
        </span>
      )}
    </div>
  )
}

/**
 * A Location Request: the missing region or area, where it would go and
 * the contributor's evidence. While it is open the Moderator can correct
 * the name and type before approving (Strapi's `target` route, stored as
 * `draftData.moderatorEdit`); approval creates the place, published.
 */
export function LocationRequestPanel({
  documentId,
  status,
  fields: rawFields,
  draftData,
  country,
  region,
}: {
  readonly documentId: string
  readonly status: string
  readonly fields: Record<string, unknown> | null
  readonly draftData: Record<string, unknown> | null
  readonly country: PlaceLabel | null
  readonly region: PlaceLabel | null
}) {
  const id = useId()
  const router = useRouter()
  const fields = asRecord(rawFields)
  const edit = asRecord(asRecord(draftData).moderatorEdit)
  const isArea = fields.kind === "area"
  const noun = isArea ? "area" : "region"
  const editable = status === "pending" || status === "needs_info"
  const requestedName = textOf(fields.name)
  const requestedType = textOf(fields.typeLabel)
  const [name, setName] = useState(textOf(edit.name) || requestedName)
  const [typeLabel, setTypeLabel] = useState(
    typeof edit.typeLabel === "string" ? edit.typeLabel : requestedType
  )
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  )

  async function save() {
    const n = name.trim()
    const t = typeLabel.trim()
    if (n.length < NAME_MIN || n.length > NAME_MAX) {
      setMessage({
        ok: false,
        text: `Give the place a name of ${NAME_MIN} to ${NAME_MAX} characters.`,
      })

      return
    }
    if (t.length > TYPE_LABEL_MAX) {
      setMessage({
        ok: false,
        text: `Keep the type to ${TYPE_LABEL_MAX} characters or fewer.`,
      })

      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/moderation/submissions/${encodeURIComponent(documentId)}/target`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: n, typeLabel: t }),
        }
      )
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        setMessage({ ok: false, text: decisionErrorMessage(res.status, body) })

        return
      }
      setMessage({
        ok: true,
        text: "Saved. The place is created with this name when you approve.",
      })
      router.refresh()
    } catch {
      setMessage({
        ok: false,
        text: "Something went wrong. Check your connection and try again.",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <KeyValueList
        rows={[
          { label: "Asks for", value: isArea ? "A new area" : "A new region" },
          { label: "Name", value: requestedName },
          { label: "Type", value: requestedType },
          { label: "Evidence link", value: textOf(fields.evidenceUrl) },
          { label: "Note", value: textOf(fields.note) },
        ].filter((r) => r.value)}
      />

      <div className="flex flex-col gap-2">
        <h3
          className="m-0 text-[14px] font-semibold"
          style={{ color: T.ink.dim }}
        >
          Where it goes in the atlas
        </h3>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <ParentLink label="Country" place={country} />
          {isArea ? <ParentLink label="Region" place={region} /> : null}
        </div>
      </div>

      <fieldset
        className="m-0 flex flex-col gap-3 rounded-[14px] p-4"
        style={{
          border: `1px solid ${T.border.line}`,
          background: T.bg.surface,
        }}
        disabled={!editable || busy}
      >
        <legend
          className="px-1 text-[15px] font-semibold"
          style={{ color: T.ink.base }}
        >
          {`The ${noun} as it will be created`}
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${id}-name`}
              className="text-[14px] font-semibold"
              style={{ color: T.ink.base }}
            >
              Name
            </label>
            <input
              id={`${id}-name`}
              value={name}
              maxLength={NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              className={INPUT}
              style={{
                border: `1px solid ${T.border.hi}`,
                background: T.bg.deep,
                color: T.ink.base,
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${id}-type`}
              className="text-[14px] font-semibold"
              style={{ color: T.ink.base }}
            >
              Type{" "}
              <span style={{ color: T.ink.faint, fontWeight: 400 }}>
                (optional)
              </span>
            </label>
            <input
              id={`${id}-type`}
              value={typeLabel}
              maxLength={TYPE_LABEL_MAX}
              onChange={(e) => setTypeLabel(e.target.value)}
              className={INPUT}
              style={{
                border: `1px solid ${T.border.hi}`,
                background: T.bg.deep,
                color: T.ink.base,
              }}
            />
          </div>
        </div>
        {editable ? (
          <button
            type="button"
            className={`${SECONDARY} self-start`}
            style={{ color: T.ink.base }}
            onClick={() => void save()}
          >
            {busy ? "Saving…" : "Save name and type"}
          </button>
        ) : null}
        <p
          aria-live="polite"
          role={message && !message.ok ? "alert" : undefined}
          className="m-0 flex items-center gap-1.5 text-[14px]"
          style={{ color: message?.ok ? T.accent.ok : T.accent.danger }}
        >
          {message ? (
            <Icon
              aria-hidden="true"
              icon={
                message.ok
                  ? "mdi:check-circle-outline"
                  : "mdi:alert-circle-outline"
              }
              width={16}
              height={16}
            />
          ) : null}
          {message?.text}
        </p>
      </fieldset>
    </div>
  )
}
