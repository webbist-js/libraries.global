import { useTranslations, type Locale } from "next-intl"

import { JournalArticleRow } from "@/components/blog/JournalCards"
import {
  DEFAULT_JOURNAL_QUERY,
  journalHref,
  type JournalQuery,
} from "@/components/blog/journalLanding.helpers"
import GlobalLink from "@/components/global/GlobalLink"
import type { JournalCardData } from "@/lib/journal-landing"

export function JournalDataDrops({
  articles,
  locale,
  query = DEFAULT_JOURNAL_QUERY,
  total,
}: {
  readonly articles: readonly JournalCardData[]
  readonly total?: number
  readonly query?: JournalQuery
  readonly locale: Locale
}) {
  const t = useTranslations("editorial"),
    ui = useTranslations("ui")
  if (!articles.length) return null

  return (
    <section
      className="journal-data-drops"
      aria-labelledby="journal-data-drops"
    >
      <div className="journal-section-heading">
        <div>
          <h2 id="journal-data-drops" className="type-small-heading">
            {t("dataDrops")}
          </h2>
          <p>{t("dataDropsLead")}</p>
        </div>
        <GlobalLink
          href={journalHref(
            query,
            {
              section: "data",
              filters: { ...query.filters, origins: ["index"] },
              allOrigins: false,
              saved: false,
            },
            "all-articles"
          )}
        >
          {ui("view_all")}
          {total ? ` · ${total}` : ""}
        </GlobalLink>
      </div>
      <div>
        {articles.slice(0, 4).map((article) => (
          <JournalArticleRow
            dataDrop
            key={`${article.documentId}:${article.locale}`}
            article={article}
            locale={locale}
          />
        ))}
      </div>
    </section>
  )
}
