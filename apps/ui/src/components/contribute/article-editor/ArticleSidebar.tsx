"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations, useLocale } from "next-intl"
import { useEffect, useMemo, useRef, useState } from "react"

import { SearchField } from "@/components/ds/SearchField"
import { SelectField } from "@/components/ds/SelectField"
import { Button } from "@/components/ui/button"
import { articleEventTime } from "@/lib/article-event-time"
import { T } from "@/lib/design-tokens"
import { languageName } from "@/lib/locale-fallback"
import { searchLibraryNames } from "@/lib/meilisearch"
import { Link } from "@/lib/navigation"

import type {
  ArticleEventMention,
  ArticleKind,
  ArticleLocale,
  ArticleTag,
} from "./article.types"

export type SaveState = "idle" | "saving" | "saved" | "error"
export type SubmitState = "idle" | "submitting" | "submitted" | "error"

const card: React.CSSProperties = {
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
  borderRadius: 24,
  padding: 24,
}

const cardTitle: React.CSSProperties = {
  color: T.ink.base,
  margin: 0,
}

const cardHint: React.CSSProperties = {
  fontFamily: T.font.sans,
  fontSize: "var(--type-body-small-size)",
  color: T.ink.dim,
  margin: "4px 0 0",
  lineHeight: 1.5,
}

const chipBase =
  "inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"

