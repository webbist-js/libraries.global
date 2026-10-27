"use client"

import { Icon } from "@iconify/react"
import { ChevronDown } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  type FormEvent,
  type Ref,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react"

import { SelectField } from "@/components/ds/SelectField"
import GlobalLink from "@/components/global/GlobalLink"
import { LibraryFeatureDetails } from "@/components/library/LibraryFeatureDetails"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  isVotable,
  LIST_TINTS,
  LIST_ORDER,
  suggestionMatchScore,
  suggestionHref,
  type OptionCatalogue,
  type PublicSuggestion,
  type SuggestionList,
  type SuggestionReviewRound,
} from "@/lib/community/suggestions"
import { cn, primaryCtaSm } from "@/lib/styles"

export const SUGGEST_FORM_ID = "suggest-option"
export type SuggestOptionFormHandle = { revise: (documentId: string) => void }
const RETURN_TO = "/community/suggestions"

export const EMPTY_NAME = "Give the option a short name."
export const DUPLICATE_NAME =
  "That option already exists or has been suggested."
const nameKey = (name: string) =>
  name.trim().replaceAll(/\s+/g, " ").toLowerCase()

export function nameIssue(
  name: string,
  list: SuggestionList,
  optionNames: Record<SuggestionList, string[]>,
  suggestions: readonly PublicSuggestion[]
): string | null {
  const key = nameKey(name)
  if (!key) return EMPTY_NAME

  return (optionNames[list] ?? []).some((n) => nameKey(n) === key) ||
    suggestions.some(
      (s) =>
        s.publicationStatus !== "rejected" &&
        s.optionKey === list &&
        nameKey(s.name) === key
    )
    ? DUPLICATE_NAME
    : null
}

