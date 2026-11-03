"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { Button } from "@/components/ui/button"
import {
  IMPORT_STEPS,
  importProgress,
  roadmapAnchor,
  type RoadmapDataImport,
  type RoadmapEngagement,
  type RoadmapSuggestion,
} from "@/lib/roadmap"

import { DiscussButton, VoteButton } from "./RoadmapParts"

type VoteProps = Omit<Parameters<typeof VoteButton>[0], "title" | "votes">

function ImportProgress({
  item,
  labelId,
}: {
  readonly item: RoadmapDataImport
  readonly labelId: string
}) {
  const t = useTranslations("roadmap")
  const { done, current } = importProgress(item.stage)
  const stageLabel = t(`importStages.${item.stage}`)

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p id={labelId} className="m-0 text-sm font-semibold">
        {stageLabel}
      </p>
      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={IMPORT_STEPS.length}
        aria-valuenow={done}
        aria-valuetext={t("importStep", {
          done,
          total: IMPORT_STEPS.length,
          stage: stageLabel,
        })}
        className="grid grid-cols-4 gap-1"
      >
        {IMPORT_STEPS.map((step, index) => (
          <span
            key={step}
            className={`h-1.5 rounded-full ${
              index < done
                ? "bg-(--t-accent-ok)"
                : index === current
                  ? "bg-(--t-accent-ok) opacity-50"
                  : "bg-(--t-border-line)"
            }`}
          />
        ))}
      </div>
      {item.stageNote ? (
        <p className="m-0 text-sm text-(--t-ink-dim)">{item.stageNote}</p>
      ) : null}
    </div>
  )
}

