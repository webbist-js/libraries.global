"use client"

import {
  aggregateArticleBrowse,
  parseArticleBrowseQuery,
  type ArticleBrowseResult,
} from "@repo/shared-data"
import { useQuery } from "@tanstack/react-query"
import { Bookmark, BookmarkCheck } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import {
  JournalArticleCard,
  JournalArticleRow,
} from "@/components/blog/JournalCards"
import {
  JOURNAL_PAGE_SIZE,
  journalBrowseParams,
  journalHref,
  type JournalQuery,
} from "@/components/blog/journalLanding.helpers"
import { JournalPagination } from "@/components/blog/JournalPagination"
import { Button } from "@/components/ui/button"
import { toggleSavedJournal, useSavedJournal } from "@/lib/journal-saved"
import { Link } from "@/lib/navigation"

export function JournalSaveButton({
  documentId,
}: {
  readonly documentId: string
}) {
  const t = useTranslations("editorial"),
    saved = useSavedJournal(),
    [error, setError] = useState(false)
  const selected = saved.includes(documentId),
    Icon = selected ? BookmarkCheck : Bookmark

  return (
    <div className="journal-save-control">
      <Button
        type="button"
        variant="surface"
        size="pill"
        className="text-sm"
        aria-pressed={selected}
        onClick={() => setError(!toggleSavedJournal(documentId))}
      >
        <Icon size={16} aria-hidden />
        {t(selected ? "saved" : "saveForLater")}
      </Button>
      <p role={error ? "alert" : undefined}>
        {t(error ? "savedStorageUnavailable" : "savedOnDevice")}
      </p>
    </div>
  )
}
export function JournalSavedLink({ query }: { readonly query?: JournalQuery }) {
  const t = useTranslations("editorial"),
    ids = useSavedJournal()

  return (
    <Link
      href={journalHref(
        query ?? {
          section: null,
          sort: "newest",
          page: 1,
          view: "grid",
          lang: null,
        },
        { saved: true, page: 1 }
      )}
      aria-current={query?.saved ? "page" : undefined}
    >
      <span>{t("saved")}</span>
      <span>{ids.length || null}</span>
    </Link>
  )
}
/** Resolve IDs through the public browse projection, so withdrawn stories disappear. */
export function JournalSavedArticles({
  query,
}: {
  readonly query: JournalQuery
}) {
  const ids = useSavedJournal(),
    locale = useLocale(),
    t = useTranslations("editorial"),
    ui = useTranslations("ui")
  const key = ids.join(",")
  const result = useQuery({
    queryKey: ["journal-saved", key, locale],
    enabled: Boolean(key),
    retry: false,
    queryFn: async ({ signal }) => {
      const batches = Array.from(
        { length: Math.ceil(ids.length / 20) },
        (_, index) => ids.slice(index * 20, (index + 1) * 20)
      )
      const data = await Promise.all(
        batches.map(async (batch) => {
          const params = new URLSearchParams({
            documentId: batch.join(","),
            lang: "all",
            preferredLocale: locale,
            groupBy: "document",
            pageSize: "50",
          })
          const response = await fetch(
            `/api/public-proxy/api/blog-articles/browse?${params}`,
            { signal }
          )
          if (!response.ok) throw new Error("Saved stories unavailable")

          return response.json() as Promise<ArticleBrowseResult>
        })
      )

      return data.flatMap((item) => item.items)
    },
  })
  const resolved = aggregateArticleBrowse(
    result.data ?? [],
    parseArticleBrowseQuery(
      Object.fromEntries(
        new URLSearchParams(journalBrowseParams(locale, query))
      )
    )
  )

  return (
    <section id="all-articles" aria-labelledby="journal-saved-heading">
      <div className="journal-section-heading">
        <div>
          <h2 id="journal-saved-heading" className="type-small-heading">
            {t("saved")}
          </h2>
          <p>{t("savedOnDevice")}</p>
        </div>
        <Link href="/journal">{ui("view_all")}</Link>
      </div>
      {result.isFetching ? (
        <p role="status">{ui("loading")}</p>
      ) : result.error ? (
        <div role="alert">
          <p>{t("savedUnavailable")}</p>
          <Button
            type="button"
            variant="surface"
            size="pill"
            onClick={() => result.refetch()}
          >
            {ui("retry")}
          </Button>
        </div>
      ) : !resolved.items.length ? (
        <p className="journal-saved-empty">
          {t(ids.length ? "savedNoMatches" : "savedEmpty")}
        </p>
      ) : (
        <div
          className={
            query.view === "list"
              ? "journal-saved-list"
              : "journal-field-notes-grid"
          }
        >
          {resolved.items.map((item) => {
            const Card =
              query.view === "list" ? JournalArticleRow : JournalArticleCard

            return (
              <Card
                key={`${item.documentId}:${item.locale}`}
                article={{ ...item, readMinutes: item.readingTimeMinutes }}
                locale={locale}
              />
            )
          })}
        </div>
      )}
      <JournalPagination
        query={query}
        page={resolved.page}
        pageCount={resolved.pageCount}
        pageSize={JOURNAL_PAGE_SIZE}
        total={resolved.total}
      />
    </section>
  )
}
