"use client"

import type { ArticleBrowseResult } from "@repo/shared-data"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import {
  ARTICLE_KIND_META,
  type ArticleKind,
} from "@/components/contribute/article-editor/article.types"
import { useCapabilities } from "@/lib/access-client"
import { articleReaderPath } from "@/lib/article-content-language"
import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"
import { useJournalOwnership } from "@/lib/use-journal-ownership"

export type EditableArticle = {
  kind: ArticleKind
  documentId: string
  slug: string
  title: string
  sections: string[]
  publishedAt: string | null
  updatedAt: string | null
  locale?: string
  publicPath?: string
  canEdit?: boolean
  contributorCount?: number
}
export type ArticleDraftSummary = {
  kind: ArticleKind
  documentId: string
  title: string
  targetSlug: string | null
  updatedAt: string
  locale?: string | null
  status?: string
  sourceLocale?: string | null
}
export function KnowledgeEditorLanding({
  articles,
  drafts,
  initialKind,
  kinds,
  creatableKinds = kinds,
}: {
  readonly articles: EditableArticle[]
  readonly drafts: ArticleDraftSummary[]
  readonly initialKind: ArticleKind
  readonly kinds: readonly ArticleKind[]
  readonly creatableKinds?: readonly ArticleKind[]
}) {
  const p = useTranslations("publishing")
  const ui = useTranslations("ui")
  const locale = useLocale()
  const caps = useCapabilities()
  const [kind, setKind] = useState(initialKind)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<{
    query: string
    locale: string
    items: EditableArticle[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setFailed(false)
      if (query.trim().length < 2) {
        setLoading(false)

        return
      }
      setLoading(true)
      Promise.all(
        kinds.map(async (targetKind) => {
          const response = await fetch(
            `/api/public-proxy/${targetKind === "journal" ? "blog" : "wiki"}-articles/browse?${new URLSearchParams({ q: query.trim(), pageSize: "20", preferredLocale: locale })}`,
            { signal: controller.signal }
          )
          if (!response.ok) throw new Error("Search unavailable")
          const data = (await response.json()) as ArticleBrowseResult

          return data.items.map(
            (item) =>
              articles.find(
                (article) =>
                  article.kind === targetKind &&
                  article.documentId === item.documentId &&
                  article.locale === item.locale
              ) ?? {
                kind: targetKind,
                documentId: item.documentId,
                title: item.title,
                slug: item.slug,
                locale: item.locale,
                sections:
                  item.facets.sections?.map((section) => section.label) ?? [],
                publishedAt: item.publishedAt,
                updatedAt: item.updatedAt,
                publicPath: `/${targetKind === "journal" ? "journal" : "knowledge"}/${item.section?.slug ?? item.sectionSlugs[0] ?? "general"}/${item.slug}`,
                canEdit: undefined,
              }
          )
        })
      )
        .then((result) => {
          if (!controller.signal.aborted)
            setResults({ query: query.trim(), locale, items: result.flat() })
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailed(true)
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, kinds, locale, articles])
  const list =
    results?.query === query.trim() && results.locale === locale
      ? results.items
      : articles

  const ownership = useJournalOwnership(
    list
      .filter(
        (article) => article.kind === "journal" && article.canEdit === undefined
      )
      .map((article) => article.slug)
  )

  return (
    <main className="mx-auto grid max-w-[1360px] gap-8 px-4 py-6 sm:px-8 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
      <section className="self-start rounded-3xl border bg-(--t-bg-deep) p-6">
        <h2 className="mt-0 font-serif text-3xl">{p("newWriting")}</h2>
        <div
          role="radiogroup"
          aria-label={ui("article_type")}
          className="grid gap-3 sm:grid-cols-2"
        >
          {kinds.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={kind === option}
              onClick={() => setKind(option)}
              className={`rounded-2xl border p-4 text-left ${kind === option ? "border-(--t-accent-primary) bg-(--t-accent-chip)" : ""}`}
            >
              <strong className="block">
                {p(option === "journal" ? "journalStory" : "knowledgeArticle")}
              </strong>
              <span className="mt-2 block text-sm text-(--t-ink-dim)">
                {p(option === "journal" ? "journalChoice" : "knowledgeChoice")}
              </span>
            </button>
          ))}
        </div>
        <Link
          href={
            creatableKinds.includes(kind)
              ? `/contribute/knowledge/new?type=${kind}`
              : `/contribute/knowledge/apply?role=wiki_editor`
          }
          className="mt-5 inline-block rounded-full bg-(--t-accent-primary) px-5 py-3 font-semibold text-white"
        >
          {creatableKinds.includes(kind) ? p("startWriting") : p("applyEditor")}
        </Link>
        {!!drafts.length && (
          <section className="mt-6 border-t pt-4">
            <h3>{p("yourDrafts")}</h3>
            <ul className="grid list-none gap-3 p-0">
              {drafts.map((draft) => {
                const params = new URLSearchParams({
                  draft: draft.documentId,
                  ...(draft.locale ? { locale: draft.locale } : {}),
                  ...(draft.sourceLocale
                    ? { sourceLocale: draft.sourceLocale }
                    : {}),
                })
                const href = draft.targetSlug
                  ? `${ARTICLE_KIND_META[draft.kind].editPath(draft.targetSlug)}?${params}`
                  : `/contribute/knowledge/new?type=${draft.kind}&${params}`

                return (
                  <li key={draft.documentId}>
                    <Link href={href} className="block rounded-xl border p-3">
                      <strong>{draft.title || p("untitledDraft")}</strong>
                      <span className="mt-1 block text-sm text-(--t-ink-dim)">
                        {p(
                          draft.kind === "journal"
                            ? "journalStory"
                            : "knowledgeArticle"
                        )}{" "}
                        ·{" "}
                        {draft.locale
                          ? languageName(draft.locale, [], locale)
                          : ""}{" "}
                        · {new Date(draft.updatedAt).toLocaleDateString(locale)}{" "}
                        ·{" "}
                        {draft.status === "pending"
                          ? p("inReview")
                          : draft.status === "needs_info"
                            ? p("needsYou")
                            : p("drafts")}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </section>
      <section aria-busy={loading}>
        <h2 className="mt-0 font-serif text-3xl">{p("findToImprove")}</h2>
        <label className="block">
          <span className="sr-only">{ui("search_knowledge_and_journal")}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={ui("search_knowledge_and_journal")}
            maxLength={120}
            className="w-full rounded-full border bg-(--t-bg-deep) px-5 py-3"
          />
        </label>
        {loading && <p role="status">{p("loadingWork")}</p>}
        {failed && <p role="alert">{p("workFailed")}</p>}
        {ownership.failed && (
          <button type="button" onClick={ownership.retry} className="underline">
            {p("ownershipRetry")}
          </button>
        )}
        <ul className="mt-5 grid list-none gap-3 p-0">
          {list.map((article) => {
            const canEdit =
              article.canEdit ||
              (caps.ready &&
                caps.canDirectEdit(
                  article.kind === "journal" ? "journal" : "docs",
                  article.locale ?? locale
                )) ||
              (article.kind === "journal" &&
                ownership.eligibility[article.slug] === true)
            const edit = `${ARTICLE_KIND_META[article.kind].editPath(article.slug)}?locale=${encodeURIComponent(article.locale ?? locale)}&sourceLocale=${encodeURIComponent(article.locale ?? locale)}`
            const href = canEdit
              ? edit
              : article.kind === "knowledge"
                ? `${edit}&mode=report`
                : articleReaderPath(
                    article.publicPath ?? `/journal/general/${article.slug}`,
                    locale,
                    article.locale ?? locale
                  )

            return (
              <li
                key={`${article.kind}:${article.documentId}:${article.locale}`}
                className="rounded-2xl border bg-(--t-bg-deep) p-5"
              >
                <div className="text-xs text-(--t-ink-dim)">
                  {p(
                    article.kind === "journal"
                      ? "journalStory"
                      : "knowledgeArticle"
                  )}{" "}
                  · {languageName(article.locale ?? locale, [], locale)} ·{" "}
                  {article.sections.join(" · ")}
                </div>
                <h3 className="my-2 font-serif text-2xl">{article.title}</h3>
                <p className="my-2 text-sm text-(--t-ink-dim)">
                  {article.publishedAt
                    ? p("livePublished", {
                        date: new Date(article.publishedAt).toLocaleDateString(
                          locale
                        ),
                      })
                    : p("sourceOnly")}
                </p>
                <Link href={href} className="underline">
                  {canEdit
                    ? article.kind === "journal" &&
                      ownership.eligibility[article.slug] === true
                      ? p("editYourStory")
                      : ui("edit")
                    : article.kind === "knowledge"
                      ? p("suggestImprovement")
                      : p("readAndDiscuss")}
                </Link>
              </li>
            )
          })}
        </ul>
        {!loading && !failed && !list.length && <p>{p("noResults")}</p>}
      </section>
    </main>
  )
}
