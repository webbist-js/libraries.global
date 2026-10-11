"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations, useLocale } from "next-intl"
import { useEffect, useMemo, useRef, useState } from "react"

import { T } from "@/lib/design-tokens"
import { languageName } from "@/lib/locale-fallback"
import { searchLibraryNames } from "@/lib/meilisearch"
import { Link } from "@/lib/navigation"

import type { ArticleKind, ArticleLocale, ArticleTag } from "./article.types"

export type SaveState = "idle" | "saving" | "saved" | "error"
export type SubmitState = "idle" | "submitting" | "submitted" | "error"

const card: React.CSSProperties = {
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
  borderRadius: 24,
  padding: 24,
}

const cardTitle: React.CSSProperties = {
  fontFamily: T.font.sans,
  fontSize: 17,
  fontWeight: 700,
  color: T.ink.base,
  margin: 0,
}

const cardHint: React.CSSProperties = {
  fontFamily: T.font.sans,
  fontSize: 14.5,
  color: T.ink.dim,
  margin: "4px 0 0",
  lineHeight: 1.5,
}

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-semibold transition-colors"

function Chip({
  on,
  onClick,
  children,
  badge,
  dashed,
  ariaLabel,
}: {
  on?: boolean
  onClick: () => void
  children: React.ReactNode
  badge?: string
  dashed?: boolean
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
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
          className="rounded-full px-1.5 py-0.5 text-[11.5px] font-bold"
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
}) {
  const tUi = useUiTranslations("ui")
  const tLanguage = useUiTranslations("translation")

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
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="status-heading" style={cardTitle}>
          {title}
        </h2>
        <p
          role="status"
          className="m-0 flex items-center gap-1.5 text-[14px] font-semibold"
          style={{ color: saveColor }}
        >
          <Icon icon={saveIcon} width={16} aria-hidden="true" />
          {saveLabel}
        </p>
      </div>
      <p style={cardHint}>
        {submitted
          ? tUi("in_review_you_cant_edit_it_until_an_editor_replies")
          : publishesDirectly
            ? tUi(
                "not_published_approved_changes_from_editors_publish_straight_away"
              )
            : tUi("not_published_only_you_and_the_editors_can_see_drafts")}
      </p>
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit || submitState === "submitting" || submitted}
        aria-busy={submitState === "submitting"}
        className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full text-[16px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: T.accent.primary,
          border: "none",
          cursor: "pointer",
        }}
      >
        {submitState === "submitting"
          ? tUi("sending")
          : submitted
            ? tUi("sent_for_review")
            : tUi("submit_for_review")}
      </button>
      {submitted && (
        <p
          className="mt-3 mb-0 flex items-start gap-2 rounded-[14px] px-3.5 py-2.5 text-[14.5px]"
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
          className="mt-3 mb-0 rounded-[14px] px-3.5 py-2.5 text-[14.5px] font-semibold"
          style={{ background: "#F6E3DA", color: T.accent.danger }}
        >
          {submitError}
        </p>
      )}
      <p className="mt-3 mb-0 text-[13.5px]" style={{ color: T.ink.low }}>
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
}: {
  kind: ArticleKind
  locale: string
  sections: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  const tUi = useUiTranslations("ui")

  // Section keys stay stable while their labels follow the article language.
  const [options, setOptions] = useState<{ key: string; label: string }[]>([])
  useEffect(() => {
    let cancelled = false
    fetch(
      `/api/relations/${kind === "knowledge" ? "wiki-sections" : "blog-sections"}?locale=${encodeURIComponent(locale)}`
    )
      .then((r) => r.json())
      .then((j: { data?: { slug?: string; name?: string }[] }) => {
        if (cancelled) return
        setOptions(
          (j.data ?? []).flatMap((s) =>
            s.slug && s.name ? [{ key: s.slug, label: s.name }] : []
          )
        )
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [kind, locale])

  const multi = kind === "knowledge"

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
    <section aria-labelledby="sections-heading" style={card}>
      <h2 id="sections-heading" style={cardTitle}>
        {kind === "knowledge"
          ? tUi("knowledge_sections")
          : tUi("journal_section")}{" "}
        <span style={{ color: "var(--tint-special-fg)", fontWeight: 500 }}>
          {tUi("required")}{" "}
        </span>
      </h2>
      <p style={cardHint}>
        {kind === "knowledge"
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
        {options.length === 0 && (
          <p className="m-0 text-[14px]" style={{ color: T.ink.faint }}>
            {tUi("loading_sections")}{" "}
          </p>
        )}
        {options.map((o) => {
          const on = sections.includes(o.key)
          const home = multi && on && sections[0] === o.key

          return (
            <Chip
              key={o.key}
              on={on}
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
  place: "mdi:map-marker-outline",
  free: "mdi:pound",
}

function tagKey(t: ArticleTag) {
  return `${t.kind}:${t.documentId ?? t.slug ?? t.label.toLowerCase()}`
}

export function TagsCard({
  tags,
  locale: contentLocale,
  onChange,
  disabled,
}: {
  tags: ArticleTag[]
  locale: string
  onChange: (next: ArticleTag[]) => void
  disabled?: boolean
}) {
  const tUi = useUiTranslations("ui")
  const tEditor = useUiTranslations("articleEditor")

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
        .then((res) =>
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
        )
        .catch(() => setLibraryHits([]))
    }, 300)

    return () => {
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
  const addFree = () => {
    const label = query.trim()
    if (!label) return
    const topic = topics.find(
      (t) => t.label.toLowerCase() === label.toLowerCase()
    )
    add(topic ?? { kind: "free", label: label.slice(0, 80) })
  }

  return (
    <section aria-labelledby="tags-heading" style={card}>
      <h2 id="tags-heading" style={cardTitle}>
        {tUi("tags")}{" "}
      </h2>
      <p style={cardHint}>{tUi("topics_places_and_libraries_this_is_about")}</p>
      {tags.length > 0 && (
        <ul className="m-0 mt-4 flex list-none flex-wrap gap-2 p-0">
          {tags.map((tag) => (
            <li key={tagKey(tag)}>
              <span
                className={chipBase}
                style={{
                  background: T.accent.chip,
                  color: T.accent.primary,
                  border: `1px solid ${T.accent.chip}`,
                }}
              >
                <Icon icon={TAG_ICON[tag.kind]} width={15} aria-hidden="true" />
                {displayTag(tag)}
                {!disabled && (
                  <button
                    type="button"
                    aria-label={tEditor("removeTag", { tag: displayTag(tag) })}
                    onClick={() => remove(tag)}
                    className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full hover:bg-white/60"
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
          <div className="mt-4 flex gap-2">
            <label htmlFor="tag-query" className="sr-only">
              {tUi("add_a_topic_place_or_library")}{" "}
            </label>
            <input
              id="tag-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (suggestions[0] && q) add(suggestions[0])
                  else addFree()
                }
              }}
              placeholder={tUi("add_a_topic_place_or_library")}
              autoComplete="off"
              style={{
                flex: 1,
                minWidth: 0,
                height: 46,
                padding: "0 14px",
                borderRadius: 14,
                border: `1px solid ${T.border.hi}`,
                background: T.bg.deep,
                color: T.ink.base,
                fontFamily: T.font.sans,
                fontSize: 15,
              }}
            />
            <button
              type="button"
              onClick={addFree}
              disabled={!query.trim()}
              className="inline-flex h-[46px] items-center rounded-full px-4 text-[15px] font-semibold transition-colors hover:bg-(--t-bg-muted-2) disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                border: `1px solid ${T.border.hi}`,
                background: T.bg.deep,
                color: T.ink.base,
                cursor: "pointer",
                fontFamily: T.font.sans,
              }}
            >
              {tUi("add")}{" "}
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[14px]" style={{ color: T.ink.dim }}>
                {tUi("suggested")}{" "}
              </span>
              {suggestions.map((s) => (
                <Chip
                  key={tagKey(s)}
                  dashed
                  onClick={() => add(s)}
                  ariaLabel={tEditor("addTag", { tag: s.label })}
                >
                  <Icon icon="mdi:plus" width={14} aria-hidden="true" />
                  {s.label}
                </Chip>
              ))}
            </div>
          )}
        </>
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
}: {
  mode: "new" | "edit"
  locale: string
  locales: ArticleLocale[]
  sourceLocale: string
  availableLocales: string[]
  allowedLocales?: readonly string[]
  onChange: (code: string) => void
  disabled?: boolean
}) {
  const tUi = useUiTranslations("ui")
  const tLanguage = useUiTranslations("translation")
  const displayLocale = useLocale()

  if (locales.length < 2) return null
  const translating = locale !== sourceLocale
  const nameOf = (code: string) => languageName(code, locales, displayLocale)

  return (
    <section aria-labelledby="language-heading" style={card}>
      <h2 id="language-heading" style={cardTitle}>
        {tUi("language")}{" "}
      </h2>
      <p style={cardHint}>
        {mode === "new"
          ? tLanguage("writingLanguage")
          : translating
            ? tLanguage("translateSource", { language: nameOf(sourceLocale) })
            : tLanguage("chooseLanguage")}
      </p>
      <label htmlFor="article-locale" className="sr-only">
        {tUi("language")}{" "}
      </label>
      <select
        id="article-locale"
        value={locale}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-4 w-full"
        style={{
          height: 46,
          padding: "0 14px",
          borderRadius: 14,
          border: `1px solid ${T.border.hi}`,
          background: T.bg.deep,
          color: T.ink.base,
          fontFamily: T.font.sans,
          fontSize: 15,
        }}
      >
        {locales.map((l) => (
          <option
            key={l.code}
            value={l.code}
            disabled={
              allowedLocales !== undefined && !allowedLocales.includes(l.code)
            }
          >
            {nameOf(l.code)}
            {mode === "edit" && l.code === sourceLocale
              ? ` · ${tLanguage("original")}`
              : mode === "edit" && availableLocales.includes(l.code)
                ? ` · ${tLanguage("translated")}`
                : mode === "edit"
                  ? ` · ${tLanguage("addTranslation")}`
                  : ""}
          </option>
        ))}
      </select>
    </section>
  )
}

// ── Edit summary ───────────────────────────────────────────────────────────

export function EditSummaryCard({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const tUi = useUiTranslations("ui")

  return (
    <section aria-labelledby="summary-heading" style={card}>
      <h2 id="summary-heading" style={cardTitle}>
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
      <input
        id="edit-summary"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={tUi("eg_updated_the_openinghours_guidance")}
        maxLength={200}
        className="mt-4 w-full"
        style={{
          height: 46,
          padding: "0 14px",
          borderRadius: 14,
          border: `1px solid ${T.border.hi}`,
          background: T.bg.deep,
          color: T.ink.base,
          fontFamily: T.font.sans,
          fontSize: 15,
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
        className="m-0 mb-2 text-[16px] font-bold"
        style={{ color: "var(--tint-national-fg)" }}
      >
        {tUi("how_editing_works")}{" "}
      </p>
      <p
        className="m-0 text-[15px] leading-[1.6]"
        style={{ color: T.ink.base }}
      >
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
