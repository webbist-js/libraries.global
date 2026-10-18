import {
  QUEUE_OF_SUBMISSION_TYPE,
  REVIEW_CATEGORY_TYPES,
  type ModerationScope,
  type ReviewCategory,
} from "@repo/access"

import {
  queueHref,
  type QueueState,
} from "@/components/moderation/queue-navigation"
import {
  SEGMENTS,
  type ModerationQueueName,
} from "@/components/moderation/submissionMeta"
import type {
  CategoryStat,
  WorkspaceView,
} from "@/components/moderation/workspace"
import { isDocumentIdParam } from "@/lib/bridge-params"

type Params = Record<string, string | string[] | undefined>

export const firstQueryValue = (value: Params[string]) =>
  (Array.isArray(value) ? value[0] : value) ?? ""

export function categoryQueues(
  queues: readonly ModerationQueueName[],
  category?: ReviewCategory
) {
  return category
    ? queues.filter((queue) =>
        REVIEW_CATEGORY_TYPES[category].some(
          (type) => QUEUE_OF_SUBMISSION_TYPE[type] === queue
        )
      )
    : [...queues]
}

export function workspaceQueueState(
  sp: Params,
  scopes: readonly ModerationScope[],
  allQueues: readonly ModerationQueueName[],
  locales: readonly { code: string; name: string }[],
  category?: ReviewCategory,
  legacyList = false
) {
  const queues = categoryQueues(allQueues, category)
  const relevant = scopes.filter(
    (scope) =>
      scope.queue === "all" || (queues as string[]).includes(scope.queue)
  )
  const names = Object.fromEntries(
    locales.map((locale) => [locale.code, locale.name])
  )
  const scoped = [
    ...new Set(
      relevant.flatMap((scope) => (scope.locale ? [scope.locale] : []))
    ),
  ]
  const filterLocales = relevant.some((scope) => scope.locale === null)
    ? locales.map(({ code, name }) => ({ code, name }))
    : scoped.map((code) => ({ code, name: names[code] ?? code.toUpperCase() }))
  const segment = firstQueryValue(sp.status)
  const queue = firstQueryValue(sp.queue)
  const locale = firstQueryValue(sp.locale)
  const drive = firstQueryValue(sp.drive)
  const state: QueueState = {
    category,
    segment: SEGMENTS.some((item) => item.id === segment)
      ? (segment as QueueState["segment"])
      : "pending",
    queue: (queues as string[]).includes(queue)
      ? (queue as QueueState["queue"])
      : "",
    locale: filterLocales.some((item) => item.code === locale) ? locale : "",
    q: firstQueryValue(sp.q).slice(0, 100),
    drive:
      isDocumentIdParam(drive) && (category === "libraries" || legacyList)
        ? drive
        : "",
    page: Math.min(
      500,
      Math.max(1, Math.trunc(Number(firstQueryValue(sp.page))) || 1)
    ),
  }

  return { state, queues, filterLocales, localeNames: names }
}

export function workspaceCategoryViews(
  categories: readonly ReviewCategory[],
  allQueues: readonly ModerationQueueName[],
  state: QueueState,
  stats?: readonly CategoryStat[]
): WorkspaceView[] {
  return categories.map((id) => {
    const pending = stats?.find(
      (item) => item.category === id && item.status === "pending"
    )
    const needsChanges = stats?.find(
      (item) => item.category === id && item.status === "needs_info"
    )
    const queues = categoryQueues(allQueues, id)

    return {
      id,
      href: queueHref({
        ...state,
        category: id,
        queue: queues.includes(state.queue as ModerationQueueName)
          ? state.queue
          : "",
        drive: id === "libraries" ? state.drive : "",
        page: 1,
      }),
      pending: pending?.count ?? null,
      needsChanges: needsChanges?.count ?? null,
    }
  })
}
