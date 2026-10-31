import type { Data } from "@repo/strapi-types"
import { useLocale, useTranslations } from "next-intl"
import { useId } from "react"

export type JournalSource = Pick<
  Data.Component<"content.article-source">,
  "title" | "url" | "publisher" | "accessedAt" | "notes"
>

/** Curated citations, not a scrape of outbound links in the article body. */
export function JournalSources({
  sources,
  id,
}: {
  readonly sources?: readonly JournalSource[] | null
  readonly id?: string
}) {
  const t = useTranslations("articleSources")
  const locale = useLocale()
  const heading = useId()
  const rows = (sources ?? []).filter(
    (source) => typeof source.title === "string" && source.title.trim()
  )
  if (!rows.length) return null

  return (
    <section
      id={id}
      className="journal-sources record-support-card"
      aria-labelledby={heading}
    >
      <h2 id={heading} className="type-small-heading m-0">
        {t("title")}
      </h2>
      <ol>
        {rows.map((source, index) => {
          let href: string | null = null
          try {
            const parsed = new URL(source.url ?? "")
            if (
              ["https:", "http:"].includes(parsed.protocol) &&
              !parsed.username &&
              !parsed.password
            )
              href = parsed.href
          } catch {
            /* Print-only citations have no URL. */
          }
          const date = source.accessedAt ? new Date(source.accessedAt) : null

          return (
            // eslint-disable-next-line react/no-array-index-key -- Published citations are a read-only ordered list with no row state.
            <li key={`${source.title}:${index}`}>
              <span className="journal-source-number" aria-hidden>
                {index + 1}
              </span>
              <div>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {source.title} ↗
                  </a>
                ) : (
                  <strong>{source.title}</strong>
                )}
                {source.publisher ? <p>{source.publisher}</p> : null}
                {date && Number.isFinite(date.getTime()) ? (
                  <p>
                    {t("accessed", {
                      date: date.toLocaleDateString(locale, {
                        timeZone: "UTC",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      }),
                    })}
                  </p>
                ) : null}
                {source.notes ? <p>{source.notes}</p> : null}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
