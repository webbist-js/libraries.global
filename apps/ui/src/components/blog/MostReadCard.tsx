import { useTranslations, type Locale } from "next-intl"

import { T } from "@/lib/design-tokens"
import type { JournalCardData } from "@/lib/journal-landing"
import { Link } from "@/lib/navigation"

/**
 * The month's most-read articles. Until reads are counted (Vercel Web
 * Analytics) `articles` is empty and the card says so.
 */
export function MostReadCard({
  articles,
  locale,
}: {
  readonly articles: JournalCardData[]
  readonly locale: Locale
}) {
  const t = useTranslations("editorial")

  return (
    <section
      aria-labelledby="journal-most-read"
      className="rounded-[20px] border p-5"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <h2
        className="m-0 text-[15px] font-semibold"
        id="journal-most-read"
        style={{ color: T.ink.base }}
      >
        {t("mostRead")}
      </h2>

      {articles.length === 0 ? (
        <p
          className="m-0 mt-2 text-[14px] leading-[1.5]"
          style={{ color: T.ink.low }}
        >
          {t("mostReadSoon")}
        </p>
      ) : (
        <ol className="m-0 mt-2 list-none p-0">
          {articles.slice(0, 5).map((article, i) => (
            <li
              className="flex gap-3 border-b py-3 last:border-0 last:pb-0"
              key={article.documentId}
              style={{ borderColor: T.border.divider }}
            >
              <span
                aria-hidden="true"
                className="w-4 flex-none text-[20px] leading-none"
                style={{ fontFamily: T.font.serif, color: T.accent.primary }}
              >
                {i + 1}
              </span>
              <span className="min-w-0">
                <Link
                  className="text-[16px] leading-[1.3] transition-colors hover:text-(--t-accent-primary)"
                  href={`/journal/${article.section?.slug ?? "general"}/${article.slug}`}
                  locale={locale}
                  style={{ fontFamily: T.font.serif, color: T.ink.base }}
                >
                  {article.title}
                </Link>
                <span
                  className="mt-0.5 block text-[13px]"
                  style={{ color: T.ink.dim }}
                >
                  {[
                    article.section?.name,
                    t("readingTime", { minutes: article.readMinutes }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
