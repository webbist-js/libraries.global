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

export default async function ModerationQueuePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const callback = new URLSearchParams()
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
    if (value) callback.set(key, value)
  }
  const callbackPath =
    "/contribute/moderation" + (callback.size ? "?" + callback.toString() : "")
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
  const active =
    first(sp.tab) === "discussions" ||
    (!allQueues.length && canReviewDiscussions)
      ? "discussions"
      : isReviewCategory(requested)
        ? requested
        : categories.length === 1 && !canReviewDiscussions
          ? categories[0]!
          : "overview"
  const category = isReviewCategory(active) ? active : undefined
  const legacyList =
    active === "overview" &&
    ["status", "queue", "locale", "q", "drive", "page"].some(
      (key) => !!first(sp[key])
    )
  const showList = !!category || legacyList || first(sp.tab) === "submissions"
  const [locales, countResult, discussionCount, driveStatsRes, suggestionsRes] =
    await Promise.all([
      fetchArticleLocales(),
      allQueues.length
        ? fetchModeration<{ data?: CategoryStat[] }>(
            user,
            "stats?group=category"
          )
        : Promise.resolve({
            status: 200,
            body: { data: [] as CategoryStat[] },
          }),
      canReviewDiscussions
        ? fetchDiscussionReviewCount(user)
        : Promise.resolve(null),
      (category === "libraries" || legacyList) && !first(sp.drive)
        ? fetchModeration<{ data?: { drive: DriveTag; waiting: number }[] }>(
            user,
            "drive-stats"
          )
        : Promise.resolve({ body: null }),
      coversEverything(scopes)
        ? fetchModeration<{ data?: OptionSuggestion[] }>(
            user,
            "option-suggestions"
          )
        : Promise.resolve(null),
    ])
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
      href: "/contribute/moderation?tab=discussions",
      pending: discussionCount,
    })
  if (coversEverything(scopes))
    views.push({
      id: "optionSuggestions",
      href: "/contribute/moderation/suggestions",
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
      <div className="mx-auto grid w-full max-w-[1360px] gap-6 px-4 pt-8 pb-16 text-[16px] [--spacing:0.25rem] sm:px-8">
        <EditorialToolbar
          label={t("workspace")}
          description={t("scopeHint")}
          variant="subtle"
        />
        <ModerationWorkspaceNav active={active} views={views} />
        {active === "discussions" ? (
          <DiscussionModeration />
        ) : showList ? (
          <>
            {(category === "libraries" || legacyList) && !state.drive ? (
              <DriveQueueStrip rows={driveStatsRes.body?.data ?? []} />
            ) : null}
            <ModerationQueue
              key={category ?? "all"}
              state={state}
              queues={queues}
              locales={filterLocales}
              localeNames={localeNames}
            />
          </>
        ) : (
          <ModerationOverview views={views} />
        )}
      </div>
    </>
  )
}
