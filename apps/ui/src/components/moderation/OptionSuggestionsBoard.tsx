"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useId, useState } from "react"

import { Badge, EmptyState } from "@/components/ds"
import {
  LIST_LABELS,
  STATUS_META,
  type SuggestionStatus,
} from "@/lib/community/suggestions"
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

/** The suggestion is still undecided: not yet accepted, declined or removed. */
const UNDECIDED_STATUSES = new Set<SuggestionStatus>([
  "open",
  "reviewing",
  "planned",
])

type Decision = "review" | "plan" | "accept" | "decline" | "remove"

const FILTERS: { id: "" | SuggestionStatus; label: string }[] = [
  { id: "", label: "All undecided" },
  { id: "open", label: "New" },
  { id: "reviewing", label: "Under review" },
  { id: "planned", label: "Planned" },
]

/** Status as colour, icon and text together (never colour alone). */
function StatusChip({ status }: { readonly status: SuggestionStatus }) {
  const meta = STATUS_META[status]

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold"
      style={{ background: meta.bg, color: meta.fg }}
    >
      <Icon aria-hidden="true" icon={meta.icon} width={14} height={14} />
      {meta.label}
    </span>
  )
}

function librariesLine(s: OptionSuggestion): string {
  const base = `${s.requests} request${s.requests === 1 ? "" : "s"} · ${s.votes} vote${s.votes === 1 ? "" : "s"} · ${s.libraries.length} librar${s.libraries.length === 1 ? "y" : "ies"}`
  const names =
    s.libraries.length > 0
      ? `: ${s.libraries
          .slice(0, 5)
          .map((l) => l.name)
          .join(", ")}${s.libraries.length > 5 ? "…" : ""}`
      : ""
  const suggester = s.suggestedByName
    ? ` · Suggested by ${s.suggestedByName}`
    : ""

  return `${base}${names}${suggester}`
}

