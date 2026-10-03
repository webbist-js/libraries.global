"use client"

import { useId, useState } from "react"

import { Badge, EmptyState } from "@/components/ds"
import { T } from "@/lib/design-tokens"

import {
  decisionErrorMessage,
  humanise,
  type OptionSuggestion,
} from "./submissionMeta"

const PRIMARY =
  "inline-flex items-center justify-center rounded-full bg-(--t-accent-primary) px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
const SECONDARY =
  "inline-flex items-center justify-center rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-4 py-2 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-60"

const inputStyle: React.CSSProperties = {
  borderColor: T.border.hi,
  background: T.bg.deep,
  color: T.ink.base,
  fontFamily: T.font.sans,
}

function SuggestionCard({
  s,
  onDecided,
}: {
  s: OptionSuggestion
  onDecided: (id: string, text: string) => void
}) {
  const nameId = useId()
  const noteId = useId()
  const [name, setName] = useState(s.name)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(decision: "accept" | "decline") {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/moderation/option-suggestions/${encodeURIComponent(s.documentId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            ...(decision === "accept" && name.trim() && name.trim() !== s.name
              ? { name: name.trim() }
              : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
          }),
        }
      )
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        setError(decisionErrorMessage(res.status, body))

        return
      }
      onDecided(
        s.documentId,
        `${decision === "accept" ? "Accepted" : "Declined"} “${s.name}”.`
      )
    } catch {
      setError("Something went wrong. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <li
      className="flex flex-col gap-4 rounded-[20px] p-5"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2
          className="m-0 text-[22px]"
          style={{
            fontFamily: T.font.serif,
            color: T.ink.base,
            fontWeight: 500,
          }}
        >
          {s.name}
        </h2>
        <Badge label={humanise(s.optionKey)} color="dim" />
      </div>
      <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
        {`${s.requests} request${s.requests === 1 ? "" : "s"} · ${s.votes} vote${s.votes === 1 ? "" : "s"} · ${s.libraries.length} librar${s.libraries.length === 1 ? "y" : "ies"}`}
        {s.libraries.length > 0
          ? `: ${s.libraries
              .slice(0, 5)
              .map((l) => l.name)
              .join(", ")}${s.libraries.length > 5 ? "…" : ""}`
          : ""}
      </p>
      <fieldset
        className="m-0 flex flex-col gap-3 border-0 p-0"
        disabled={busy}
      >
        <legend className="sr-only">{`Decide on ${s.name}`}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={nameId}
              className="text-[14px] font-semibold"
              style={{ color: T.ink.dim }}
            >
              Name if accepted
            </label>
            <input
              id={nameId}
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              className="rounded-[14px] border px-3 py-2 text-[15px]"
              style={inputStyle}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={noteId}
              className="text-[14px] font-semibold"
              style={{ color: T.ink.dim }}
            >
              Note (optional)
            </label>
            <input
              id={noteId}
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-[14px] border px-3 py-2 text-[15px]"
              style={inputStyle}
            />
          </div>
        </div>
        {error ? (
          <p
            role="alert"
            className="m-0 text-[14px]"
            style={{ color: T.accent.danger }}
          >
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={PRIMARY}
            onClick={() => void decide("accept")}
          >
            Accept
          </button>
          <button
            type="button"
            className={SECONDARY}
            style={{ color: T.accent.danger }}
            onClick={() => void decide("decline")}
          >
            Decline
          </button>
        </div>
      </fieldset>
    </li>
  )
}

/**
 * Open Option Suggestions (new accessibility features, amenities and
 * services contributors asked for), most wanted first, for the editorial
 * board to accept or decline. Strapi allows only the board to decide.
 */
export function OptionSuggestionsBoard({
  initial,
}: {
  readonly initial: OptionSuggestion[]
}) {
  const [open, setOpen] = useState(() =>
    initial.filter((s) => s.status === "open")
  )
  const [status, setStatus] = useState("")

  return (
    <div className="flex flex-col gap-4">
      <p
        aria-live="polite"
        className="m-0 text-[14px]"
        style={{ color: T.ink.dim }}
      >
        {`${status ? `${status} ` : ""}${open.length} open suggestion${open.length === 1 ? "" : "s"}.`}
      </p>
      {open.length === 0 ? (
        <div
          className="rounded-[20px]"
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.line}`,
          }}
        >
          <EmptyState message="No open suggestions. Thank you." />
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {open.map((s) => (
            <SuggestionCard
              key={s.documentId}
              s={s}
              onDecided={(id, text) => {
                setOpen((list) => list.filter((x) => x.documentId !== id))
                setStatus(text)
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