export function SuggestOptionForm({
  signedIn,
  optionNames,
  optionCatalogue,
  suggestions,
  onPosted,
  onVote,
  busyId,
  round,
  voteError,
  ref,
}: {
  readonly signedIn: boolean
  readonly optionNames: Record<SuggestionList, string[]>
  readonly optionCatalogue?: OptionCatalogue
  readonly suggestions: readonly PublicSuggestion[]
  readonly onPosted: (s: PublicSuggestion) => void
  readonly onVote: (
    s: PublicSuggestion
  ) => Promise<{ voted: boolean; votes: number } | null>
  readonly busyId: string | null
  readonly round?: SuggestionReviewRound | null
  readonly voteError: string | null
  readonly ref?: Ref<SuggestOptionFormHandle>
}) {
  const t = useTranslations("optionSuggestions")
  const id = useId()
  const [name, setName] = useState("")
  const [list, setList] = useState<SuggestionList>("accessibility")
  const [description, setDescription] = useState("")
  const [comparisonId, setComparisonId] = useState("")
  const [explanation, setExplanation] = useState("")
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState("")
  const [announcement, setAnnouncement] = useState("")
  const [revisionId, setRevisionId] = useState<string | null>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true

    return () => {
      alive.current = false
    }
  }, [])
  const revising = signedIn
    ? suggestions.find(
        (suggestion) =>
          suggestion.documentId === revisionId &&
          suggestion.publicationStatus === "rejected"
      )
    : undefined
  useImperativeHandle(
    ref,
    () => ({
      revise(documentId) {
        if (!signedIn || posting) return
        const suggestion = suggestions.find(
          (item) =>
            item.documentId === documentId &&
            item.publicationStatus === "rejected"
        )
        if (!suggestion) return
        setName(suggestion.name)
        setList(suggestion.optionKey)
        setDescription(suggestion.description ?? "")
        setComparisonId(suggestion.comparison?.documentId ?? "")
        setExplanation(suggestion.comparison?.explanation ?? "")
        setRevisionId(suggestion.documentId)
        setError("")
        setAnnouncement(t("revisionLoaded", { name: suggestion.name }))
        nameInput.current?.focus()
      },
    }),
    [signedIn, posting, suggestions, t]
  )
  const query = nameKey(name)
  const matches = LIST_ORDER.flatMap((key) =>
    (optionCatalogue?.[key] ?? []).map((item) => ({
      ...item,
      list: key,
      score: suggestionMatchScore(name, item.name),
    }))
  )
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 5)
  const existing = suggestions
    .filter((item) => (item.publicationStatus ?? "published") === "published")
    .map((item) => ({ item, score: suggestionMatchScore(name, item.name) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.item.votes - a.item.votes)
    .slice(0, 5)
    .map(({ item }) => item)
  const pending = signedIn
    ? suggestions.filter((item) => item.publicationStatus === "pending")
    : []
  const hasMatches = matches.length > 0 || existing.length > 0
  const frozen = (item: PublicSuggestion) =>
    round?.state === "review" &&
    round.shortlist.some((entry) => entry.documentId === item.documentId)

  async function voteMatch(item: PublicSuggestion) {
    const result = await onVote(item)
    if (alive.current && result)
      setAnnouncement(
        t(result.voted ? "voteAdded" : "voteRemoved", { name: item.name })
      )
  }
  const popular = [...suggestions]
    .filter(
      (s) =>
        (s.publicationStatus ?? "published") === "published" &&
        ["open", "reviewing", "planned"].includes(s.status) &&
        (s.votesThisMonth ?? 0) > 0
    )
    .sort((a, b) => (b.votesThisMonth ?? 0) - (a.votesThisMonth ?? 0))
    .slice(0, 4)
  const duplicate =
    query && nameIssue(name, list, optionNames, suggestions) === DUPLICATE_NAME
  const field =
    "w-full rounded-[14px] border-(--t-border-hi) bg-(--t-bg-deep) px-3.5 text-base font-normal shadow-none focus-visible:border-(--t-accent-primary) focus-visible:ring-(--t-accent-primary)/15 md:text-base dark:bg-(--t-bg-deep)"
  const sectionHeading = "m-0 text-sm font-bold tracking-[0.05em] uppercase"
  const secondaryAction =
    "inline-flex min-h-[40px] items-center justify-center rounded-full border border-(--t-palette-violet-bg) bg-(--t-bg-deep) px-4 text-sm font-semibold text-(--t-accent-primary) hover:border-(--t-accent-primary) focus-visible:outline-2 focus-visible:outline-offset-2"

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (posting) return
    if (nameIssue(name, list, optionNames, suggestions)) {
      setError(t(duplicate ? "duplicate" : "nameRequired"))

      return
    }
    if (comparisonId && !explanation.trim()) {
      setError(t("explanationRequired"))

      return
    }
    setPosting(true)
    setError("")
    setAnnouncement("")
    try {
      const res = await fetch("/api/option-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionKey: list,
          name: name.trim(),
          description: description.trim(),
          ...(comparisonId
            ? {
                comparison: {
                  documentId: comparisonId,
                  explanation: explanation.trim(),
                },
              }
            : {}),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!alive.current) return
      if (!res.ok || !json.data) {
        setError(
          typeof json.error === "string"
            ? json.error
            : (json.error?.message ?? t("postFailed"))
        )

        return
      }
      onPosted(json.data)
      setName("")
      setDescription("")
      setComparisonId("")
      setExplanation("")
      setRevisionId(null)
      setAnnouncement(t("submittedPending"))
    } catch {
      if (alive.current) setError(t("postFailed"))
    } finally {
      if (alive.current) setPosting(false)
    }
  }

  return (
    <form
      id={SUGGEST_FORM_ID}
      aria-labelledby={`${id}-heading`}
      onSubmit={submit}
      className={`grid scroll-mt-24 gap-5 rounded-[28px] border-2 bg-(--t-bg-deep) p-5 text-base [--spacing:0.25rem] focus-within:border-(--t-accent-primary) sm:p-8 ${query ? "border-(--t-accent-primary)" : "border-(--t-border-line)"}`}
    >
      <div className="grid gap-3">
        <h2 id={`${id}-heading`} className="type-h2 m-0">
          {t("composerTitle")}
        </h2>
        <p className="m-0 max-w-[74ch] text-base leading-relaxed text-(--t-ink-dim)">
          {t("composerLead")}
        </p>
      </div>
      {revising && (
        <div className="grid gap-1.5 rounded-[16px] border border-[#eeddb6] bg-[#fffbf3] px-4 py-3 text-sm">
          <p className="m-0 font-semibold text-(--t-palette-amber-fg)">
            {t("revisionLoaded", { name: revising.name })}
          </p>
          {revising.decisionNote && (
            <p className="m-0 leading-relaxed break-words whitespace-pre-wrap text-(--t-ink-dim)">
              {revising.decisionNote}
            </p>
          )}
        </div>
      )}
      <label className="grid gap-2 text-sm font-semibold">
        {t("optionName")}
        <Input
          ref={nameInput}
          name="name"
          value={name}
          maxLength={80}
          required
          autoComplete="off"
          placeholder={t("placeholder")}
          onChange={(e) => {
            setName(e.target.value)
            setError("")
            setAnnouncement("")
          }}
          aria-describedby={`${id}-feedback`}
          className={cn(
            field,
            "min-h-[56px] bg-(--t-bg-void) px-4 text-lg md:text-lg dark:bg-(--t-bg-void)"
          )}
        />
      </label>
      {matches.length > 0 && (
        <div className="grid gap-2">
          <h3
            className={`type-h3 ${cn(sectionHeading, "text-(--t-accent-ok)")}`}
          >
            {t("checklistMatches")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {matches.map((item) => (
              <span
                key={`${item.list}:${item.documentId}`}
                className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm text-(--t-accent-ok)"
                style={{ background: LIST_TINTS.services.soft }}
              >
                <Icon aria-hidden icon="mdi:check" width={18} />
                <LibraryFeatureDetails
                  name={item.name}
                  summary={item.summary}
                  description={item.description}
                  detailCategory={item.category}
                  className="inline-flex items-center gap-1.5 text-left underline-offset-4 hover:underline"
                >
                  <strong className="font-semibold">{item.name}</strong>
                  <span className="font-normal opacity-85">
                    · {t(`lists.${item.list}`)}
                  </span>
                </LibraryFeatureDetails>
              </span>
            ))}
          </div>
          {existing.length === 0 && (
            <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
              {t("correctionLead")}{" "}
              <GlobalLink
                href="/contribute/index"
                className="text-(--t-accent-primary) underline"
              >
                {t("correctLibrary")}
              </GlobalLink>{" "}
              {t("correctionEnd")}
            </p>
          )}
        </div>
      )}
      {existing.length > 0 && (
        <div className="grid gap-2">
          <h3
            className={`type-h3 ${cn(sectionHeading, "text-(--t-accent-primary)")}`}
          >
            {t("suggestionMatches")}
          </h3>
          {existing.map((item) => (
            <div
              key={item.documentId}
              className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-[18px] bg-(--t-palette-violet-soft) px-4 py-3"
            >
              <p className="m-0 min-w-0 text-base leading-relaxed">
                <GlobalLink
                  href={suggestionHref(item.documentId)}
                  className="font-semibold hover:underline"
                >
                  {item.name}
                </GlobalLink>{" "}
                <span className="text-(--t-ink-dim)">
                  · {t("votes", { count: item.votes })}
                  {" · "}
                  {t("conversationReplies", {
                    count: item.conversation?.count ?? item.commentCount ?? 0,
                  })}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <GlobalLink
                  href={suggestionHref(item.documentId)}
                  className={secondaryAction}
                >
                  {t("addToConversation")}
                </GlobalLink>
                {!isVotable(item) || frozen(item) ? (
                  <span className="text-sm font-semibold text-(--t-ink-dim)">
                    {t(
                      frozen(item) ? "votesPaused" : `statuses.${item.status}`
                    )}
                  </span>
                ) : signedIn ? (
                  <button
                    type="button"
                    aria-pressed={Boolean(item.voted)}
                    aria-label={`${t(item.voted ? "youVoted" : "voteMatch")}: ${item.name}`}
                    disabled={busyId !== null}
                    onClick={() => void voteMatch(item)}
                    className={`inline-flex min-h-[40px] items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${item.voted ? "bg-(--t-ink-base)" : "bg-(--t-accent-primary) hover:bg-(--t-accent-primary-hover)"}`}
                  >
                    {item.voted && (
                      <Icon aria-hidden icon="mdi:check" width={18} />
                    )}
                    {t(
                      busyId === item.documentId
                        ? "voteBusy"
                        : item.voted
                          ? "youVoted"
                          : "voteMatch"
                    )}
                  </button>
                ) : (
                  <GlobalLink
                    href={`/auth/signin?callbackUrl=${encodeURIComponent(RETURN_TO)}`}
                    className={cn(
                      primaryCtaSm,
                      "min-h-[40px] justify-center text-sm"
                    )}
                  >
                    {t("voteMatch")}
                  </GlobalLink>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {name.trim() && signedIn && (
        <div
          className={`grid gap-3 ${hasMatches ? "border-t border-(--t-border-line) pt-4" : ""}`}
        >
          {hasMatches && (
            <h3
              className={`type-h3 ${cn(sectionHeading, "text-(--t-accent-primary)")}`}
            >
              {t("newIdeaHeading")}
            </h3>
          )}
          <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_200px] lg:grid-cols-[minmax(0,1fr)_220px]">
            <label className="grid min-w-0 gap-2 text-sm font-semibold">
              {t(hasMatches ? "distinctIdea" : "whyMatters")}
              <Textarea
                value={description}
                maxLength={400}
                rows={2}
                placeholder={t("descriptionPlaceholder")}
                required
                onChange={(e) => setDescription(e.target.value)}
                className={cn(
                  field,
                  "field-sizing-fixed min-h-[80px] resize-y py-3"
                )}
              />
            </label>
            <label className="grid min-w-0 gap-2 text-sm font-semibold">
              {t("whichList")}
              <SelectField
                name="list"
                label={t("whichList")}
                value={list}
                onValueChange={(value) => {
                  setList(value as SuggestionList)
                  setComparisonId("")
                  setExplanation("")
                  setError("")
                }}
                className="min-h-[48px] rounded-[14px] border-(--t-border-hi) px-4 text-base font-semibold shadow-none focus-visible:border-(--t-accent-primary) focus-visible:ring-(--t-accent-primary)/20 dark:bg-(--t-bg-deep) dark:hover:bg-(--t-bg-surface)"
                options={LIST_ORDER.map((key) => ({
                  value: key,
                  label: t(`lists.${key}`),
                }))}
              />
            </label>
          </div>
          {!!optionCatalogue?.[list].length && (
            <details className="group/comparison text-sm text-(--t-ink-dim)">
              <summary className="inline-flex min-h-[32px] w-fit cursor-pointer list-none items-center gap-1.5 font-medium hover:text-(--t-accent-primary) [&::-webkit-details-marker]:hidden">
                {t("comparisonLabel")}
                <ChevronDown
                  size={14}
                  className="group-open/comparison:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="mt-2 grid gap-3 rounded-[14px] border border-(--t-border-line) bg-(--t-bg-surface) p-4">
                <label className="grid gap-2 text-sm font-semibold">
                  {t("comparisonLabel")}
                  <SelectField
                    label={t("comparisonLabel")}
                    value={comparisonId}
                    onValueChange={setComparisonId}
                    className="min-h-[44px] text-sm shadow-none dark:bg-(--t-bg-deep) dark:hover:bg-(--t-bg-surface)"
                    options={[
                      { value: "", label: t("noComparison") },
                      ...optionCatalogue[list].map((item) => ({
                        value: item.documentId,
                        label: item.name,
                      })),
                    ]}
                  />
                </label>
                {comparisonId && (
                  <label className="grid gap-2 text-sm font-semibold">
                    {t("explanationLabel")}
                    <Textarea
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                      maxLength={400}
                      rows={2}
                      required
                      onInvalid={(event) => {
                        const details = event.currentTarget.closest("details")
                        if (details) details.open = true
                      }}
                      className={cn(field, "field-sizing-fixed resize-y py-3")}
                    />
                  </label>
                )}
              </div>
            </details>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={posting || Boolean(duplicate)}
              className={cn(
                primaryCtaSm,
                "min-h-[44px] justify-center px-5 text-base disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              {posting
                ? t("posting")
                : t("suggestNamed", { name: name.trim() })}
            </button>
            <p className="m-0 text-sm leading-relaxed text-(--t-ink-dim)">
              {t("publicationHint")}
            </p>
          </div>
        </div>
      )}
      {!signedIn && (
        <GlobalLink
          href={`/auth/signin?callbackUrl=${encodeURIComponent(RETURN_TO)}`}
          className={cn(
            primaryCtaSm,
            "min-h-[44px] justify-center justify-self-start px-5 text-base no-underline"
          )}
        >
          {t("signInToSuggest")}
        </GlobalLink>
      )}
      {popular.length > 0 && !query && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-(--t-ink-dim)">{t("popularMonth")}</span>
          {popular.map((item) => (
            <button
              type="button"
              key={item.documentId}
              onClick={() => {
                setName(item.name)
                setRevisionId(null)
                setList(item.optionKey)
                setComparisonId("")
                setExplanation("")
                setError("")
              }}
              className="min-h-11 rounded-full border border-dashed border-(--t-border-line) px-3 py-1.5 font-semibold hover:border-(--t-accent-primary)"
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
      {pending.length > 0 && (
        <ul id="pending-suggestions" className="m-0 grid list-none gap-2 p-0">
          {pending.map((item) => (
            <li
              key={item.documentId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[18px] border border-dashed border-(--t-palette-violet-bg) bg-(--t-palette-violet-soft) px-4 py-3 text-sm"
            >
              <p className="m-0">
                <strong>{item.name}</strong> · {t(`lists.${item.optionKey}`)} ·{" "}
                {t("privatePending")}
              </p>
              <strong className="text-sm text-(--t-palette-violet-fg)">
                {t("onlyYou")}
              </strong>
            </li>
          ))}
        </ul>
      )}
      <div
        id={`${id}-feedback`}
        aria-live="polite"
        className={error || voteError || duplicate ? undefined : "sr-only"}
      >
        {error && (
          <p className="m-0 text-sm text-(--t-accent-danger)">{error}</p>
        )}
        {voteError && (
          <p className="m-0 text-sm text-(--t-accent-danger)">{voteError}</p>
        )}
        <p className="sr-only">{announcement}</p>
        {duplicate && !error && (
          <p className="m-0 text-sm text-(--t-ink-dim)">{t("duplicate")}</p>
        )}
      </div>
    </form>
  )
}