export function RoadmapDataImports({
  title,
  lead,
  prompt,
  imports,
  suggestions,
  engagementOf,
  voteFor,
  onDiscuss,
  onSuggest,
  signedIn,
  signInHref,
}: {
  readonly title: string | null
  readonly lead: string | null
  readonly prompt: string | null
  readonly imports: readonly RoadmapDataImport[]
  readonly suggestions: readonly RoadmapSuggestion[]
  readonly engagementOf: (key: string) => RoadmapEngagement
  readonly voteFor: (key: string) => VoteProps
  readonly onDiscuss: (item: { key: string; title: string }) => void
  readonly onSuggest: () => void
  readonly signedIn: boolean
  readonly signInHref: string
}) {
  const t = useTranslations("roadmap")
  const started = imports.filter((i) => i.stage !== "listed")
  const listed = imports.filter((i) => i.stage === "listed")
  const total = (stages: (i: RoadmapDataImport) => boolean) =>
    started.filter(stages).reduce((n, i) => n + (i.libraries ?? 0), 0)
  const stats = (
    [
      [t("statOnTheWay"), total((i) => i.stage !== "ingested")],
      [t("statAdded"), total((i) => i.stage === "ingested")],
    ] as const
  ).filter(([, value]) => value > 0)
  const ranked = [...suggestions].sort(
    (a, b) =>
      engagementOf(b.key).votes - engagementOf(a.key).votes ||
      b.createdAt.localeCompare(a.createdAt)
  )

  return (
    <section
      aria-labelledby="roadmap-data-title"
      className="overflow-clip rounded-[28px] border border-(--t-border-line) bg-(--t-bg-void)"
    >
      <header className="flex flex-wrap items-start justify-between gap-6 p-5 sm:p-8">
        <div className="flex max-w-[62ch] min-w-0 flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-(--t-accent-chip) px-3 py-1 text-sm font-semibold text-(--t-accent-primary)">
            <Icon aria-hidden icon="mdi:database-outline" width={16} />
            {t("dataEyebrow")}
          </span>
          <h2 id="roadmap-data-title" className="type-h2 m-0">
            {title ?? t("dataTitle")}
          </h2>
          {lead ? (
            <p className="m-0 text-base leading-relaxed text-(--t-ink-dim)">
              {lead}
            </p>
          ) : null}
        </div>
        {stats.length ? (
          <dl className="m-0 flex flex-wrap gap-3">
            {stats.map(([label, value]) => (
              <div
                key={label}
                className="rounded-[18px] border border-(--t-border-line) bg-(--t-bg-deep) px-5 py-4"
              >
                <dt className="text-sm text-(--t-ink-dim)">{label}</dt>
                <dd className="type-stat m-0 tabular-nums">
                  {value.toLocaleString()}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </header>

      <ol
        aria-label={t("importStepsLabel")}
        className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 border-y border-(--t-border-line) bg-(--t-bg-deep) px-5 py-3 text-sm sm:px-8"
      >
        {IMPORT_STEPS.map((step, index) => (
          <li key={step} className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="grid size-6 place-items-center rounded-full border border-(--t-border-hi) text-xs font-semibold"
            >
              {index + 1}
            </span>
            {t(`importSteps.${step}`)}
          </li>
        ))}
      </ol>

      {started.length ? (
        <ul className="m-0 list-none p-0">
          {started.map((item) => {
            const engagement = engagementOf(item.key)
            const heading = item.regions
              ? `${item.place} · ${item.regions}`
              : item.place
            const titleId = `${roadmapAnchor(item.key)}-title`

            return (
              <li
                key={item.key}
                id={roadmapAnchor(item.key)}
                aria-labelledby={titleId}
                className="grid scroll-mt-24 gap-5 border-b border-(--t-border-line) px-5 py-6 last:border-b-0 sm:px-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(7rem,0.5fr)_minmax(12rem,1fr)_auto] lg:items-center"
              >
                <div className="flex min-w-0 gap-4">
                  <span
                    aria-hidden
                    className="grid size-12 shrink-0 place-items-center rounded-full bg-(--t-bg-surface) text-sm font-semibold"
                  >
                    {item.code}
                  </span>
                  <div className="min-w-0">
                    <h3
                      id={titleId}
                      className="m-0 text-lg font-semibold [overflow-wrap:anywhere]"
                    >
                      {heading}
                    </h3>
                    <p className="m-0 text-base [overflow-wrap:anywhere] text-(--t-ink-dim)">
                      {item.source}
                    </p>
                    {item.fields.length ? (
                      <ul
                        aria-label={t("importFields")}
                        className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0"
                      >
                        {item.fields.map((field) => (
                          <li
                            key={field}
                            className="rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-3 py-1 text-sm"
                          >
                            {field}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
                <p className="m-0 text-base text-(--t-ink-dim)">
                  {item.libraries !== null ? (
                    <>
                      <strong className="block text-2xl font-medium text-(--t-ink-base) tabular-nums">
                        {item.libraries.toLocaleString()}
                      </strong>
                      {t(
                        item.stage === "ingested"
                          ? "importAdded"
                          : "importInSource",
                        { count: item.libraries }
                      )}
                    </>
                  ) : null}
                </p>
                <ImportProgress item={item} labelId={`${titleId}-stage`} />
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <VoteButton
                    {...voteFor(item.key)}
                    title={heading}
                    votes={engagement.votes}
                  />
                  <DiscussButton
                    title={heading}
                    posts={engagement.posts}
                    threadId={engagement.threadId}
                    onStart={() => onDiscuss({ key: item.key, title: heading })}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      ) : listed.length ? null : (
        <p className="m-0 px-5 py-6 text-base text-(--t-ink-dim) sm:px-8">
          {t("noImports")}
        </p>
      )}

      {listed.length ? (
        <div className="border-t border-(--t-border-line) px-5 py-6 sm:px-8">
          <h3 className="m-0 text-lg font-semibold">{t("onOurList")}</h3>
          <p className="m-0 mb-3 text-sm text-(--t-ink-dim)">
            {t("onOurListLead")}
          </p>
          <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
            {listed.map((item) => {
              const engagement = engagementOf(item.key)

              return (
                <li
                  key={item.key}
                  id={roadmapAnchor(item.key)}
                  className="flex scroll-mt-24 flex-wrap items-center justify-between gap-3 rounded-[18px] border border-(--t-border-line) bg-(--t-bg-deep) px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="grid size-10 shrink-0 place-items-center rounded-full bg-(--t-bg-surface) text-xs font-semibold"
                    >
                      {item.code}
                    </span>
                    <div className="min-w-0">
                      <p className="m-0 font-semibold [overflow-wrap:anywhere]">
                        {item.place}
                      </p>
                      <p className="m-0 text-sm [overflow-wrap:anywhere] text-(--t-ink-dim)">
                        {item.source}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <VoteButton
                      {...voteFor(item.key)}
                      title={item.place}
                      votes={engagement.votes}
                    />
                    <DiscussButton
                      title={item.place}
                      posts={engagement.posts}
                      threadId={engagement.threadId}
                      onStart={() =>
                        onDiscuss({ key: item.key, title: item.place })
                      }
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {ranked.length ? (
        <div className="border-t border-(--t-border-line) px-5 py-6 sm:px-8">
          <h3 className="m-0 mb-3 text-lg font-semibold">
            {t("communitySuggestions")}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {ranked.map((suggestion) => {
              const engagement = engagementOf(suggestion.key)
              const heading = `${suggestion.place}: ${suggestion.source}`

              return (
                <li
                  key={suggestion.key}
                  id={roadmapAnchor(suggestion.key)}
                  className="flex scroll-mt-24 flex-wrap items-center justify-between gap-3 rounded-[18px] border border-(--t-border-line) bg-(--t-bg-deep) px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="m-0 font-semibold [overflow-wrap:anywhere]">
                      {suggestion.place}
                    </p>
                    <p className="m-0 text-sm [overflow-wrap:anywhere] text-(--t-ink-dim)">
                      {suggestion.sourceUrl ? (
                        <a
                          href={suggestion.sourceUrl}
                          rel="noopener noreferrer nofollow"
                          target="_blank"
                          className="underline underline-offset-[3px]"
                        >
                          {suggestion.source}
                        </a>
                      ) : (
                        suggestion.source
                      )}
                      {suggestion.licence ? ` · ${suggestion.licence}` : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <VoteButton
                      {...voteFor(suggestion.key)}
                      title={heading}
                      votes={engagement.votes}
                    />
                    <DiscussButton
                      title={heading}
                      posts={engagement.posts}
                      threadId={engagement.threadId}
                      onStart={() =>
                        onDiscuss({ key: suggestion.key, title: heading })
                      }
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <footer
        id="suggest-dataset"
        className="flex scroll-mt-24 flex-wrap items-center justify-between gap-4 border-t border-(--t-border-line) bg-(--t-bg-deep) px-5 py-5 sm:px-8"
      >
        <p className="m-0 max-w-[62ch] text-base text-(--t-ink-dim)">
          {prompt ?? t("suggestPrompt")}
        </p>
        {signedIn ? (
          <Button
            type="button"
            variant="surface"
            size="pill"
            aria-haspopup="dialog"
            onClick={onSuggest}
          >
            {t("suggestDataset")}
          </Button>
        ) : (
          <GlobalLink
            href={signInHref}
            className="inline-flex min-h-11 items-center rounded-full border border-(--t-border-hi) px-5 font-semibold"
          >
            {t("signInToSuggest")}
          </GlobalLink>
        )}
      </footer>
    </section>
  )
}
