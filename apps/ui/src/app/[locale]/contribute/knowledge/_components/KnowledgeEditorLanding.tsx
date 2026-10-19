"use client"

import { Icon } from "@iconify/react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import {
  ARTICLE_KIND_META,
  type ArticleKind,
  type ArticleLocale,
} from "@/components/contribute/article-editor/article.types"
import { Badge } from "@/components/ds/Badge"
import { EmptyState } from "@/components/ds/EmptyState"
import { SearchField } from "@/components/ds/SearchField"
import { SegmentedControl } from "@/components/ds/SegmentedControl"
import { SelectField } from "@/components/ds/SelectField"
import { Button, buttonVariants } from "@/components/ui/button"
import { useCapabilities } from "@/lib/access-client"
import { articleReaderPath } from "@/lib/article-content-language"
import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"
import { cn } from "@/lib/styles"
import { useJournalOwnership } from "@/lib/use-journal-ownership"

import {
  fetchCatalogue,
  fetchOwnCatalogue,
  uniqueArticles,
  type EditableArticle,
} from "./article-catalogue"

export type { EditableArticle } from "./article-catalogue"

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
const DEFAULT_LOCALES: ArticleLocale[] = [
  { code: "en", name: "English", isDefault: true },
]
const SURFACE =
  "rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep)"
type CatalogueFilter = "all" | ArticleKind | "mine"