function Chip({
  on,
  onClick,
  children,
  badge,
  dashed,
  ariaLabel,
  disabled,
}: {
  on?: boolean
  onClick: () => void
  children: React.ReactNode
  badge?: string
  dashed?: boolean
  ariaLabel?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={dashed ? undefined : !!on}
      aria-label={ariaLabel}
      onClick={onClick}
      className={chipBase}
      style={{
        cursor: "pointer",
        fontFamily: T.font.sans,
        border: `1px ${dashed ? "dashed" : "solid"} ${on ? T.accent.primary : T.border.hi}`,
        background: on ? T.accent.chip : T.bg.deep,
        color: on ? T.accent.primary : T.ink.base,
      }}
    >
      {on && !dashed && <Icon icon="mdi:check" width={15} aria-hidden="true" />}
      {children}
      {badge && (
        <span
          className="rounded-full px-1.5 py-0.5 text-sm font-bold"
          style={{ background: T.accent.primary, color: "#fff" }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

// ── Status / submit ────────────────────────────────────────────────────────

export function StatusCard({
  mode,
  kind,
  translating,
  localeName,
  saveState,
  lastSavedAt,
  submitState,
  submitError,
  canSubmit,
  publishesDirectly,
  onSubmit,
  publishedAt,
  isPublished,
  onRetry,
  offline = false,
  checks = [],
  note,
}: {
  mode: "new" | "edit"
  kind: ArticleKind
  translating: boolean
  localeName: string
  saveState: SaveState
  lastSavedAt: Date | null
  submitState: SubmitState
  submitError: string | null
  canSubmit: boolean
  publishesDirectly: boolean
  onSubmit: () => void
  publishedAt?: string | null
  isPublished?: boolean
  onRetry?: () => void
  offline?: boolean
  checks?: readonly { id: string; label: string; done: boolean }[]
  note?: React.ReactNode
}) {
  const tUi = useUiTranslations("ui")
  const tLanguage = useUiTranslations("translation")
  const p = useUiTranslations("publishing")
  const displayLocale = useLocale()
  const w = useUiTranslations("writeWorkspace")
  const remaining = checks.filter((check) => !check.done).length

  let saveLabel = tUi("not_saved_yet")
  let saveIcon = "mdi:circle-outline"
  let saveColor: string = T.ink.dim
  if (saveState === "saving") {
    saveLabel = tUi("saving")
    saveIcon = "mdi:loading"
  } else if (saveState === "saved" || lastSavedAt) {
    saveLabel = tUi("draft_saved")
    saveIcon = "mdi:check"
    saveColor = T.accent.ok
  }
  if (saveState === "error") {
    saveLabel = tUi("couldnt_save")
    saveIcon = "mdi:alert-circle-outline"
    saveColor = T.accent.danger
  }
  const title = translating
    ? tLanguage("title", { language: localeName })
    : mode === "new"
      ? tUi("new_draft")
      : tUi("editing")
  const submitted = submitState === "submitted"

  return (
    <section aria-labelledby="status-heading" style={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          className="type-panel-title"
          id="status-heading"
          style={{
            ...cardTitle,
          }}
        >
          {title}
        </h2>
        <p
          role="status"
          className="m-0 flex items-center gap-1.5 rounded-full bg-(--t-bg-surface) px-2.5 py-1 text-base font-semibold"
          style={{ color: saveColor }}
        >
          <Icon icon={saveIcon} width={16} aria-hidden="true" />
          {saveLabel}
        </p>
      </div>
      <p style={cardHint}>
        {submitted
          ? p("awaitingReview")
          : mode === "edit"
            ? p("privateProposal")
            : p("privateDraft")}
      </p>
      {mode === "edit" && (
        <p className="mt-2 text-base text-(--t-ink-dim)">
          {publishedAt
            ? p("livePublished", {
                date: new Date(publishedAt).toLocaleDateString(displayLocale),
              })
            : isPublished
              ? p("published")
              : p("notPublishedLanguage", { language: localeName })}
        </p>
      )}
      {publishesDirectly && !submitted && (
        <p className="mt-2 text-xs text-(--t-ink-dim)">
          {p("approvedChanges")}
        </p>
      )}
      {saveState === "error" && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={offline}
          className="mt-3 underline"
        >
          {p("retrySave")}
        </button>
      )}
      {note && <div className="mt-4">{note}</div>}
      {!submitted && checks.length > 0 && (
        <ul
          aria-label={w("beforeSubmit")}
          className="mt-4 mb-0 grid list-none gap-2 p-0"
        >
          {checks.map((check) => (
            <li
              key={check.id}
              className="flex items-center gap-2 text-base leading-relaxed"
            >
              <Icon
                aria-hidden
                icon={check.done ? "mdi:check-circle" : "mdi:circle-outline"}
                width={20}
                className={
                  check.done
                    ? "shrink-0 text-(--t-accent-ok)"
                    : "shrink-0 text-(--t-ink-faint)"
                }
              />
              <span>
                {check.label}
                <span className="sr-only">
                  {" "}
                  · {w(check.done ? "done" : "needed")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit || submitState === "submitting" || submitted}
        aria-busy={submitState === "submitting"}
        variant="primary"
        size="pill"
        className="mt-4 w-full"
      >
        {submitState === "submitting"
          ? tUi("sending")
          : submitted
            ? tUi("sent_for_review")
            : remaining > 0
              ? w("remaining", { count: remaining })
              : tUi("submit_for_review")}
      </Button>
      {submitted && (
        <p
          className="mt-3 mb-0 flex items-start gap-2 rounded-[14px] px-3.5 py-2.5 text-base"
          style={{
            background: "var(--tint-public-bg)",
            color: "var(--tint-public-fg)",
          }}
        >
          <Icon
            icon="mdi:check"
            width={18}
            aria-hidden="true"
            style={{ flexShrink: 0, marginTop: 2 }}
          />
          <span>
            {tUi("sent_to_the_editors_track_it_in")}{" "}
            <Link
              href="/contribute/submissions"
              className="font-semibold underline underline-offset-[3px]"
              style={{ color: "inherit" }}
            >
              {tUi("my_submissions")}{" "}
            </Link>
            .
          </span>
        </p>
      )}
      {submitState === "error" && submitError && (
        <p
          role="alert"
          className="mt-3 mb-0 rounded-[14px] px-3.5 py-2.5 text-base font-semibold"
          style={{ background: "#F6E3DA", color: T.accent.danger }}
        >
          {submitError}
        </p>
      )}
      <p className="mt-3 mb-0 text-sm" style={{ color: T.ink.low }}>
        {kind === "journal" ? tUi("journal") : tUi("knowledge")} · {localeName}
      </p>
    </section>
  )
}

// ── Sections ───────────────────────────────────────────────────────────────

export function SectionsCard({
  kind,
  locale,
  sections,
  onChange,
  disabled,
  embedded = false,
  inherited = false,
}: {
  kind: ArticleKind
  locale: string
  sections: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  embedded?: boolean
  inherited?: boolean
}) {
  const tUi = useUiTranslations("ui")
  const w = useUiTranslations("writeWorkspace")
  const [loadResult, setLoadResult] = useState<{
    key: string
    state: "ready" | "error"
  }>({ key: "", state: "ready" })
  const [attempt, setAttempt] = useState(0)
  const loadKey = `${kind}:${locale}:${attempt}`
  const loadState = loadResult.key === loadKey ? loadResult.state : "loading"

  // Section keys stay stable while their labels follow the article language.
  const [options, setOptions] = useState<{ key: string; label: string }[]>([])
  useEffect(() => {
    let cancelled = false
    fetch(
      `/api/relations/${kind === "knowledge" ? "wiki-sections" : "blog-sections"}?locale=${encodeURIComponent(locale)}`
    )
      .then((r) => {
        if (!r.ok) throw new Error("Sections unavailable")

        return r.json()
      })
      .then((j: { data?: { slug?: string; name?: string }[] }) => {
        if (cancelled) return
        setLoadResult({ key: loadKey, state: "ready" })
        setOptions(
          (j.data ?? []).flatMap((s) =>
            s.slug && s.name ? [{ key: s.slug, label: s.name }] : []
          )
        )
      })
      .catch(() => {
        if (!cancelled) setLoadResult({ key: loadKey, state: "error" })
      })

    return () => {
      cancelled = true
    }
  }, [kind, locale, attempt, loadKey])

  const multi = kind === "knowledge"
  const visibleOptions = inherited
    ? sections.map(
        (key) =>
          options.find((option) => option.key === key) ?? {
            key,
            label: key.replaceAll("-", " "),
          }
      )
    : options

  const toggle = (key: string) => {
    if (disabled) return
    if (!multi) {
      onChange(sections[0] === key ? [] : [key])

      return
    }
    onChange(
      sections.includes(key)
        ? sections.filter((s) => s !== key)
        : [...sections, key]
    )
  }

  return (
    <section
      aria-labelledby="sections-heading"
      style={embedded ? undefined : card}
    >
      <h2 className="type-panel-title" id="sections-heading" style={cardTitle}>
        {kind === "knowledge"
          ? tUi("knowledge_sections")
          : tUi("journal_section")}{" "}
        {!inherited && (
          <span style={{ color: "var(--tint-special-fg)", fontWeight: 500 }}>
            {tUi("required")}{" "}
          </span>
        )}
      </h2>
      <p style={cardHint}>
        {inherited
          ? w("inherited")
          : kind === "knowledge"
            ? tUi(
                "where_this_article_appears_the_first_one_you_pick_is_its_home_section"
              )
            : tUi("where_this_story_appears_in_the_journal")}
      </p>
      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label={
          kind === "knowledge"
            ? tUi("knowledge_sections")
            : tUi("journal_section")
        }
      >
        {loadState === "loading" && (
          <p className="m-0 text-base" style={{ color: T.ink.faint }}>
            {tUi("loading_sections")}{" "}
          </p>
        )}
        {loadState === "error" && (
          <div role="alert">
            <p className="m-0 mb-2 text-base">{w("sectionsUnavailable")}</p>
            <Button
              variant="surface"
              size="pill"
              onClick={() => setAttempt((value) => value + 1)}
            >
              {tUi("try_again")}
            </Button>
          </div>
        )}
        {loadState === "ready" && !visibleOptions.length && (
          <p className="m-0 text-base text-(--t-ink-dim)">{w("noSections")}</p>
        )}
        {loadState === "ready" &&
          visibleOptions.map((o) => {
            const on = sections.includes(o.key)
            const home = multi && on && sections[0] === o.key

            return inherited ? (
              <span
                key={o.key}
                className="inline-flex min-h-9 items-center gap-2 rounded-full bg-(--t-bg-muted) px-3 py-1.5 text-sm font-medium"
              >
                {o.label}
                {home && (
                  <span className="font-semibold text-(--t-accent-primary)">
                    {tUi("home_section")}
                  </span>
                )}
              </span>
            ) : (
              <Chip
                key={o.key}
                on={on}
                disabled={disabled}
                onClick={() => toggle(o.key)}
                badge={home ? tUi("home_section") : undefined}
              >
                {o.label}
              </Chip>
            )
          })}
      </div>
    </section>
  )
}

// ── Tags ───────────────────────────────────────────────────────────────────

const TAG_ICON: Record<ArticleTag["kind"], string> = {
  topic: "mdi:tag-outline",
  library: "mdi:bank-outline",
  continent: "mdi:earth",
  country: "mdi:flag-outline",
  region: "mdi:map-marker-outline",
  area: "mdi:map-marker-outline",
  event: "mdi:calendar-outline",
}

function tagKey(t: ArticleTag) {
  return `${t.kind}:${t.documentId ?? t.slug ?? t.label.toLowerCase()}`
}

export function TagsCard({
  tags,
  locale: contentLocale,
  onChange,
  disabled,
  inherited = false,
}: {
  tags: ArticleTag[]
  locale: string
  onChange: (next: ArticleTag[]) => void
  disabled?: boolean
  inherited?: boolean
}) {
  const tUi = useUiTranslations("ui")
  const tEditor = useUiTranslations("articleEditor")
  const tRelations = useUiTranslations("articleRelations")
  const w = useUiTranslations("writeWorkspace")

  const locale = useLocale()
  const [query, setQuery] = useState("")
  const [topics, setTopics] = useState<ArticleTag[]>([])
  const [libraryHits, setLibraryHits] = useState<ArticleTag[]>([])
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/relations/topics?locale=${encodeURIComponent(contentLocale)}`)
      .then((r) => r.json())
      .then(
        (j: {
          data?: { name?: string; slug?: string; documentId?: string }[]
        }) => {
          if (cancelled) return
          setTopics(
            (j.data ?? []).flatMap((t) =>
              t.name && t.slug
                ? [
                    {
                      kind: "topic" as const,
                      label: t.name,
                      slug: t.slug,
                      documentId: t.documentId,
                    },
                  ]
                : []
            )
          )
        }
      )
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [contentLocale])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    let cancelled = false
    const q = query.trim()
    debounce.current = setTimeout(() => {
      if (q.length < 2) {
        setLibraryHits([])

        return
      }
      searchLibraryNames(q, {
        locale,
        hitsPerPage: 4,
        attributesToRetrieve: ["documentId", "name", "slug", "city"],
      })
        .then((res) => {
          if (cancelled) return
          setLibraryHits(
            res.hits.flatMap((h) =>
              h.documentId
                ? [
                    {
                      kind: "library" as const,
                      label: h.name,
                      slug: h.slug,
                      documentId: h.documentId,
                    },
                  ]
                : []
            )
          )
        })
        .catch(() => {
          if (!cancelled) setLibraryHits([])
        })
    }, 300)

    return () => {
      cancelled = true
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [query, locale])

  const chosen = useMemo(() => new Set(tags.map(tagKey)), [tags])
  const displayTag = (tag: ArticleTag) =>
    tag.kind === "topic"
      ? (topics.find((topic) => tagKey(topic) === tagKey(tag))?.label ??
        tag.label)
      : tag.label
  const q = query.trim().toLowerCase()
  const topicMatches = topics.filter(
    (t) => !chosen.has(tagKey(t)) && (!q || t.label.toLowerCase().includes(q))
  )
  const suggestions: ArticleTag[] = q
    ? [
        ...topicMatches.slice(0, 4),
        ...libraryHits.filter((h) => !chosen.has(tagKey(h))),
      ]
    : topicMatches.slice(0, 3)

  const add = (tag: ArticleTag) => {
    if (disabled || chosen.has(tagKey(tag)) || tags.length >= 20) return
    onChange([...tags, tag])
    setQuery("")
  }
  const remove = (tag: ArticleTag) =>
    onChange(tags.filter((t) => tagKey(t) !== tagKey(tag)))

  return (
    <section aria-labelledby="tags-heading" style={card}>
      <h2 className="type-panel-title" id="tags-heading" style={cardTitle}>
        {w("about")}{" "}
      </h2>
      <p style={cardHint}>{inherited ? w("inherited") : tRelations("lead")}</p>
      {inherited && tags.length === 0 && (
        <p className="mt-4 mb-0 text-base text-(--t-ink-dim)">
          {w("noRelations")}
        </p>
      )}
      {tags.length > 0 && (
        <ul className="m-0 mt-4 flex list-none flex-wrap gap-2 p-0">
          {tags.map((tag) => (
            <li key={tagKey(tag)} className="max-w-full">
              <span
                className={`${chipBase} max-w-full`}
                style={{
                  background: T.accent.chip,
                  color: T.accent.primary,
                  border: `1px solid ${T.accent.chip}`,
                }}
              >
                <Icon
                  icon={TAG_ICON[tag.kind]}
                  width={15}
                  aria-hidden="true"
                  className="shrink-0"
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {displayTag(tag)}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    aria-label={tEditor("removeTag", { tag: displayTag(tag) })}
                    onClick={() => remove(tag)}
                    className="ml-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-white/60"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    <Icon icon="mdi:close" width={14} aria-hidden="true" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <>
          <ArticlePlacePicker locale={contentLocale} onAdd={add} />
          <div className="mt-6 grid min-w-0 gap-3 border-t border-(--t-border-line) pt-6">
            <h3 className="type-small-heading m-0">
              {tRelations("topicsLibraries")}
            </h3>
            <SearchField
              id="tag-query"
              label={tRelations("search")}
              placeholder={tUi("search")}
              className="min-w-0"
              onClear={() => setQuery("")}
              inputProps={{
                value: query,
                onChange: (e) => setQuery(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    if (suggestions[0] && q) add(suggestions[0])
                  }
                },
                autoComplete: "off",
              }}
            />
            {suggestions.length > 0 && (
              <div className="grid gap-2">
                <p className="m-0 text-base text-(--t-ink-dim)">
                  {tUi("suggested")}
                </p>
                <ul className="m-0 grid list-none gap-2 p-0">
                  {suggestions.map((s) => (
                    <li key={tagKey(s)} className="min-w-0">
                      <Button
                        type="button"
                        variant="surface"
                        size="pill"
                        className="h-auto min-h-11 w-full justify-start gap-2.5 px-3.5 py-2.5 text-left text-base leading-snug whitespace-normal"
                        onClick={() => add(s)}
                        aria-label={tEditor("addTag", { tag: s.label })}
                      >
                        <Icon
                          icon="mdi:plus"
                          width={17}
                          aria-hidden="true"
                          className="shrink-0 text-(--t-accent-primary)"
                        />
                        <span className="min-w-0 [overflow-wrap:anywhere]">
                          {s.label}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

type PlaceKind = "continent" | "country" | "region" | "area"
const PLACE_KINDS: readonly PlaceKind[] = [
  "continent",
  "country",
  "region",
  "area",
]

type PlaceChoice = { documentId: string; name: string }

function ArticlePlacePicker({
  locale,
  onAdd,
}: {
  locale: string
  onAdd: (tag: ArticleTag) => void
}) {
  const tRelations = useUiTranslations("articleRelations")
  const [selected, setSelected] = useState<
    Partial<Record<PlaceKind, PlaceChoice>>
  >({})
  const [options, setOptions] = useState<
    Partial<Record<PlaceKind, PlaceChoice[]>>
  >({})
  const [error, setError] = useState(false)
  const continent = selected.continent?.documentId
  const country = selected.country?.documentId
  const region = selected.region?.documentId
  useEffect(() => {
    let cancelled = false
    const requests: [PlaceKind, string][] = [
      ["continent", "continents"],
      [
        "country",
        `countries${continent ? `&continentDocumentId=${encodeURIComponent(continent)}` : ""}`,
      ],
    ]
    if (country)
      requests.push([
        "region",
        `regions&countryDocumentId=${encodeURIComponent(country)}`,
      ])
    if (region)
      requests.push([
        "area",
        `areas&regionDocumentId=${encodeURIComponent(region)}`,
      ])
    Promise.all(
      requests.map(async ([kind, query]) => {
        const [plural, filters = ""] = query.split("&", 2)
        const response = await fetch(
          `/api/relations/${plural}?locale=${encodeURIComponent(locale)}${filters ? `&${filters}` : ""}`
        )
        if (!response.ok) throw new Error("Places unavailable")
        const json = (await response.json()) as { data?: PlaceChoice[] }

        return [kind, json.data ?? []] as const
      })
    )
      .then((values) => {
        if (cancelled) return
        setOptions(Object.fromEntries(values))
        setError(false)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [locale, continent, country, region])

  return (
    <fieldset className="m-0 mt-6 min-w-0 border-0 p-0">
      <legend className="mb-3 p-0 text-base font-semibold">
        {tRelations("places")}
      </legend>
      <div className="grid gap-4">
        {PLACE_KINDS.filter(
          (kind) =>
            kind === "continent" ||
            kind === "country" ||
            (kind === "region" ? country : region)
        ).map((kind) => (
          <div key={kind} className="grid min-w-0 gap-2">
            <label
              htmlFor={`article-place-${kind}`}
              className="text-sm font-medium text-(--t-ink-dim)"
            >
              {tRelations(kind)}
            </label>
            <SelectField
              id={`article-place-${kind}`}
              label={tRelations(kind)}
              value={selected[kind]?.documentId ?? ""}
              className="min-h-[48px] min-w-0 px-4 text-base font-normal"
              options={[
                {
                  value: "",
                  label: tRelations("choosePlace", { place: tRelations(kind) }),
                },
                ...(options[kind] ?? []).map((place) => ({
                  value: place.documentId,
                  label: place.name,
                })),
              ]}
              onValueChange={(value) => {
                const choice = options[kind]?.find(
                  (place) => place.documentId === value
                )
                const level = PLACE_KINDS.indexOf(kind)
                setSelected((previous) =>
                  Object.fromEntries(
                    PLACE_KINDS.slice(0, level)
                      .flatMap((parent) =>
                        previous[parent] ? [[parent, previous[parent]]] : []
                      )
                      .concat(choice ? [[kind, choice]] : [])
                  )
                )
                if (choice)
                  onAdd({
                    kind,
                    label: choice.name,
                    documentId: choice.documentId,
                  })
              }}
            />
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="mb-0 text-base">
          {tRelations("placeError")}
        </p>
      )}
    </fieldset>
  )
}

/** Event mentions keep a citation after a live event listing has expired. */
export function ArticleEventsCard({
  mentions,
  libraries,
  onChange,
  disabled,
}: {
  mentions: ArticleEventMention[]
  libraries: ArticleTag[]
  onChange: (mentions: ArticleEventMention[]) => void
  disabled?: boolean
}) {
  const tRelations = useUiTranslations("articleRelations")
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [date, setDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [zone, setZone] = useState("UTC")
  const p = useUiTranslations("publishing")
  const [libraryId, setLibraryId] = useState("")
  const [error, setError] = useState("")
  const add = () => {
    if (disabled || !title.trim() || mentions.length >= 10) return
    let citation: URL
    try {
      citation = new URL(url)
      if (!["http:", "https:"].includes(citation.protocol))
        throw new Error("Invalid citation")
    } catch {
      setError(tRelations("invalidSource"))

      return
    }
    let startTime: string | null, endTime: string | null
    try {
      startTime = articleEventTime(date, zone)
      endTime = articleEventTime(endDate, zone)
      if (startTime && endTime && endTime < startTime)
        throw new Error("End before start")
    } catch {
      setError(p("invalidEventTime"))

      return
    }
    onChange([
      ...mentions,
      {
        title: title.trim(),
        url: citation.href,
        startTime,
        endTime,
        timezone: zone,
        libraryDocumentId: libraryId || null,
      },
    ])
    setTitle("")
    setUrl("")
    setDate("")
    setEndDate("")
    setError("")
  }

  return (
    <section aria-labelledby="event-mentions-heading" style={card}>
      <h2
        className="type-panel-title"
        id="event-mentions-heading"
        style={cardTitle}
      >
        {tRelations("eventsHeading")}
      </h2>
      <p style={cardHint}>{tRelations("eventsLead")}</p>
      {mentions.map((mention, index) => (
        <div
          key={
            mention.citationId ??
            `${mention.eventDocumentId ?? mention.title}:${index}`
          }
          className="mt-3 flex items-start justify-between gap-2 rounded-lg border p-3"
          style={{ borderColor: T.border.line }}
        >
          <span>
            {mention.title}
            {mention.startTime ? ` · ${mention.startTime.slice(0, 10)}` : ""}
          </span>
          {!disabled && (
            <button
              type="button"
              aria-label={tRelations("removeEvent", { title: mention.title })}
              onClick={() => onChange(mentions.filter((_, i) => i !== index))}
            >
              {tRelations("remove")}
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <div className="mt-4 grid gap-3 text-sm">
          <label>
            {tRelations("eventName")}
            <input
              className="mt-1 w-full rounded-lg border p-2"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
            />
          </label>
          <label>
            {tRelations("sourceUrl")}
            <input
              type="url"
              className="mt-1 w-full rounded-lg border p-2"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://"
            />
          </label>
          <label>
            {tRelations("eventDate")}
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border p-2"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label>
            {p("eventEnd")}
            <input
              type="datetime-local"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>
          <label>
            {p("eventTimezone")}
            <input
              value={zone}
              onChange={(event) => setZone(event.target.value)}
              placeholder="America/Bogota"
              maxLength={80}
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>
          <label>
            {tRelations("eventLibrary")}
            <select
              className="mt-1 w-full rounded-lg border p-2"
              value={libraryId}
              onChange={(event) => setLibraryId(event.target.value)}
            >
              <option value="">{tRelations("noLibrary")}</option>
              {libraries
                .filter((tag) => tag.kind === "library" && tag.documentId)
                .map((tag) => (
                  <option key={tag.documentId} value={tag.documentId}>
                    {tag.label}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!title.trim() || !url.trim() || mentions.length >= 10}
            onClick={add}
            className="rounded-full border px-4 py-2 font-semibold"
          >
            {tRelations("addEvent")}
          </button>
          {error && (
            <p role="alert" className="m-0">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

// ── Language ───────────────────────────────────────────────────────────────

export function LanguageCard({
  mode,
  locale,
  locales,
  sourceLocale,
  availableLocales,
  allowedLocales,
  onChange,
  disabled,
  inline = false,
}: {
  mode: "new" | "edit"
  locale: string
  locales: ArticleLocale[]
  sourceLocale: string
  availableLocales: string[]
  allowedLocales?: readonly string[]
  onChange: (code: string) => void
  disabled?: boolean
  inline?: boolean
}) {
  const tUi = useUiTranslations("ui")
  const tLanguage = useUiTranslations("translation")
  const displayLocale = useLocale()
  const w = useUiTranslations("writeWorkspace")

  if (locales.length < 2) return null
  const translating = locale !== sourceLocale
  const nameOf = (code: string) => languageName(code, locales, displayLocale)

  const options = locales.map((l) => ({
    value: l.code,
    disabled: allowedLocales !== undefined && !allowedLocales.includes(l.code),
    label: `${nameOf(l.code)}${mode !== "edit" ? "" : l.code === sourceLocale ? ` · ${tLanguage("original")}` : availableLocales.includes(l.code) ? ` · ${tLanguage("translated")}` : ` · ${tLanguage("addTranslation")}`}`,
  }))

  return inline ? (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-(--t-ink-dim)">
        {w("articleLanguage")}
      </span>
      <SelectField
        id="article-locale"
        label={w("articleLanguage")}
        appearance="pill"
        value={locale}
        onValueChange={onChange}
        options={options}
        disabled={disabled}
      />
    </div>
  ) : (
    <section aria-labelledby="language-heading" style={card}>
      <h2 className="type-panel-title" id="language-heading" style={cardTitle}>
        {tUi("language")}
      </h2>
      <p style={cardHint}>
        {mode === "new"
          ? tLanguage("writingLanguage")
          : translating
            ? tLanguage("translateSource", { language: nameOf(sourceLocale) })
            : tLanguage("chooseLanguage")}
      </p>
      <div className="mt-4">
        <SelectField
          id="article-locale"
          label={tUi("language")}
          value={locale}
          onValueChange={onChange}
          options={options}
          disabled={disabled}
        />
      </div>
    </section>
  )
}

// ── Edit summary ───────────────────────────────────────────────────────────

export function EditSummaryCard({
  value,
  onChange,
  disabled,
  embedded = false,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  embedded?: boolean
}) {
  const tUi = useUiTranslations("ui")

  return (
    <section
      aria-labelledby="summary-heading"
      style={embedded ? undefined : card}
    >
      <h2 className="type-panel-title" id="summary-heading" style={cardTitle}>
        {tUi("what_changed")}{" "}
        <span style={{ color: "var(--tint-special-fg)", fontWeight: 500 }}>
          {tUi("required")}{" "}
        </span>
      </h2>
      <p style={cardHint}>
        {tUi("one_line_for_the_reviewer_and_the_article_s_history")}{" "}
      </p>
      <label htmlFor="edit-summary" className="sr-only">
        {tUi("edit_summary")}{" "}
      </label>
      <textarea
        rows={2}
        id="edit-summary"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={tUi("eg_updated_the_openinghours_guidance")}
        maxLength={200}
        className="mt-4 w-full"
        style={{
          minHeight: 80,
          padding: "10px 14px",
          borderRadius: 14,
          border: `1px solid ${T.border.hi}`,
          background: T.bg.deep,
          color: T.ink.base,
          fontFamily: T.font.sans,
          fontSize: "var(--type-body-size)",
          boxSizing: "border-box",
        }}
      />
    </section>
  )
}

// ── How editing works ──────────────────────────────────────────────────────

export function HowEditingWorks({
  publishesDirectly,
}: {
  publishesDirectly: boolean
}) {
  const tUi = useUiTranslations("ui")

  return (
    <aside
      aria-label={tUi("how_editing_works")}
      className="rounded-[20px] px-6 py-5"
      style={{ background: "var(--tint-national-bg)" }}
    >
      <p
        className="m-0 mb-2 text-base font-bold"
        style={{ color: "var(--tint-national-fg)" }}
      >
        {tUi("how_editing_works")}{" "}
      </p>
      <p className="m-0 text-base leading-[1.6]" style={{ color: T.ink.base }}>
        {publishesDirectly
          ? tUi(
              "editors_review_every_change_before_its_published_as_an_editor_your_approved_changes_go_live_at_once"
            )
          : tUi(
              "editors_review_every_change_before_its_published_approved_changes_are_staged_for_an_editor_to_publish_and_each_contributor_is_credited"
            )}{" "}
        {tUi("published_articles_keep_their_revision_history")}{" "}
      </p>
    </aside>
  )
}
