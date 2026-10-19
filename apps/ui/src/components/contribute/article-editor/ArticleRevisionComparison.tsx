"use client"

import { Icon } from "@iconify/react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"
import { languageName } from "@/lib/locale-fallback"

import type { ArticleDraft, ArticleKind } from "./article.types"
import { ArticlePreview } from "./ArticlePreview"
import { ArticleReadingPane } from "./ArticleReadingPane"

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
  const p = useTranslations("publishing")

  return (
    <details className="mx-5 mt-5 rounded-[16px] border border-(--t-border-line) bg-(--t-bg-surface) sm:mx-7">
      <summary className="cursor-pointer px-4 py-3 text-[14px] font-semibold">
        {p("details")}
      </summary>
      <dl className="m-0 grid gap-1 border-t border-(--t-border-line) p-4 text-[14px] leading-relaxed [overflow-wrap:anywhere]">
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
    </details>
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
  draftLocale,
}: {
  readonly kind: ArticleKind
  readonly draftLocale?: string
  readonly draft: ArticleDraft
  readonly published: PublishedComparison
  readonly busy: boolean
  readonly onAdopt: () => void
  readonly onBack?: () => void
}) {
  const t = useTranslations("articleConflict")
  const p = useTranslations("publishing")
  const tUi = useTranslations("ui")
  const locale = useLocale()
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  const fields = (
    [
      ["title", draft.title, published.title],
      ["summary", draft.summary, published.summary],
      ["body", draft.doc, published.doc],
      ["sections", draft.sections, published.sections],
      ["relations", draft.tags, published.tags],
      ["events", draft.eventMentions ?? [], published.eventMentions ?? []],
    ] as const
  ).filter(([field]) => kind === "journal" || field !== "events")

  return (
    <section aria-label={t("compare")} className="mb-5 grid min-w-0 gap-5">
      <div className="rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="m-0 font-serif text-[28px] leading-tight font-medium outline-none"
          >
            {p("comparisonSummary")}
          </h2>
          {onBack && (
            <Button
              variant="surface"
              size="pill"
              onClick={onBack}
              disabled={busy}
            >
              <Icon aria-hidden="true" icon="mdi:arrow-left" width={18} />
              {p("backDraft")}
            </Button>
          )}
        </div>
        <p className="mt-4 mb-0 max-w-[80ch] text-[15px] leading-relaxed text-(--t-ink-dim)">
          {t("instructions")}
        </p>
        <dl className="mt-5 mb-0 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {fields.map(([field, local, current]) => {
            const unchanged = JSON.stringify(local) === JSON.stringify(current)

            return (
              <div
                key={field}
                className="rounded-[14px] bg-(--t-bg-surface) px-3 py-3"
              >
                <dt className="text-[14px] font-semibold">
                  {field === "title" || field === "summary"
                    ? tUi(field)
                    : p(field)}
                </dt>
                <dd className="m-0 mt-1 flex items-center gap-1.5 text-[14px] text-(--t-ink-dim)">
                  <Icon
                    aria-hidden="true"
                    icon={unchanged ? "mdi:check" : "mdi:circle-edit-outline"}
                    width={16}
                    className={
                      unchanged
                        ? "shrink-0"
                        : "shrink-0 text-(--t-accent-primary)"
                    }
                  />
                  {p(unchanged ? "unchanged" : "changed")}
                </dd>
              </div>
            )
          })}
        </dl>
      </div>
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
        <ArticleReadingPane
          heading={t("published", {
            language: languageName(published.locale, [], locale),
          })}
          lang={published.locale}
        >
          <ComparisonMetadata value={published} />
          <ArticlePreview
            kind={kind}
            title={published.title}
            summary={published.summary}
            doc={published.doc}
            compact
          />
        </ArticleReadingPane>
        <ArticleReadingPane
          heading={t("yourDraft")}
          lang={draftLocale ?? published.locale}
          icon="mdi:file-document-edit-outline"
        >
          <ComparisonMetadata value={draft} />
          <ArticlePreview
            kind={kind}
            title={draft.title}
            summary={draft.summary}
            doc={draft.doc}
            compact
          />
        </ArticleReadingPane>
      </div>
      <div className="rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6">
        <Button
          type="button"
          variant="primary"
          size="pill"
          className="h-auto max-w-full whitespace-normal"
          disabled={busy}
          aria-busy={busy}
          onClick={onAdopt}
        >
          <Icon
            aria-hidden="true"
            icon="mdi:check"
            width={18}
            className="shrink-0"
          />
          {t("adopt")}
        </Button>
        <p className="mt-3 mb-0 max-w-[80ch] text-[14px] leading-relaxed text-(--t-ink-dim)">
          {t("adoptHelp")}
        </p>
      </div>
    </section>
  )
}
