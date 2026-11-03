"use client"

import { Icon } from "@iconify/react"
import { useNow, useTranslations } from "next-intl"

import { Badge, type BadgeColor } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import {
  activityAge,
  roadmapAnchor,
  type RoadmapArea,
  type RoadmapEngagement,
  type RoadmapFeature,
  type RoadmapPlan,
  type RoadmapStage,
} from "@/lib/roadmap"

export const AREA_STYLE: Record<
  RoadmapArea,
  { color: BadgeColor; icon: string }
> = {
  atlas: { color: "aurora", icon: "mdi:map-outline" },
  watching: { color: "violet", icon: "mdi:eye-outline" },
  widgets: { color: "ember", icon: "mdi:view-grid-plus-outline" },
  teams: { color: "ok", icon: "mdi:account-group-outline" },
  events: { color: "gold", icon: "mdi:calendar-blank-outline" },
  data: { color: "dim", icon: "mdi:code-tags" },
}

const PLAN_STYLE: Record<RoadmapPlan, string> = {
  free: "bg-(--tint-public-bg) text-(--tint-public-fg)",
  supporter: "border border-(--t-border-hi) text-(--t-ink-base)",
  pro: "bg-(--t-accent-chip) text-(--t-accent-primary)",
  team: "bg-(--t-bg-inverse) text-(--t-ink-inverse)",
  api: "bg-(--t-bg-surface) text-(--t-accent-primary)",
}

const NOTE_ICON = {
  target: "mdi:clock-outline",
  testing: "mdi:check",
  depends: "mdi:link-variant",
} as const

export const STAGE_DOT: Record<RoadmapStage, string> = {
  now: "bg-(--t-accent-primary)",
  next: "bg-(--t-ink-base)",
  later: "bg-(--t-ink-low)",
}

export function AreaTag({ area }: { readonly area: RoadmapArea }) {
  const t = useTranslations("roadmap")
  const style = AREA_STYLE[area]

  return (
    <Badge
      size="sm"
      color={style.color}
      icon={style.icon}
      label={t(`areas.${area}`)}
    />
  )
}

