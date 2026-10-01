"use client"

import { Icon } from "@iconify/react"
import { useLocale } from "next-intl"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  ARTICLE_KIND_META,
  type ArticleKind,
} from "@/components/contribute/article-editor/article.types"
import { SearchField } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import { searchBlogArticles, searchWikiArticles } from "@/lib/meilisearch"
import { Link } from "@/lib/navigation"

export type EditableArticle = {
  kind: ArticleKind
  documentId: string
  slug: string
  title: string
  /** Section names, home first. */
  sections: string[]
  publishedAt: string | null
  updatedAt: string | null
  contributorCount: number
}

export type ArticleDraftSummary = {
  kind: ArticleKind
  documentId: string
  title: string
  /** Slug of the article being edited, or null for a new one. */
  targetSlug: string | null
  updatedAt: string
}

const KINDS: { id: ArticleKind; title: string; blurb: string }[] = [
  {
    id: "knowledge",
    title: "Knowledge article",
    blurb:
      "A guide or reference page for the Knowledge section. Tag it to one or more sections.",
  },
  {
    id: "journal",
    title: "Journal article",
    blurb: "A story, interview or piece of news from the library community.",
  },
]

function formatDate(iso: string | null) {
  if (!iso) return null

  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function KindBadge({ kind }: { kind: ArticleKind }) {
  const meta = ARTICLE_KIND_META[kind]

  return (
    <span
      className="rounded-full px-2.5 py-1 text-[12.5px] font-semibold"
      style={{ background: meta.tintBg, color: meta.tintFg }}
    >
      {kind === "journal" ? "Journal" : "Knowledge"}
    </span>
  )
}

function ArticleRow({ article }: { article: EditableArticle }) {
  const meta = ARTICLE_KIND_META[article.kind]
  const updated = formatDate(article.updatedAt)
  const status =
    article.kind === "journal"
      ? ["Journal", article.sections[0], formatDate(article.publishedAt)]
      : [
          "Published",
          updated
            ? `edited ${updated}${
                article.contributorCount > 1
                  ? ` by ${article.contributorCount} people`
                  : ""
              }`
            : null,
        ]

  return (
    <li>
      <Link
        href={meta.editPath(article.slug)}
        className="group block rounded-[18px] px-5 py-4 no-underline transition-colors hover:border-(--t-accent-primary)"
        style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <KindBadge kind={article.kind} />
          {article.sections.map((s) => (
            <span
              key={s}
              className="rounded-full px-2.5 py-1 text-[12.5px] font-semibold"
              style={{ background: T.bg.muted, color: T.ink.dim }}
            >
              {s}
            </span>
          ))}
        </span>
        <span
          className="mt-2.5 block"
          style={{
            fontFamily: T.font.serif,
            fontSize: "24px",
            fontWeight: 500,
            lineHeight: 1.2,
            color: T.ink.base,
          }}
        >
          {article.title}
        </span>
        <span
          className="mt-1.5 block text-[14.5px]"
          style={{ color: T.ink.dim }}
        >
          {status.filter(Boolean).join(" · ")}
        </span>
      </Link>
    </li>
  )
}

export function KnowledgeEditorLanding({
  articles,
  drafts,
  initialKind,
  canWriteJournal,
}: {
  readonly articles: EditableArticle[]
  readonly drafts: ArticleDraftSummary[]
  readonly initialKind: ArticleKind
  /** Journal editors see Journal first; everyone can pitch a story. */
  readonly canWriteJournal: boolean
}) {
  const locale = useLocale()
  const [kind, setKind] = useState<ArticleKind>(initialKind)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<
    | {
        kind: ArticleKind
        slug: string
        title: string
        section: string | null
      }[]
    | null
  >(null)
  const [loading, setLoading] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    const q = query.trim()
    debounce.current = setTimeout(() => {
      if (q.length < 2) {
        setHits(null)
        setLoading(false)

        return
      }
      setLoading(true)
      Promise.all([
        searchWikiArticles(q, null, 8, locale),
        searchBlogArticles(q, 8, locale),
      ])
        .then(([wiki, blog]) =>
          setHits([
            ...wiki.hits.map((h) => ({
              kind: "knowledge" as const,
              slug: h.slug,
              title: h.title ?? h.slug,
              section: h.section_name ?? null,
            })),
            ...blog.hits.map((h) => ({
              kind: "journal" as const,
              slug: h.slug,
              title: h.title ?? h.slug,
              section: h.section_slug ?? null,
            })),
          ])
        )
        .catch(() => setHits([]))
        .finally(() => setLoading(false))
    }, 300)

    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [query, locale])

  const bySlug = useMemo(
    () => new Map(articles.map((a) => [`${a.kind}:${a.slug}`, a])),
    [articles]
  )
  const results: EditableArticle[] | null = hits
    ? hits.map(
        (h) =>
          bySlug.get(`${h.kind}:${h.slug}`) ?? {
            kind: h.kind,
            documentId: h.slug,
            slug: h.slug,
            title: h.title,
            sections: h.section ? [h.section] : [],
            publishedAt: null,
            updatedAt: null,
            contributorCount: 0,
          }
      )
    : null
  const PAGE = 5
  const all = results ?? articles
  const list = showAll || results ? all : all.slice(0, PAGE)
  const hidden = all.length - list.length
  const startHref = `/contribute/knowledge/new?type=${kind}`

  return (
    <main className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8 lg:py-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-10">
        {/* Write something new */}
        <section
          aria-labelledby="write-new-heading"
          className="self-start rounded-[24px] p-6 sm:p-8 lg:p-10"
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.line}`,
          }}
        >
          <p
            className="m-0 text-[15px] font-semibold"
            style={{ color: T.accent.primary }}
          >
            Write something new
          </p>
          <h2
            id="write-new-heading"
            className="m-0 mt-2"
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(36px,4.5vw,56px)",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: T.ink.base,
            }}
          >
            What are you writing?
          </h2>

          <div
            role="radiogroup"
            aria-label="Article type"
            className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            {KINDS.map((option) => {
              const on = kind === option.id
              const meta = ARTICLE_KIND_META[option.id]

              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setKind(option.id)}
                  className="flex flex-col items-start gap-3 rounded-[20px] text-left transition-colors hover:border-(--t-accent-primary)"
                  style={{
                    border: on
                      ? `2px solid ${T.accent.primary}`
                      : `1px solid ${T.border.line}`,
                    padding: on ? 19 : 20,
                    background: on ? "#F7F6FE" : T.bg.deep,
                    cursor: "pointer",
                    fontFamily: T.font.sans,
                  }}
                >
                  <span className="flex w-full items-start justify-between">
                    <span
                      aria-hidden="true"
                      className="flex size-11 items-center justify-center rounded-full"
                      style={{ background: meta.tintBg, color: meta.tintFg }}
                    >
                      <Icon icon={meta.icon} width={20} />
                    </span>
                    <span
                      aria-hidden="true"
                      className="flex size-6 items-center justify-center rounded-full"
                      style={
                        on
                          ? { background: T.accent.primary, color: "#fff" }
                          : { border: `2px solid ${T.border.hi}` }
                      }
                    >
                      {on && <Icon icon="mdi:check-bold" width={14} />}
                    </span>
                  </span>
                  <span
                    className="text-[18px] font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    {option.title}
                  </span>
                  <span
                    className="text-[15px] leading-[1.5]"
                    style={{ color: T.ink.dim }}
                  >
                    {option.blurb}
                    {option.id === "journal" && !canWriteJournal
                      ? " Editors review pitches before they’re published."
                      : ""}
                  </span>
                </button>
              )
            })}
          </div>

          <Link
            href={startHref}
            className="mt-7 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
            style={{ background: T.accent.primary }}
          >
            <Icon icon="mdi:plus" width={18} aria-hidden="true" />
            Start a new {kind === "journal" ? "journal" : "knowledge"} article
          </Link>

          {drafts.length > 0 && (
            <div
              className="mt-8 border-t pt-6"
              style={{ borderColor: T.border.divider }}
            >
              <p
                className="m-0 mb-3 text-[15px] font-semibold"
                style={{ color: T.ink.base }}
              >
                Your unsent drafts
              </p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {drafts.map((d) => {
                  const meta = ARTICLE_KIND_META[d.kind]
                  const href = d.targetSlug
                    ? meta.editPath(d.targetSlug)
                    : `/contribute/knowledge/new?type=${d.kind}&draft=${encodeURIComponent(d.documentId)}`

                  return (
                    <li key={d.documentId}>
                      <Link
                        href={href}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] px-4 py-3 no-underline transition-colors hover:bg-(--t-bg-surface)"
                        style={{ border: `1px solid ${T.border.line}` }}
                      >
                        <span className="flex items-center gap-2">
                          <KindBadge kind={d.kind} />
                          <span
                            className="text-[15px] font-semibold"
                            style={{ color: T.ink.base }}
                          >
                            {d.title || "Untitled draft"}
                          </span>
                        </span>
                        <span
                          className="text-[13.5px]"
                          style={{ color: T.ink.dim }}
                        >
                          saved {formatDate(d.updatedAt)} · Continue →
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>

        {/* Edit existing */}
        <section aria-labelledby="edit-existing-heading" className="min-w-0">
          <p
            className="m-0 text-[15px] font-semibold"
            style={{ color: T.accent.primary }}
          >
            Or improve what’s there
          </p>
          <h2
            id="edit-existing-heading"
            className="m-0 mt-2 mb-5"
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(28px,3.4vw,40px)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
              color: T.ink.base,
            }}
          >
            Edit an existing article
          </h2>
          <SearchField
            id="article-search"
            placeholder="Search knowledge and journal"
            loading={loading}
            inputRef={inputRef}
            onClear={() => setQuery("")}
            inputProps={{
              value: query,
              onChange: (e) => setQuery(e.target.value),
              autoComplete: "off",
            }}
          />
          <p aria-live="polite" className="sr-only">
            {results
              ? `${results.length} result${results.length === 1 ? "" : "s"}`
              : ""}
          </p>
          {list.length > 0 ? (
            <>
              <ul className="m-0 mt-5 flex list-none flex-col gap-2.5 p-0">
                {list.map((article) => (
                  <ArticleRow
                    key={`${article.kind}:${article.slug}`}
                    article={article}
                  />
                ))}
              </ul>
              {hidden > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-muted-2)"
                  style={{
                    border: `1px solid ${T.border.hi}`,
                    background: T.bg.deep,
                    color: T.ink.base,
                    cursor: "pointer",
                    fontFamily: T.font.sans,
                  }}
                >
                  Show {hidden} more
                  <Icon icon="mdi:chevron-down" width={16} aria-hidden="true" />
                </button>
              )}
            </>
          ) : (
            <p className="mt-6 text-[15px]" style={{ color: T.ink.dim }}>
              {results
                ? `Nothing matches “${query.trim()}”.`
                : "No articles published yet."}
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