function SuggestionCard({
  s,
  onDecided,
}: {
  s: OptionSuggestion
  onDecided: (id: string, text: string, newStatus?: SuggestionStatus) => void
}) {
  const tUi = useUiTranslations("ui")

  const nameId = useId()
  const noteId = useId()
  const [name, setName] = useState(s.name)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const DECIDED_MESSAGE: Record<Decision, string> = {
    review: `Marked “${s.name}” under review.`,
    plan: `Marked “${s.name}” planned.`,
    accept: `Accepted “${s.name}”.`,
    decline: `Declined “${s.name}”.`,
    remove: `Removed “${s.name}”.`,
  }

  const NEW_STATUS: Partial<Record<Decision, SuggestionStatus>> = {
    review: "reviewing",
    plan: "planned",
  }

  async function decide(decision: Decision) {
    if (decision === "decline" && !note.trim()) {
      setError("Add a note: it’s shown with the suggestion.")

      return
    }
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
      onDecided(s.documentId, DECIDED_MESSAGE[decision], NEW_STATUS[decision])
    } catch {
      setError("Something went wrong. Check your connection and try again.")
    } finally {
      setBusy(false)
      setConfirmingRemove(false)
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
        <Badge
          label={LIST_LABELS[s.optionKey] ?? humanise(s.optionKey)}
          color="dim"
        />
        <StatusChip status={s.status} />
      </div>
      {s.description ? (
        <p className="m-0 text-[15px]" style={{ color: T.ink.base }}>
          {s.description}
        </p>
      ) : null}
      <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
        {librariesLine(s)}
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
              Note
            </label>
            <input
              id={noteId}
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-[14px] border px-3 py-2 text-[15px]"
              style={inputStyle}
            />
            <span className="text-[13px]" style={{ color: T.ink.dim }}>
              Shown publicly with the suggestion.
            </span>
          </div>
        </div>
        {s.optionKey === "library_types" ? (
          <p className="m-0 text-[13px]" style={{ color: T.ink.dim }}>
            Library types are a fixed list. Accept once the type is in the
            schema; until then, mark it planned.
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="m-0 text-[14px]"
            style={{ color: T.accent.danger }}
          >
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {s.status === "open" ? (
            <button
              type="button"
              className={SECONDARY}
              onClick={() => void decide("review")}
            >
              Mark under review
            </button>
          ) : null}
          {s.status === "open" || s.status === "reviewing" ? (
            <button
              type="button"
              className={SECONDARY}
              onClick={() => void decide("plan")}
            >
              Mark planned
            </button>
          ) : null}
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
          {confirmingRemove ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <span
                role="alert"
                className="text-[14px] font-semibold"
                style={{ color: T.accent.danger }}
              >
                Remove this suggestion? This can’t be undone.
              </span>
              <button
                type="button"
                className={SECONDARY}
                style={{ color: T.accent.danger }}
                onClick={() => void decide("remove")}
              >
                Yes, remove
              </button>
              <button
                type="button"
                className={SECONDARY}
                onClick={() => setConfirmingRemove(false)}
              >
                {tUi("cancel")}{" "}
              </button>
            </span>
          ) : (
            <button
              type="button"
              className={SECONDARY}
              style={{ color: T.accent.danger }}
              onClick={() => setConfirmingRemove(true)}
            >
              {tUi("remove")}{" "}
            </button>
          )}
        </div>
      </fieldset>
    </li>
  )
}

/**
 * Undecided Option Suggestions (new accessibility features, amenities,
 * services and library types contributors asked for), most wanted first,
 * for the editorial board to review, plan, accept, decline or remove.
 * Strapi allows only the board to decide.
 */
export function OptionSuggestionsBoard({
  initial,
}: {
  readonly initial: OptionSuggestion[]
}) {
  const tUi = useUiTranslations("ui")

  const [items, setItems] = useState(() =>
    initial.filter((s) => UNDECIDED_STATUSES.has(s.status))
  )
  const [filter, setFilter] = useState<"" | SuggestionStatus>("")
  const [status, setStatus] = useState("")

  const shown = filter ? items.filter((s) => s.status === filter) : items
  const countOf = (id: "" | SuggestionStatus) =>
    id ? items.filter((s) => s.status === id).length : items.length

  function handleDecided(
    id: string,
    text: string,
    newStatus?: SuggestionStatus
  ) {
    setItems((list) =>
      newStatus
        ? list.map((x) =>
            x.documentId === id ? { ...x, status: newStatus } : x
          )
        : list.filter((x) => x.documentId !== id)
    )
    setStatus(text)
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label={tUi("filter_by_status")}
        className="inline-flex w-fit flex-wrap gap-1 rounded-full p-1"
        style={{ background: T.bg.muted2 }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.id
          const count = countOf(f.id)

          return (
            <button
              key={f.id || "all"}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.id)}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[15px] transition-colors"
              style={{
                background: active ? T.bg.deep : "transparent",
                color: active ? T.ink.base : T.ink.dim,
                fontWeight: active ? 600 : 500,
                border: active
                  ? `1px solid ${T.border.line}`
                  : "1px solid transparent",
                cursor: "pointer",
              }}
            >
              {f.label}
              <span
                className="rounded-full px-2 text-[13px] font-semibold tabular-nums"
                style={{
                  background: active ? T.accent.chip : T.bg.muted,
                  color: active ? T.accent.primary : T.ink.dim,
                  lineHeight: "20px",
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
      <p
        aria-live="polite"
        className="m-0 text-[14px]"
        style={{ color: T.ink.dim }}
      >
        {`${status ? `${status} ` : ""}${shown.length} suggestion${shown.length === 1 ? "" : "s"}.`}
      </p>
      {shown.length === 0 ? (
        <div
          className="rounded-[20px]"
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.line}`,
          }}
        >
          <EmptyState
            message={
              items.length === 0
                ? "No open suggestions. Thank you."
                : "No suggestions match this filter."
            }
          />
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {shown.map((s) => (
            <SuggestionCard
              key={s.documentId}
              s={s}
              onDecided={handleDecided}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
