"use client"

import { DEFAULT_LOCALE } from "@repo/shared-data"
import { useLocale, useTranslations } from "next-intl"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import { SegmentedControl, SelectField } from "@/components/ds"
import {
  filterFeatures,
  ROADMAP_PLANS,
  ROADMAP_STAGES,
  type RoadmapArea,
  type RoadmapContent,
  type RoadmapPlan,
  usedAreas,
} from "@/lib/roadmap"

import { RoadmapDataImports } from "./RoadmapDataImports"
import { RoadmapDiscussionComposer } from "./RoadmapDiscussionComposer"
import { FeatureCard, STAGE_DOT } from "./RoadmapParts"
import { SuggestDatasetDrawer } from "./SuggestDatasetDrawer"
import { useRoadmapEngagement } from "./useRoadmapEngagement"

const VIEW_KEY = "roadmap-view"
type View = "board" | "list"
const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "board"
  } catch {
    return "board"
  }
}
const subscribeView = (onChange: () => void) => {
  window.addEventListener("storage", onChange)

  return () => window.removeEventListener("storage", onChange)
}

export function RoadmapView({ content }: { readonly content: RoadmapContent }) {
  const t = useTranslations("roadmap")
  const locale = useLocale()
  const engagement = useRoadmapEngagement(locale)
  const [area, setArea] = useState<RoadmapArea | "all">("all")
  const [plan, setPlan] = useState<RoadmapPlan | "any">("any")
  const storedView = useSyncExternalStore(
    subscribeView,
    readView,
    () => "board" as const
  )
  const [chosenView, setChosenView] = useState<View | null>(null)
  const view = chosenView ?? storedView
  const [discussing, setDiscussing] = useState<{
    key: string
    title: string
  } | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [announcement, setAnnouncement] = useState("")
  const chooseView = (next: View) => {
    setChosenView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Not remembered; the choice still applies on this page.
    }
  }

  // The composer drawer's load effect depends on these, so keep them stable.
  const refreshRef = useRef(engagement.refresh)
  useEffect(() => {
    refreshRef.current = engagement.refresh
  })
  const stopDiscussing = useCallback(() => setDiscussing(null), [])
  const onStarted = useCallback(() => {
    refreshRef.current()
  }, [])

  const signInHref = `/auth/signin?callbackUrl=${encodeURIComponent(
    `${locale === DEFAULT_LOCALE ? "" : `/${locale}`}/community/roadmap`
  )}`
  const voteFor = (key: string) => ({
    voted: engagement.hasVoted(key),
    busy: engagement.busyKey === key,
    ready: engagement.ready,
    signedIn: engagement.signedIn,
    signInHref,
    onVote: async () => {
      const voted = !engagement.hasVoted(key)
      if (await engagement.vote(key, voted))
        setAnnouncement(t(voted ? "voteAdded" : "voteRemoved"))
    },
  })

  const areas = usedAreas(content.features)
  const shown = filterFeatures(content.features, { area, plan })
  const stages = view === "board" ? ROADMAP_STAGES : (["all"] as const)

  return (
    <>
      <section aria-labelledby="roadmap-features-title" className="mb-10">
        <h2 id="roadmap-features-title" className="sr-only">
          {t("featuresHeading")}
        </h2>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div
            role="group"
            aria-label={t("filterAreas")}
            className="flex flex-wrap gap-2"
          >
            {(["all", ...areas] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={area === value}
                onClick={() => setArea(value)}
                className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary) ${
                  area === value
                    ? "border-(--t-accent-primary) bg-(--t-accent-chip) text-(--t-accent-primary)"
                    : "border-(--t-border-line) bg-(--t-bg-void) text-(--t-ink-base) hover:border-(--t-border-hi)"
                }`}
              >
                {value === "all" ? t("allAreas") : t(`areas.${value}`)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SelectField
              appearance="pill"
              label={t("planFilter")}
              value={plan === "any" ? "" : plan}
              onValueChange={(value) =>
                setPlan(
                  ROADMAP_PLANS.includes(value as RoadmapPlan)
                    ? (value as RoadmapPlan)
                    : "any"
                )
              }
              options={[
                { value: "", label: t("anyPlan") },
                ...ROADMAP_PLANS.map((value) => ({
                  value,
                  label: t(`plans.${value}`),
                })),
              ]}
            />
            <SegmentedControl
              label={t("viewLabel")}
              size="sm"
              value={view}
              onChange={chooseView}
              options={[
                { value: "board", label: t("board") },
                { value: "list", label: t("list") },
              ]}
            />
          </div>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {t("showing", { count: shown.length })} {announcement}
        </p>

        {shown.length === 0 ? (
          <p className="m-0 rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-6 text-base text-(--t-ink-dim)">
            {t("noMatches")}
          </p>
        ) : (
          <div
            className={
              view === "board"
                ? "grid items-start gap-4 lg:grid-cols-3"
                : "flex flex-col gap-3"
            }
          >
            {stages.map((stage) => {
              const items =
                stage === "all"
                  ? [...shown].sort(
                      (a, b) =>
                        ROADMAP_STAGES.indexOf(a.stage) -
                        ROADMAP_STAGES.indexOf(b.stage)
                    )
                  : shown.filter((feature) => feature.stage === stage)
              const headingId = `roadmap-stage-${stage}`

              return (
                <section
                  key={stage}
                  aria-labelledby={stage === "all" ? undefined : headingId}
                  aria-label={
                    stage === "all" ? t("featuresHeading") : undefined
                  }
                  className={
                    stage === "all"
                      ? "flex flex-col gap-3"
                      : "flex flex-col gap-3 rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-3 sm:p-4"
                  }
                >
                  {stage === "all" ? null : (
                    <header className="px-2 pt-2 pb-1">
                      <h3
                        id={headingId}
                        className="type-h3 m-0 flex items-center gap-2"
                      >
                        <span
                          aria-hidden
                          className={`size-2.5 rounded-full ${STAGE_DOT[stage]}`}
                        />
                        {t(`stages.${stage}.label`)}
                        <span className="rounded-full bg-(--t-bg-void) px-2 text-sm font-semibold tabular-nums">
                          {items.length}
                        </span>
                      </h3>
                      <p className="m-0 mt-1 text-sm text-(--t-ink-dim)">
                        {t(`stages.${stage}.lead`)}
                      </p>
                    </header>
                  )}
                  {items.map((feature) => (
                    <FeatureCard
                      key={feature.key}
                      feature={feature}
                      engagement={engagement.engagementOf(feature.key)}
                      showStage={stage === "all"}
                      vote={voteFor(feature.key)}
                      onDiscuss={() =>
                        setDiscussing({
                          key: feature.key,
                          title: feature.title,
                        })
                      }
                    />
                  ))}
                  {stage !== "all" && items.length === 0 ? (
                    <p className="m-0 px-2 pb-2 text-sm text-(--t-ink-dim)">
                      {t("emptyStage")}
                    </p>
                  ) : null}
                </section>
              )
            })}
          </div>
        )}
        {engagement.error ? (
          <p role="alert" className="mt-3 text-sm text-(--t-accent-danger)">
            {t("voteFailed")}
          </p>
        ) : null}
      </section>

      <RoadmapDataImports
        title={content.dataTitle}
        lead={content.dataLead}
        prompt={content.suggestPrompt}
        imports={content.dataImports}
        suggestions={engagement.suggestions}
        engagementOf={engagement.engagementOf}
        voteFor={voteFor}
        onDiscuss={setDiscussing}
        onSuggest={() => setSuggesting(true)}
        signedIn={engagement.signedIn}
        signInHref={signInHref}
      />

      {content.footnote ? (
        <p className="mt-6 max-w-[72ch] text-sm leading-relaxed text-(--t-ink-dim)">
          {content.footnote}
        </p>
      ) : null}

      <RoadmapDiscussionComposer
        item={discussing}
        onClose={stopDiscussing}
        onStarted={onStarted}
      />
      <SuggestDatasetDrawer
        open={suggesting}
        onClose={() => setSuggesting(false)}
      />
    </>
  )
}
