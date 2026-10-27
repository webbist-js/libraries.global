import { useTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import {
  articleCitationDate,
  articleCitationHref,
  articleCitationTimezone,
  articleContextPlaces,
  articleLibraryHref,
  type ArticleContextData,
  type ArticleContextPlace,
} from "@/lib/article-context"

const PLACE_FILTERS = {
  continents: "continent",
  countries: "country",
  regions: "region",
  areas: "area",
}
function browseHref(
  kind: "journal" | "knowledge",
  facet: string,
  place: ArticleContextPlace
) {
  return typeof place.documentId === "string" && place.documentId
    ? `/${kind}?${new URLSearchParams({ lang: "all", [facet]: place.documentId })}`
    : null
}

/** Public article context only: live Event payloads never replace durable citations. */
export function ArticleContext({
  article,
  kind,
  locale,
}: {
  article: ArticleContextData
  kind: "journal" | "knowledge"
  locale: string
}) {
  const t = useTranslations("articleContext")
  const p = useTranslations("publishing")
  const topics = (article.topics ?? []).filter((item) => item.name)
  const libraries = (article.libraries ?? []).filter((item) => item.name)
  const places = articleContextPlaces(article)
  const events =
    kind === "journal"
      ? (article.eventMentions ?? []).filter((item) => item.title)
      : []
  if (!topics.length && !libraries.length && !places.length && !events.length)
    return null

  return (
    <section
      aria-label={p(kind === "journal" ? "contextStory" : "contextReference")}
      className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) p-6"
    >
      <h2 className="type-panel-title mt-0">
        {p(kind === "journal" ? "contextStory" : "contextReference")}
      </h2>
      <dl className="mb-0 grid gap-3">
        {topics.length > 0 && (
          <div>
            <dt className="font-semibold">{t("topics")}</dt>
            <dd className="ml-0 flex flex-wrap gap-x-4 gap-y-1">
              {topics.map((item, index) => (
                <GlobalLink
                  key={item.documentId ?? index}
                  href={browseHref(kind, "topic", item)}
                  className="underline"
                >
                  {item.name}
                </GlobalLink>
              ))}
            </dd>
          </div>
        )}
        {libraries.length > 0 && (
          <div>
            <dt className="font-semibold">{t("libraries")}</dt>
            <dd className="ml-0 flex flex-wrap gap-x-4 gap-y-1">
              {libraries.map((item, index) => (
                <GlobalLink
                  key={item.documentId ?? index}
                  href={articleLibraryHref(item)}
                  className="underline"
                >
                  {item.name}
                </GlobalLink>
              ))}
            </dd>
          </div>
        )}
        {places.map(({ key, places: values }) => (
          <div key={key}>
            <dt className="font-semibold">{t(key)}</dt>
            <dd className="ml-0 flex flex-wrap gap-x-4 gap-y-1">
              {values.map((item, index) => (
                <GlobalLink
                  key={item.documentId ?? index}
                  href={browseHref(kind, PLACE_FILTERS[key], item)}
                  className="underline"
                >
                  {item.name}
                </GlobalLink>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      {events.length > 0 && (
        <div className="mt-5">
          <h3 className="type-h3">{t("events")}</h3>
          <p className="text-xs" style={{ color: "var(--t-ink-dim)" }}>
            {p("citedByAuthor")}
          </p>
          <ul className="mb-0 grid list-none gap-4 pl-0">
            {events.map((event, index) => {
              const timezone = articleCitationTimezone(event.timezone)
              const start = articleCitationDate(
                event.startTime,
                locale,
                timezone
              )
              const end = articleCitationDate(event.endTime, locale, timezone)
              const source = articleCitationHref(event.url)

              return (
                <li key={event.citationId ?? index}>
                  <p className="mb-1 font-semibold">{event.title}</p>
                  {start && (
                    <p className="m-0 text-base">
                      {t("starts")}:{" "}
                      <time dateTime={event.startTime ?? undefined}>
                        {start}
                      </time>{" "}
                      · {timezone}
                    </p>
                  )}
                  {end && (
                    <p className="m-0 text-base">
                      {t("ends")}:{" "}
                      <time dateTime={event.endTime ?? undefined}>{end}</time> ·{" "}
                      {timezone}
                    </p>
                  )}
                  {event.library?.name && (
                    <p className="m-0">
                      <GlobalLink
                        href={articleLibraryHref(event.library)}
                        className="underline"
                      >
                        {event.library.name}
                      </GlobalLink>
                    </p>
                  )}
                  {source && (
                    <a
                      href={source}
                      target="_blank"
                      // eslint-disable-next-line react/no-invalid-html-attribute -- Contributor citations use the standard ugc link qualification.
                      rel="noopener noreferrer nofollow ugc"
                      className="underline"
                    >
                      {new URL(source).hostname}
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