export function PlanTag({
  plan,
  detail,
}: {
  readonly plan: RoadmapPlan
  readonly detail: string | null
}) {
  const t = useTranslations("roadmap")

  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold ${PLAN_STYLE[plan]}`}
    >
      {t(`plans.${plan}`)}
      {detail ? ` · ${detail}` : null}
    </span>
  )
}

export function VoteButton({
  title,
  votes,
  voted,
  busy,
  ready,
  signedIn,
  signInHref,
  onVote,
}: {
  readonly title: string
  readonly votes: number
  readonly voted: boolean
  readonly busy: boolean
  readonly ready: boolean
  readonly signedIn: boolean
  readonly signInHref: string
  readonly onVote: () => void
}) {
  const t = useTranslations("roadmap")
  const base =
    "inline-flex min-h-11 min-w-16 items-center justify-center gap-1.5 rounded-full border px-4 text-base font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
  const content = (
    <>
      <Icon aria-hidden icon="mdi:chevron-up" width={18} />
      {ready ? votes.toLocaleString() : "–"}
    </>
  )
  if (!ready)
    return (
      <span
        className={`${base} border-(--t-border-line) text-(--t-ink-dim)`}
        aria-hidden
      >
        {content}
      </span>
    )
  if (!signedIn)
    return (
      <GlobalLink
        href={signInHref}
        aria-label={`${votes.toLocaleString()}: ${t("signInToVote", { title, count: votes })}`}
        className={`${base} border-(--t-border-hi) text-(--t-ink-base) hover:bg-(--t-bg-surface)`}
      >
        {content}
      </GlobalLink>
    )

  return (
    <button
      type="button"
      aria-pressed={voted}
      aria-label={`${votes.toLocaleString()}: ${t(voted ? "removeVote" : "addVote", { title, count: votes })}`}
      disabled={busy}
      onClick={onVote}
      className={`${base} cursor-pointer disabled:cursor-wait disabled:opacity-60 ${
        voted
          ? "border-(--t-accent-primary) bg-(--t-accent-chip) text-(--t-accent-primary)"
          : "border-(--t-border-hi) text-(--t-ink-base) hover:bg-(--t-bg-surface)"
      }`}
    >
      {content}
    </button>
  )
}

/**
 * Opens the item's discussion page once it has a visible thread; before
 * that, starts one in the shared composer drawer.
 */
export function DiscussButton({
  title,
  posts,
  threadId,
  onStart,
}: {
  readonly title: string
  readonly posts: number
  readonly threadId: string | null
  readonly onStart: () => void
}) {
  const t = useTranslations("roadmap")
  const className =
    "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-(--t-border-hi) px-4 text-base font-semibold text-(--t-ink-base) hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
  const content = (
    <>
      <Icon aria-hidden icon="mdi:chat-outline" width={18} />
      {t("discuss")}
      {posts > 0 ? (
        <span className="rounded-full bg-(--t-bg-surface) px-2 text-sm tabular-nums">
          {posts}
        </span>
      ) : null}
    </>
  )

  return threadId ? (
    <GlobalLink
      href={`/community/discussions/${encodeURIComponent(threadId)}`}
      aria-label={t("discussItem", { title, count: posts })}
      className={className}
    >
      {content}
    </GlobalLink>
  ) : (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`${t("discuss")}: ${t("startDiscussionAbout", { title })}`}
      onClick={onStart}
      className={className}
    >
      {content}
    </button>
  )
}

export function ActivityLabel({
  activityAt,
}: {
  readonly activityAt: string | null
}) {
  const t = useTranslations("roadmap")
  const now = useNow({ updateInterval: 60_000 })
  const days = activityAge(activityAt, now.getTime())
  if (days === null) return null

  return (
    <span className="ml-auto text-sm text-(--t-ink-dim)">
      {days === 0
        ? t("activeToday")
        : days === 1
          ? t("activeYesterday")
          : t("activeDaysAgo", { count: days })}
    </span>
  )
}

export function FeatureCard({
  feature,
  engagement,
  showStage,
  vote,
  onDiscuss,
}: {
  readonly feature: RoadmapFeature
  readonly engagement: RoadmapEngagement
  readonly showStage: boolean
  readonly vote: Omit<Parameters<typeof VoteButton>[0], "title" | "votes">
  readonly onDiscuss: () => void
}) {
  const t = useTranslations("roadmap")

  return (
    <article
      id={roadmapAnchor(feature.key)}
      aria-labelledby={`${roadmapAnchor(feature.key)}-title`}
      className="flex scroll-mt-24 flex-col gap-3 rounded-[20px] border border-(--t-border-line) bg-(--t-bg-void) p-5"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {showStage ? (
          <span className="inline-flex min-h-6 items-center gap-1.5 rounded-full border border-(--t-border-line) px-2.5 text-xs font-semibold">
            <span
              aria-hidden
              className={`size-2 rounded-full ${STAGE_DOT[feature.stage]}`}
            />
            {t(`stages.${feature.stage}.label`)}
          </span>
        ) : null}
        <AreaTag area={feature.area} />
        {feature.plans.map((plan) => (
          <PlanTag key={plan.plan} plan={plan.plan} detail={plan.detail} />
        ))}
      </div>
      <h3
        id={`${roadmapAnchor(feature.key)}-title`}
        className="type-card-title m-0 [overflow-wrap:anywhere]"
      >
        {feature.title}
      </h3>
      {feature.description ? (
        <p className="m-0 text-base leading-relaxed text-(--t-ink-dim)">
          {feature.description}
        </p>
      ) : null}
      {feature.note && feature.noteKind ? (
        <p
          className={`m-0 flex items-center gap-1.5 text-sm font-semibold ${
            feature.noteKind === "depends"
              ? "text-(--t-ink-dim)"
              : "text-(--t-accent-primary)"
          }`}
        >
          <Icon aria-hidden icon={NOTE_ICON[feature.noteKind]} width={16} />
          {feature.note}
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-(--t-border-line) pt-4">
        <VoteButton {...vote} title={feature.title} votes={engagement.votes} />
        <DiscussButton
          title={feature.title}
          posts={engagement.posts}
          threadId={engagement.threadId}
          onStart={onDiscuss}
        />
        <ActivityLabel activityAt={engagement.activityAt} />
      </div>
    </article>
  )
}
