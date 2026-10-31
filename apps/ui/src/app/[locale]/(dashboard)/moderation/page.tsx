import { isReviewCategory, reviewCategoriesInScope } from "@repo/access"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { DiscussionModeration } from "@/components/discussions/DiscussionModeration"
import { EditorialToolbar } from "@/components/ds/EditorialToolbar"
import {
  describeScopes,
  type DriveTag,
  DriveQueueStrip,
  ModerationQueue,
  type OptionSuggestion,
} from "@/components/moderation"
import { ModerationOverview } from "@/components/moderation/ModerationOverview"
import { ModerationWorkspaceNav } from "@/components/moderation/ModerationWorkspaceNav"
import type { CategoryStat } from "@/components/moderation/workspace"
import {
  firstQueryValue as first,
  workspaceQueueState,
  workspaceCategoryViews,
} from "@/components/moderation/workspace-state"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { fetchModeration } from "@/lib/moderation-proxy"
import { fetchDiscussionReviewCount } from "@/lib/moderation-work-counts"
import { privateMetadata } from "@/lib/seo/metadata"

import { ModerationAccessUnavailable } from "./_components/ModerationAccessUnavailable"
import { ModerationHero } from "./_components/ModerationHero"
import {
  coversEverything,
  queuesOf,
  requireModerator,
} from "./_components/moderator"

export const metadata = privateMetadata("Moderation")
type SearchParams = Promise<Record<string, string | string[] | undefined>>

function moderationCallback(sp: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams()
  for (const key of [
    "category",
    "tab",
    "status",
    "queue",
    "locale",
    "q",
    "drive",
    "page",
  ]) {
    const value = first(sp[key]).slice(0, 100)
    if (value) query.set(key, value)
  }

  return "/moderation" + (query.size ? "?" + query.toString() : "")
}

function activeModerationView(
  requested: string,
  tab: string,
  allQueues: ReturnType<typeof queuesOf>,
  categories: ReturnType<typeof reviewCategoriesInScope>,
  canReviewDiscussions: boolean
) {
  if (tab === "discussions" || (!allQueues.length && canReviewDiscussions))
    return "discussions"
  if (isReviewCategory(requested)) return requested
  if (categories.length === 1 && !canReviewDiscussions) return categories[0]!

  return "overview"
}

async function loadQueueData(
  user: Parameters<typeof fetchModeration>[0],
  allQueues: ReturnType<typeof queuesOf>,
  canReviewDiscussions: boolean,
  includeDrives: boolean,
  includeSuggestions: boolean
) {
  return Promise.all([
    fetchArticleLocales(),
    allQueues.length
      ? fetchModeration<{ data?: CategoryStat[] }>(user, "stats?group=category")
      : Promise.resolve({ status: 200, body: { data: [] as CategoryStat[] } }),
    canReviewDiscussions
      ? fetchDiscussionReviewCount(user)
      : Promise.resolve(null),
    includeDrives
      ? fetchModeration<{ data?: { drive: DriveTag; waiting: number }[] }>(
          user,
          "drive-stats"
        )
      : Promise.resolve({ body: null }),
    includeSuggestions
      ? fetchModeration<{ data?: OptionSuggestion[] }>(
          user,
          "option-suggestions"
        )
      : Promise.resolve(null),
  ])
}

function QueueContent({
  active,
  showList,
  category,
  legacyList,
  driveRows,
  views,
  ...queue
}: Parameters<typeof ModerationQueue>[0] & {
  active: string
  showList: boolean
  category?: ReturnType<typeof reviewCategoriesInScope>[number]
  legacyList: boolean
  driveRows: Parameters<typeof DriveQueueStrip>[0]["rows"]
  views: Parameters<typeof ModerationOverview>[0]["views"]
}) {
  if (active === "discussions") return <DiscussionModeration />
  if (!showList) return <ModerationOverview views={views} />

  return (
    <>
      {(category === "libraries" || legacyList) && !queue.state.drive ? (
        <DriveQueueStrip rows={driveRows} />
      ) : null}
      <ModerationQueue key={category ?? "all"} {...queue} />
    </>
  )
}

export default async function ModerationQueuePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const callbackPath = moderationCallback(sp)
  const { user, scopes, accessUnknown } = await requireModerator(callbackPath)
  const t = await getTranslations("moderationWorkspace")
  const discussions = await getTranslations("discussions")
  if (accessUnknown)
    return (
      <ModerationAccessUnavailable title={t("title")} path={callbackPath} />
    )

  const allQueues = queuesOf(scopes)
  const categories = reviewCategoriesInScope(scopes)
  const canReviewDiscussions = scopes.some(
    (scope) => scope.queue === "all" || scope.queue === "discussions"
  )
  const requested = first(sp.category)
  if (
    requested &&
    (!isReviewCategory(requested) || !categories.includes(requested))
  )
    notFound()
  if (first(sp.tab) === "discussions" && !canReviewDiscussions) notFound()
  const active = activeModerationView(
    requested,
    first(sp.tab),
    allQueues,
    categories,
    canReviewDiscussions
  )
  const category = isReviewCategory(active) ? active : undefined
  const legacyList =
    active === "overview" &&
    ["status", "queue", "locale", "q", "drive", "page"].some(
      (key) => !!first(sp[key])
    )
  const showList = !!category || legacyList || first(sp.tab) === "submissions"
  const [locales, countResult, discussionCount, driveStatsRes, suggestionsRes] =
    await loadQueueData(
      user,
      allQueues,
      canReviewDiscussions,
      (category === "libraries" || legacyList) && !first(sp.drive),
      coversEverything(scopes)
    )
  const { state, queues, filterLocales, localeNames } = workspaceQueueState(
    sp,
    scopes,
    allQueues,
    locales,
    category,
    legacyList
  )
  const stats = countResult.status === 200 ? countResult.body?.data : undefined
  const views = workspaceCategoryViews(categories, allQueues, state, stats)
  if (canReviewDiscussions)
    views.push({
      id: "discussions",
      href: "/moderation?tab=discussions",
      pending: discussionCount,
    })
  if (coversEverything(scopes))
    views.push({
      id: "optionSuggestions",
      href: "/moderation/suggestions",
      pending:
        suggestionsRes?.status === 200
          ? (suggestionsRes.body?.data ?? []).filter((item) =>
              ["open", "reviewing", "planned"].includes(item.status)
            ).length
          : null,
    })

  return (
    <>
      <ModerationHero
        title={t("title")}
        lead={
          active === "discussions"
            ? discussions("moderationLead")
            : `You review ${describeScopes(scopes, localeNames)}. Your own submissions never appear here.`
        }
      />
      <div className="mx-auto grid w-full max-w-[1360px] gap-6 px-4 pt-8 pb-16 text-base [--spacing:0.25rem] sm:px-8">
        <EditorialToolbar
          label={t("workspace")}
          description={t("scopeHint")}
          variant="subtle"
        />
        <ModerationWorkspaceNav active={active} views={views} />
        <QueueContent
          active={active}
          showList={showList}
          category={category}
          legacyList={legacyList}
          driveRows={driveStatsRes.body?.data ?? []}
          views={views}
          state={state}
          queues={queues}
          locales={filterLocales}
          localeNames={localeNames}
        />
      </div>
    </>
  )
}