export function KnowledgeEditorLanding({
  articles,
  drafts,
  initialKind: _initialKind,
  kinds,
  creatableKinds = kinds,
  locales = DEFAULT_LOCALES,
  initialLocale,
  initialFilter,
  initialTotal,
  initialPageCount = 1,
  initialFailed = false,
}: {
  readonly articles: EditableArticle[]
  readonly drafts: ArticleDraftSummary[]
  readonly initialKind: ArticleKind
  readonly kinds: readonly ArticleKind[]
  readonly creatableKinds?: readonly ArticleKind[]
  readonly locales?: ArticleLocale[]
  readonly initialFilter?: ArticleKind
  readonly initialLocale?: string
  readonly initialTotal?: number
  readonly initialPageCount?: number
  readonly initialFailed?: boolean
}) {
  const p = useTranslations("publishing")
  const w = useTranslations("writeWorkspace")
  const ui = useTranslations("ui")
  const locale = useLocale()
  const caps = useCapabilities()
  const [contentLanguage, setContentLanguage] = useState(
    locales.some((item) => item.code === initialLocale)
      ? initialLocale!
      : locales.some((item) => item.code === locale)
        ? locale
        : (locales[0]?.code ?? locale)
  )
  const [filter, setFilter] = useState<CatalogueFilter>(initialFilter ?? "all")
  const [query, setQuery] = useState("")
  const [missing, setMissing] = useState(false)
  const [visible, setVisible] = useState(8)
  const [retry, setRetry] = useState(0)
  const key = JSON.stringify([
    query.trim(),
    contentLanguage,
    filter,
    missing,
    retry,
  ])
  const originalKey = useRef(key)
  const currentKey = useRef(key)
  const [result, setResult] = useState(() => ({
    key,
    items: uniqueArticles(
      initialFilter
        ? articles.filter((article) => article.kind === initialFilter)
        : articles,
      contentLanguage
    ),
    total: initialTotal ?? uniqueArticles(articles, contentLanguage).length,
    page: 1,
    pageCount: initialPageCount,
  }))
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(initialFailed)
  const [loadingMore, setLoadingMore] = useState(false)
  const selectedKinds =
    filter === "journal" || filter === "knowledge" ? [filter] : kinds
  useEffect(() => {
    currentKey.current = key
    if (key === originalKey.current && !initialFailed && result.key === key)
      return
    const controller = new AbortController()
    setFailed(false)
    setLoading(true)
    setVisible(8)
    setLoadingMore(false)
    const timer = setTimeout(() => {
      const browse = filter === "mine" ? fetchOwnCatalogue : fetchCatalogue
      browse({
        kinds: selectedKinds,
        locale: contentLanguage,
        query: query.trim(),
        missing,
        page: 1,
        known: articles,
        signal: controller.signal,
      })
        .then((data) => {
          if (!controller.signal.aborted) setResult({ key, ...data })
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
    // The request key contains every user-controlled query input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, articles, kinds])
  const list = result.key === key ? result.items : []
  const ownership = useJournalOwnership(
    list
      .filter(
        (article) => article.kind === "journal" && article.owned === undefined
      )
      .map((article) => article.slug)
  )
  const shown =
    filter === "mine"
      ? list.filter(
          (article) =>
            article.kind === "journal" &&
            (article.owned || ownership.eligibility[article.slug])
        )
      : list
  const busy = loading || (result.key !== key && !failed)
  const contentName = languageName(contentLanguage, locales, locale)
  async function showMore() {
    if (visible < shown.length) {
      setVisible((value) => value + 8)

      return
    }
    setLoadingMore(true)
    try {
      const browse = filter === "mine" ? fetchOwnCatalogue : fetchCatalogue
      const data = await browse({
        kinds: selectedKinds,
        locale: contentLanguage,
        query: query.trim(),
        missing,
        page: result.page + 1,
        known: articles,
      })
      if (currentKey.current === key) {
        setResult((prior) => ({
          key,
          ...data,
          items: uniqueArticles(
            [...prior.items, ...data.items],
            contentLanguage
          ),
        }))
        setVisible((value) => value + 8)
      }
    } catch {
      if (currentKey.current === key) setFailed(true)
    } finally {
      if (currentKey.current === key) setLoadingMore(false)
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-[1360px] gap-10 px-4 py-8 sm:px-8 lg:py-10">
      <section aria-labelledby="start-writing" className="grid gap-4">
        <h2
          id="start-writing"
          className="m-0 font-serif text-[32px] leading-tight font-medium"
        >
          {w("startNew")}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {kinds.map((kind) => {
            const meta = ARTICLE_KIND_META[kind]
            const canCreate = creatableKinds.includes(kind)

            return (
              <article
                key={kind}
                className={cn(
                  SURFACE,
                  "flex min-w-0 items-start gap-4 p-5 sm:p-6"
                )}
              >
                <span
                  aria-hidden
                  className="flex size-12 shrink-0 items-center justify-center rounded-full"
                  style={{ background: meta.tintBg, color: meta.tintFg }}
                >
                  <Icon icon={meta.icon} width={23} />
                </span>
                <div className="flex min-w-0 flex-col items-start gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="m-0 text-[19px] font-semibold">
                      {p(
                        kind === "journal" ? "journalStory" : "knowledgeArticle"
                      )}
                    </h3>
                    <Badge
                      label={kind === "journal" ? w("anyone") : w("editors")}
                      color="dim"
                    />
                  </div>
                  <p className="m-0 text-[15px] leading-relaxed text-(--t-ink-dim)">
                    {p(
                      kind === "journal" ? "journalChoice" : "knowledgeChoice"
                    )}
                  </p>
                  <Link
                    href={
                      canCreate
                        ? `/contribute/knowledge/new?type=${kind}&locale=${encodeURIComponent(contentLanguage === "all" ? (initialLocale ?? locale) : contentLanguage)}`
                        : "/contribute/knowledge/apply?role=wiki_editor"
                    }
                    className={cn(
                      buttonVariants({
                        variant: canCreate ? "primary" : "surface",
                        size: "pill",
                      })
                    )}
                  >
                    {canCreate
                      ? w(
                          kind === "journal" ? "startJournal" : "startKnowledge"
                        )
                      : p("applyEditor")}
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      </section>
      {!!drafts.length && (
        <section
          className={cn(SURFACE, "p-5 sm:p-6")}
          aria-label={p("yourDrafts")}
        >
          <details open={filter === "mine" || undefined}>
            <summary className="cursor-pointer text-[17px] font-semibold">
              {p("yourDrafts")}{" "}
              <span className="ml-2 text-(--t-ink-dim)">{drafts.length}</span>
            </summary>
            <ul className="mt-4 mb-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
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
                    <Link
                      href={href}
                      className="block rounded-2xl border border-(--t-border-line) p-4 text-(--t-ink-base) no-underline hover:border-(--t-accent-primary)"
                    >
                      <strong className="block">
                        {draft.title || p("untitledDraft")}
                      </strong>
                      <span className="mt-2 block text-[14px] text-(--t-ink-dim)">
                        {languageName(draft.locale ?? locale, locales, locale)}{" "}
                        ·{" "}
                        {p(
                          draft.status === "pending"
                            ? "inReview"
                            : draft.status === "needs_info"
                              ? "needsYou"
                              : "drafts"
                        )}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </details>
        </section>
      )}
      <section
        aria-labelledby="improve-writing"
        className="grid min-w-0 gap-4"
        aria-busy={busy}
      >
        <header>
          <h2
            id="improve-writing"
            className="m-0 font-serif text-[32px] leading-tight font-medium"
          >
            {w("improveExisting")}
          </h2>
          <p className="mt-2 mb-0 text-[16px] text-(--t-ink-dim)">
            {w("oneRow")}
          </p>
        </header>
        <div className={cn(SURFACE, "flex flex-wrap items-center gap-3 p-3")}>
          <SearchField
            id="writing-search"
            placeholder={w("search")}
            className="min-w-0 flex-[1_1_280px]"
            inputProps={{
              value: query,
              onChange: (e) => setQuery(e.target.value),
              maxLength: 120,
            }}
            onClear={() => setQuery("")}
          />
          <SegmentedControl
            label={ui("article_type")}
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: w("all") },
              ...kinds.map((value) => ({
                value,
                label: ui(value === "journal" ? "journal" : "knowledge"),
              })),
              { value: "mine", label: w("myStories") },
            ]}
          />
          <SelectField
            label={w("articleLanguage")}
            appearance="pill"
            value={contentLanguage}
            onValueChange={(value) => {
              setContentLanguage(value)
              if (value === "all") setMissing(false)
            }}
            options={[
              ...locales.map((item) => ({
                value: item.code,
                label: languageName(item.code, locales, locale),
              })),
              { value: "all", label: w("everyLanguage") },
            ]}
          />
          {contentLanguage !== "all" && (
            <Button
              variant="surface"
              size="pill"
              aria-pressed={missing}
              className={
                missing
                  ? "border-(--t-accent-primary) bg-(--t-accent-chip) text-(--t-accent-primary)"
                  : undefined
              }
              onClick={() => setMissing((value) => !value)}
            >
              {w("missing", { language: contentName })}
            </Button>
          )}
        </div>
        <p role="status" className="m-0 text-[15px] text-(--t-ink-dim)">
          {busy
            ? p("loadingWork")
            : failed
              ? ""
              : filter === "mine"
                ? w("myStories")
                : w("articleCount", { count: result.total })}
        </p>
        {failed && (
          <div
            role="alert"
            className={cn(
              SURFACE,
              "flex flex-wrap items-center justify-between gap-3 p-5"
            )}
          >
            <p className="m-0 text-[15px]">{p("workFailed")}</p>
            <Button
              variant="surface"
              size="pill"
              onClick={() => setRetry((value) => value + 1)}
            >
              {ui("try_again")}
            </Button>
          </div>
        )}
        {ownership.failed && (
          <Button
            variant="surface"
            size="pill"
            className="justify-self-start"
            onClick={ownership.retry}
          >
            {p("ownershipRetry")}
          </Button>
        )}
        {busy && (
          <div aria-hidden className="grid gap-3">
            {[0, 1, 2].map((n) => (
              <div
                key={n}
                className="h-28 rounded-[24px] bg-(--t-bg-muted) motion-safe:animate-pulse"
              />
            ))}
          </div>
        )}
        {!busy && (
          <ul
            className={cn(
              SURFACE,
              "m-0 grid list-none divide-y divide-(--t-border-line) p-0"
            )}
          >
            {shown.slice(0, visible).map((article) => {
              const source = article.locale ?? locale
              const target =
                contentLanguage === "all" ? source : contentLanguage
              const absent = !(
                article.translations ?? [{ locale: source }]
              ).some((item) => item.locale === target)
              const owner =
                article.owned || ownership.eligibility[article.slug] === true
              const canEdit =
                (!absent && article.canEdit) ||
                (caps.ready &&
                  caps.canDirectEdit(
                    article.kind === "journal" ? "journal" : "docs",
                    target
                  )) ||
                (article.kind === "journal" && owner)
              const edit = `${ARTICLE_KIND_META[article.kind].editPath(article.slug)}?locale=${encodeURIComponent(canEdit ? target : source)}&sourceLocale=${encodeURIComponent(source)}`
              const href = canEdit
                ? edit
                : article.kind === "knowledge"
                  ? `${edit}&mode=report`
                  : articleReaderPath(
                      article.publicPath ?? `/journal/general/${article.slug}`,
                      locale,
                      source
                    )

              return (
                <li
                  key={`${article.kind}:${article.documentId}`}
                  className="flex min-w-0 flex-wrap items-center gap-4 p-5 sm:p-6"
                >
                  <div className="min-w-0 flex-[1_1_340px]">
                    <div className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-(--t-ink-dim)">
                      <span
                        style={{
                          color: ARTICLE_KIND_META[article.kind].tintFg,
                        }}
                      >
                        {ui(
                          article.kind === "journal" ? "journal" : "knowledge"
                        )}
                      </span>
                      <span aria-hidden>·</span>
                      <span>{article.sections.join(" · ")}</span>
                      {owner && <Badge label={w("yourStory")} color="aurora" />}
                    </div>
                    <h3
                      lang={source}
                      className="my-2 font-serif text-[23px] leading-tight font-medium [overflow-wrap:anywhere]"
                    >
                      {article.title}
                    </h3>
                    {absent && (
                      <p className="m-0 text-[14px] text-(--t-ink-dim)">
                        {w("fallback", {
                          language: contentName,
                          source: languageName(source, locales, locale),
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-[1_1_400px] flex-wrap items-center justify-between gap-3 lg:flex-initial lg:justify-end">
                    <div
                      className="flex flex-wrap gap-1.5"
                      aria-label={w("availableLanguages")}
                    >
                      {(article.translations ?? [{ locale: source }]).map(
                        (item) => (
                          <Badge
                            key={item.locale}
                            label={item.locale.toUpperCase()}
                            color={item.locale === source ? "aurora" : "dim"}
                          />
                        )
                      )}
                    </div>
                    <span className="text-[14px] text-(--t-ink-dim)">
                      {article.updatedAt
                        ? new Date(article.updatedAt).toLocaleDateString(locale)
                        : article.publishedAt
                          ? new Date(article.publishedAt).toLocaleDateString(
                              locale
                            )
                          : p("sourceOnly")}
                    </span>
                    <Link
                      href={href}
                      className={cn(
                        buttonVariants({
                          variant: absent && canEdit ? "primary" : "surface",
                          size: "pill",
                        })
                      )}
                    >
                      {canEdit
                        ? absent
                          ? w("translate", { language: contentName })
                          : owner
                            ? p("editYourStory")
                            : ui("edit")
                        : article.kind === "knowledge"
                          ? p("suggestImprovement")
                          : p("readAndDiscuss")}
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {!busy && !failed && !shown.length && (
          <EmptyState
            headingLevel={3}
            lead={p("noResults")}
            detail={w("clearHint")}
            action={
              <Button
                variant="surface"
                size="pill"
                onClick={() => {
                  setQuery("")
                  setMissing(false)
                  setFilter("all")
                }}
              >
                {w("reset")}
              </Button>
            }
          />
        )}
        {!busy &&
          (visible < shown.length || result.page < result.pageCount) && (
            <Button
              variant="surface"
              size="pill"
              className="justify-self-center"
              disabled={loadingMore}
              onClick={() => void showMore()}
            >
              {loadingMore ? p("loadingWork") : w("showMore")}
            </Button>
          )}
      </section>
    </main>
  )
}
