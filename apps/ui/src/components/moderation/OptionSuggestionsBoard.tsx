"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useId, useState } from "react"

import { Badge, EmptyState } from "@/components/ds"
import { SelectField } from "@/components/ds/SelectField"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  type OptionCatalogue,
  type SuggestionReviewRound,
  LIST_LABELS,
  STATUS_META,
  type SuggestionStatus,
} from "@/lib/community/suggestions"
import { T } from "@/lib/design-tokens"
import { cn } from "@/lib/styles"

import {
  decisionErrorMessage,
  humanise,
  type OptionSuggestion,
} from "./submissionMeta"
import { SuggestionRoundControls } from "./SuggestionRoundControls"

const PRIMARY = cn(buttonVariants({ variant: "primary", size: "pill" }))
const SECONDARY = cn(buttonVariants({ variant: "surface", size: "pill" }))
const FIELD =
  "min-h-[48px] w-full min-w-0 rounded-[14px] border border-(--t-border-hi) bg-(--t-bg-deep) px-4 py-3 text-base font-normal text-(--t-ink-base)"

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
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
      style={{ background: meta.bg, color: meta.fg }}
    >
      <Icon aria-hidden="true" icon={meta.icon} width={14} height={14} />
      {meta.label}
    </span>
  )
}

function librariesLine(s: OptionSuggestion): string {
  const names =
    s.libraries.length > 0
      ? `${s.libraries
          .slice(0, 5)
          .map((l) => l.name)
          .join(", ")}${s.libraries.length > 5 ? "…" : ""}`
      : ""
  const suggester = s.suggestedByName ? `Suggested by ${s.suggestedByName}` : ""

  return [names, suggester].filter(Boolean).join(" · ")
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
      className="flex min-w-0 scroll-mt-(--sticky-content-top) flex-col gap-5 rounded-[24px] p-5 sm:p-6"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <div className="flex flex-col gap-3">
        <h2
          className="type-h2 m-0 [overflow-wrap:anywhere]"
          style={{
            color: T.ink.base,
          }}
        >
          {s.name}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Badge
            label={LIST_LABELS[s.optionKey] ?? humanise(s.optionKey)}
            color="dim"
          />
          <StatusChip status={s.status} />
        </div>
      </div>
      {s.publicationStatus === "pending" && (
        <p className="m-0 rounded-xl bg-(--t-accent-chip) px-4 py-3 text-sm leading-relaxed font-medium text-(--t-accent-primary-hover)">
          {t("publicationReview")}
        </p>
      )}
      {s.comparison && (
        <div className="rounded-xl bg-(--t-bg-surface) p-4 text-sm leading-relaxed">
          <strong>
            {t("comparisonTitle")}: {s.comparison.name}
          </strong>
          <p className="mb-0">{s.comparison.explanation}</p>
        </div>
      )}
      {s.description ? (
        <p
          className="m-0 text-base leading-relaxed [overflow-wrap:anywhere]"
          style={{ color: T.ink.base }}
        >
          {s.description}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-(--t-ink-dim)">
        <span>
          <strong className="font-semibold text-(--t-ink-base)">
            {s.votes}
          </strong>{" "}
          {s.votes === 1 ? "vote" : "votes"}
        </span>
        <span>
          <strong className="font-semibold text-(--t-ink-base)">
            {s.requests}
          </strong>{" "}
          {s.requests === 1 ? "request" : "requests"}
        </span>
        <span>
          <strong className="font-semibold text-(--t-ink-base)">
            {s.libraries.length}
          </strong>{" "}
          {s.libraries.length === 1 ? "library" : "libraries"}
        </span>
      </div>
      {librariesLine(s) ? (
        <p className="m-0 text-sm leading-relaxed" style={{ color: T.ink.dim }}>
          {librariesLine(s)}
        </p>
      ) : null}
      <fieldset
        className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0"
        disabled={busy}
      >
        <legend className="sr-only">{`Decide on ${s.name}`}</legend>
        <div className="grid gap-4 rounded-2xl bg-(--t-bg-surface) p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={nameId}
              className="text-sm font-semibold"
              style={{ color: T.ink.dim }}
            >
              Name if accepted
            </label>
            <input
              id={nameId}
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              className={FIELD}
              style={inputStyle}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={noteId}
              className="text-sm font-semibold"
              style={{ color: T.ink.dim }}
            >
              {t(
                s.publicationStatus === "pending"
                  ? "privateFeedback"
                  : "publicNote"
              )}
            </label>
            <textarea
              id={noteId}
              rows={3}
              aria-describedby={`${noteId}-hint`}
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
              className={FIELD}
              style={inputStyle}
            />
            <span
              id={`${noteId}-hint`}
              className="text-sm leading-relaxed"
              style={{ color: T.ink.dim }}
            >
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
          <details className="group rounded-2xl border border-(--t-border-line) px-4 py-1">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold text-(--t-ink-base) [&::-webkit-details-marker]:hidden">
              {t("featureDetails")}
              <Icon
                aria-hidden
                icon="mdi:chevron-down"
                width={20}
                className="shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="mt-1 mb-4 text-sm leading-relaxed text-(--t-ink-dim)">
              {t("featureDetailsHint")}
            </p>
            <div className="grid min-w-0 gap-4 pb-3 sm:grid-cols-2">
              {(["summary", "description", "icon", "category"] as const).map(
                (key) => (
                  <label
                    key={key}
                    className="grid min-w-0 content-start gap-2 text-sm font-semibold"
                  >
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
                        className="min-h-[48px] text-base"
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
                        className={FIELD}
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
                        className={FIELD}
                      />
                    )}
                  </label>
                )
              )}
              <label className="grid min-w-0 gap-2 text-sm font-semibold sm:col-span-2">
                {t("existingFeature")}
                <SelectField
                  label={t("existingFeature")}
                  className="min-h-[48px] text-base"
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
          </details>
        )}
        {error ? (
          <p
            role="alert"
            className="m-0 text-sm"
            style={{ color: T.accent.danger }}
          >
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 border-t border-(--t-border-line) pt-5">
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
                className="text-sm font-semibold"
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
              className={`${SECONDARY} sm:ml-auto`}
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
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-1">
        <a
          href="#suggestion-review-schedule"
          className="inline-flex min-h-[44px] items-center gap-2 self-start text-base font-semibold text-(--t-accent-primary) underline underline-offset-4 lg:hidden"
        >
          Review schedule
          <Icon aria-hidden icon="mdi:arrow-down" width={17} />
        </a>
        <div
          role="group"
          aria-label={tUi("filter_by_status")}
          className="flex flex-wrap gap-2"
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
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-base transition-colors"
                style={{
                  background: active ? T.bg.inverse : T.bg.deep,
                  color: active ? T.ink.inverse : T.ink.dim,
                  fontWeight: active ? 600 : 500,
                  border: `1px solid ${active ? T.ink.base : T.border.line}`,
                  cursor: "pointer",
                }}
              >
                {f.label}
                <span
                  className="rounded-full px-2 text-sm font-semibold tabular-nums"
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
          className="m-0 text-sm"
          style={{ color: T.ink.dim }}
        >
          {`${status ? `${status} ` : ""}${shown.length} suggestion${shown.length === 1 ? "" : "s"}.`}
        </p>
        {shown.length === 0 ? (
          <div
            className="rounded-[24px]"
            style={{
              background: T.bg.deep,
              border: `1px solid ${T.border.line}`,
            }}
          >
            <EmptyState
              headingLevel={2}
              lead={
                items.length === 0
                  ? "No suggestions waiting"
                  : "No suggestions match this filter."
              }
              detail={
                items.length === 0
                  ? "New requests for library features and types will appear here for review."
                  : "Choose another status to see the remaining suggestions."
              }
              action={
                items.length > 0 ? (
                  <Button
                    variant="surface"
                    size="pill"
                    onClick={() => setFilter("")}
                  >
                    Show all suggestions
                  </Button>
                ) : undefined
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
      <aside
        id="suggestion-review-schedule"
        aria-label="Review schedule"
        className="min-w-0 scroll-mt-(--sticky-content-top) lg:sticky lg:top-(--sticky-content-top) lg:col-start-2 lg:row-start-1 lg:max-h-(--sticky-content-max-height) lg:overflow-y-auto lg:overscroll-contain"
      >
        <SuggestionRoundControls initial={round} />
      </aside>
    </div>
  )
}
