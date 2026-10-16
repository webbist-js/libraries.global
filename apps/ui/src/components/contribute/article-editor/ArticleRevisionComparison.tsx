"use client"

import { useTranslations } from "next-intl"

import type { ArticleDraft, ArticleKind } from "./article.types"
import { ArticlePreview } from "./ArticlePreview"

export type PublishedComparison = Pick<
  ArticleDraft,
  "title" | "summary" | "doc" | "sections" | "tags" | "eventMentions"
> & {
  revision: string
  locale: string
}

function ComparisonMetadata({
  value,
}: {
  value: Pick<ArticleDraft, "sections" | "tags" | "eventMentions">
}) {
  const t = useTranslations("articleConflict")

  return (
    <dl className="grid gap-1 rounded-xl border border-(--t-border-line) p-3 text-sm">
      <dt className="font-semibold">{t("sections")}</dt>
      <dd className="m-0">
        {value.sections.map((key) => key.replaceAll("-", " ")).join(", ") ||
          t("none")}
      </dd>
      <dt className="mt-2 font-semibold">{t("relations")}</dt>
      <dd className="m-0">
        {value.tags.map((tag) => tag.label).join(", ") || t("none")}
      </dd>
      <dt className="mt-2 font-semibold">{t("events")}</dt>
      <dd className="m-0">
        {value.eventMentions?.length ? (
          <ul className="m-0 list-none p-0">
            {value.eventMentions.map((mention, index) => (
              <li
                key={mention.citationId ?? `${mention.title}:${index}`}
                className="mb-2 break-words"
              >
                {[
                  mention.title,
                  mention.startTime,
                  mention.endTime,
                  mention.timezone,
                  mention.libraryName ??
                    value.tags.find(
                      (tag) =>
                        tag.kind === "library" &&
                        tag.documentId === mention.libraryDocumentId
                    )?.label,
                  mention.url,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </li>
            ))}
          </ul>
        ) : (
          t("none")
        )}
      </dd>
    </dl>
  )
}

/** Comparison is read-only; adopting a base requires an explicit, audited save. */
export function ArticleRevisionComparison({
  kind,
  draft,
  published,
  busy,
  onAdopt,
  onBack,
}: {
  readonly kind: ArticleKind
  readonly draft: ArticleDraft
  readonly published: PublishedComparison
  readonly busy: boolean
  readonly onAdopt: () => void
  readonly onBack?: () => void
}) {
  const t = useTranslations("articleConflict")
  const p = useTranslations("publishing")

  return (
    <section
      aria-label={t("compare")}
      className="mb-5 grid gap-4 rounded-2xl border border-(--t-border-line) p-5"
    >
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="font-serif text-2xl">{p("comparisonSummary")}</h2>
        {onBack && (
          <button type="button" onClick={onBack} className="underline">
            {p("backDraft")}
          </button>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        {(
          [
            ["title", draft.title, published.title],
            ["summary", draft.summary, published.summary],
            ["body", draft.doc, published.doc],
            ["sections", draft.sections, published.sections],
            ["relations", draft.tags, published.tags],
            [
              "events",
              draft.eventMentions ?? [],
              published.eventMentions ?? [],
            ],
          ] as const
        )
          .filter(([field]) => kind === "journal" || field !== "events")
          .map(([field, local, current]) => (
            <div key={field}>
              <dt className="font-semibold">
                {field === "title" || field === "summary" ? field : p(field)}
              </dt>
              <dd className="m-0">
                {p(
                  JSON.stringify(local) === JSON.stringify(current)
                    ? "unchanged"
                    : "changed"
                )}
              </dd>
            </div>
          ))}
      </dl>
      <p>{t("instructions")}</p>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">
            {t("published", { language: published.locale })}
          </h2>
          <ComparisonMetadata value={published} />
          <ArticlePreview
            kind={kind}
            title={published.title}
            summary={published.summary}
            doc={published.doc}
          />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{t("yourDraft")}</h2>
          <ComparisonMetadata value={draft} />
          <ArticlePreview
            kind={kind}
            title={draft.title}
            summary={draft.summary}
            doc={draft.doc}
          />
        </div>
      </div>
      <button
        type="button"
        className="justify-self-start rounded-full border px-4 py-2 font-semibold"
        disabled={busy}
        onClick={onAdopt}
      >
        {t("adopt")}
      </button>
      <p className="text-sm text-(--t-ink-dim)">{t("adoptHelp")}</p>
    </section>
  )
}
