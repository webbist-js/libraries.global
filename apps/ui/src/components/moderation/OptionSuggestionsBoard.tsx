"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useId, useState } from "react"

import { Badge, EmptyState } from "@/components/ds"
import { SelectField } from "@/components/ds/SelectField"
import {
  type OptionCatalogue,
  type SuggestionReviewRound,
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
import { SuggestionRoundControls } from "./SuggestionRoundControls"

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

type Decision =
  | "review"
  | "plan"
  | "accept"
  | "decline"
  | "remove"
  | "publish"
  | "reject"
  | "update"
  | "merge"

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
  catalogue,
}: {
  s: OptionSuggestion
  catalogue?: OptionCatalogue
  onDecided: (
    id: string,
    text: string,
    newStatus?: SuggestionStatus,
    patch?: Partial<OptionSuggestion>
  ) => void
}) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("optionSuggestions")
  const [feature, setFeature] = useState({
    summary: "",
    description: "",
    icon: "",
    category: "",
  })
  const [existingOptionDocumentId, setExistingOptionDocumentId] = useState("")

  const nameId = useId()
  const noteId = useId()
  const [name, setName] = useState(s.name)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const DECIDED_MESSAGE: Record<Decision, string> = {
    publish: t("publish"),
    reject: t("rejectPublication"),
    update: t("updateFeature"),
    merge: t("mergeFeature"),
    review: `Marked “${s.name}” under review.`,
    plan: `Marked “${s.name}” planned.`,
    accept: `Accepted “${s.name}”.`,
    decline: `Declined “${s.name}”.`,
    remove: `Removed “${s.name}”.`,
  }

  const NEW_STATUS: Partial<Record<Decision, SuggestionStatus>> = {
    review: "reviewing",
    plan: "planned",
    publish: "open",
  }

  async function decide(decision: Decision) {
    if (
      ["accept", "decline", "update", "merge", "reject", "plan"].includes(
        decision
      ) &&
      !note.trim()
    ) {
      setError(
        t(decision === "reject" ? "privateNoteRequired" : "noteRequired")
      )

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
            version: s.version ?? 0,
            feature,
            existingOptionDocumentId,
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
      const data =
        body && typeof body === "object" && "data" in body
          ? (body as { data?: Partial<OptionSuggestion> }).data
          : undefined
      onDecided(
        s.documentId,
        DECIDED_MESSAGE[decision],
        NEW_STATUS[decision],
        data
      )
    } catch {
      setError("Something went wrong. Check your connection and try again.")
    } finally {
      setBusy(false)
      setConfirmingRemove(false)
    }
  }

  return (
    <li
      id={`moderation-suggestion-${s.documentId}`}
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
      {s.publicationStatus === "pending" && (
        <p className="m-0 text-sm font-semibold text-(--t-accent-primary)">
          {t("publicationReview")}
        </p>
      )}
      {s.comparison && (
        <div className="rounded-xl bg-(--t-bg-muted) p-3 text-sm">
          <strong>
            {t("comparisonTitle")}: {s.comparison.name}
          </strong>
          <p className="mb-0">{s.comparison.explanation}</p>
        </div>
      )}
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
              {t(
                s.publicationStatus === "pending"
                  ? "privateFeedback"
                  : "publicNote"
              )}
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
              {t(
                s.publicationStatus === "pending"
                  ? "privateFeedbackHint"
                  : "publicFeedbackHint"
              )}
            </span>
          </div>
        </div>
        {existingOptionDocumentId && (
          <p className="text-sm text-(--t-ink-dim)">{t("appendHint")}</p>
        )}
        {s.publicationStatus !== "pending" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(["summary", "description", "icon", "category"] as const).map(
              (key) => (
                <label key={key} className="grid gap-1 text-sm font-semibold">
                  {t(
                    (
                      {
                        summary: "featureSummary",
                        description: "featureDescription",
                        icon: "featureIcon",
                        category: "featureCategory",
                      } as const
                    )[key]
                  )}
                  {key === "category" ? (
                    <SelectField
                      label={t("featureCategory")}
                      value={feature.category}
                      onValueChange={(category) =>
                        setFeature((value) => ({ ...value, category }))
                      }
                      options={[
                        { value: "", label: "—" },
                        ...(catalogue?.categories?.[s.optionKey] ?? []).map(
                          (category) => ({ value: category, label: category })
                        ),
                      ]}
                    />
                  ) : key === "description" ? (
                    <textarea
                      rows={3}
                      maxLength={4000}
                      value={feature[key]}
                      onChange={(e) =>
                        setFeature((value) => ({
                          ...value,
                          [key]: e.target.value,
                        }))
                      }
                      className="rounded-lg border p-2 font-normal"
                    />
                  ) : (
                    <input
                      value={feature[key]}
                      maxLength={key === "summary" ? 400 : 100}
                      onChange={(e) =>
                        setFeature((value) => ({
                          ...value,
                          [key]: e.target.value,
                        }))
                      }
                      className="min-h-11 rounded-lg border p-2 font-normal"
                    />
                  )}
                </label>
              )
            )}
            <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
              {t("existingFeature")}
              <SelectField
                label={t("existingFeature")}
                value={existingOptionDocumentId}
                onValueChange={setExistingOptionDocumentId}
                options={[
                  { value: "", label: t("chooseFeature") },
                  ...(catalogue?.[s.optionKey] ?? []).map((item) => ({
                    value: item.documentId,
                    label: item.name,
                  })),
                ]}
              />
            </label>
          </div>
        )}
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
          {s.publicationStatus === "pending" ? (
            <>
              <button
                type="button"
                className={PRIMARY}
                onClick={() => void decide("publish")}
              >
                {t("publish")}
              </button>
              <button
                type="button"
                className={SECONDARY}
                onClick={() => void decide("reject")}
              >
                {t("rejectPublication")}
              </button>
            </>
          ) : (
            <>
              {existingOptionDocumentId && (
                <>
                  <button
                    type="button"
                    className={SECONDARY}
                    onClick={() => void decide("update")}
                  >
                    {t("updateFeature")}
                  </button>
                  <button
                    type="button"
                    className={SECONDARY}
                    onClick={() => void decide("merge")}
                  >
                    {t("mergeFeature")}
                  </button>
                </>
              )}

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
            </>
          )}
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
  catalogue,
  round,
}: {
  readonly catalogue?: OptionCatalogue
  readonly round?: SuggestionReviewRound | null
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
    newStatus?: SuggestionStatus,
    patch?: Partial<OptionSuggestion>
  ) {
    setItems((list) =>
      newStatus
        ? list.map((x) =>
            x.documentId === id ? { ...x, ...patch, status: newStatus } : x
          )
        : list.filter((x) => x.documentId !== id)
    )
    setStatus(text)
  }

  return (
    <div className="flex flex-col gap-4">
      <SuggestionRoundControls initial={round} />
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
              catalogue={catalogue}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
