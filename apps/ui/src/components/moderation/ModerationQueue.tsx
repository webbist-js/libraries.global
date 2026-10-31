"use client"

import { ClipboardList, RefreshCw } from "lucide-react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useState } from "react"

import { EmptyState, Pager } from "@/components/ds"
import { ModerationQueueSkeleton } from "@/components/moderation/ModerationQueueSkeleton"
import { ModerationSubmissionList } from "@/components/moderation/ModerationSubmissionList"
import {
  queueHref,
  type QueueState,
} from "@/components/moderation/queue-navigation"
import { REVIEW_ICONS } from "@/components/moderation/workspace"
import { T } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"

import { ModerationFilters, type QueueFilters } from "./ModerationFilters"
import type {
  ModerationListResponse,
  ModerationQueueName,
  ModerationStat,
  Segment,
} from "./submissionMeta"

const PAGE_SIZE = 25

export {
  queueHref,
  type QueueState,
} from "@/components/moderation/queue-navigation"

function apiQuery(s: QueueState): string {
  const p = new URLSearchParams({
    status: s.segment,
    page: String(s.page),
    pageSize: String(PAGE_SIZE),
  })
  if (s.queue) p.set("queue", s.queue)
  if (s.category) p.set("category", s.category)
  if (s.locale) p.set("locale", s.locale)
  if (s.q) p.set("q", s.q)
  if (s.drive) p.set("drive", s.drive)

  return p.toString()
}

/** Why the list didn't load (not the decision copy: nothing was decided). */
export function listErrorMessage(status: number): string {
  if (status === 403) return "You don't have access to this queue."
  if (status === 429) return "Too many requests. Wait a minute, then try again."

  return "The queue couldn't be loaded. Try again."
}

/**
 * The Moderation Queue: status segments, filters, and a page of the
 * submissions in the caller's scope from `/api/moderation/submissions`.
 * Strapi decides the scope; the filters only narrow it.
 */
export function ModerationQueue({
  state,
  queues,
  locales,
  localeNames,
}: {
  readonly state: QueueState
  readonly queues: readonly ModerationQueueName[]
  /** Languages offered in the filter (empty or one: no filter shown). */
  readonly locales: readonly { code: string; name: string }[]
  readonly localeNames: Record<string, string>
}) {
  const tUi = useUiTranslations("ui")
  const workspace = useUiTranslations("moderationWorkspace")

  const router = useRouter()
  const [result, setResult] = useState<ModerationListResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshEpoch, setRefreshEpoch] = useState(0)
  const [stats, setStats] = useState<ModerationStat[] | null>(null)
  const query = apiQuery(state)
  const statsParams = new URLSearchParams(query)
  for (const key of ["status", "page", "pageSize"]) statsParams.delete(key)
  const statsQuery = statsParams.toString()
  const QueueIcon = state.category
    ? REVIEW_ICONS[state.category]
    : ClipboardList

  useEffect(() => {
    const ctrl = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    fetch(`/api/moderation/submissions?${query}`, { signal: ctrl.signal })
      .then(async (res) => {
        const body: unknown = await res.json().catch(() => null)
        if (ctrl.signal.aborted) return
        if (!res.ok) throw new Error(listErrorMessage(res.status))
        setResult(body as ModerationListResponse)
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        setResult(null)
        setError(
          e instanceof Error && e.message ? e.message : listErrorMessage(0)
        )
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false)
      })

    return () => ctrl.abort()
  }, [query, refreshEpoch])

  useEffect(() => {
    const ctrl = new AbortController()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStats(null)
    fetch(`/api/moderation/stats${statsQuery ? `?${statsQuery}` : ""}`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (j: { data?: ModerationStat[] } | null) =>
          !ctrl.signal.aborted && setStats(j?.data ?? null)
      )
      .catch(() => {})

    return () => ctrl.abort()
  }, [refreshEpoch, statsQuery])

  const counts = useMemo(() => {
    if (!stats) return {}
    const out: Partial<Record<Segment, number>> = {}
    for (const s of stats)
      if (!state.queue || s.queue === state.queue)
        out[s.status] = (out[s.status] ?? 0) + s.count

    return out
  }, [stats, state.queue])

  const onChange = useCallback(
    (patch: Partial<QueueFilters>) =>
      router.replace(queueHref({ ...state, ...patch, page: 1 }), {
        scroll: false,
      }),
    [router, state]
  )

  const rows = result?.data ?? []
  const total = result?.meta.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filtered = !!(state.queue || state.locale || state.q || state.drive)
  // All rows match the drive filter when one is set, so any row carrying
  // it names the Drive; a page with no matches shows the banner untitled.
  const driveTitle = state.drive
    ? (rows.find((r) => r.drive?.documentId === state.drive)?.drive?.title ??
      null)
    : null
  const empty = filtered
    ? {
        icon: "mdi:filter-variant-remove",
        lead: "No submissions match these filters",
        detail:
          "Clear the queue, language, search or drive filter to see more.",
      }
    : state.segment === "pending"
      ? {
          icon: "mdi:check-decagram-outline",
          lead: "Nothing waiting",
          detail: "New submissions in your scope appear here. Thank you.",
        }
      : state.segment === "needs_info"
        ? {
            icon: "mdi:message-reply-text-outline",
            lead: "Nothing is waiting on a contributor",
            detail: "Submissions sent back for changes appear here.",
          }
        : {
            icon: "mdi:archive-outline",
            lead: "Nothing decided yet",
            detail: "Approved and rejected submissions appear here.",
          }
  const emptyList = !loading && !error && rows.length === 0

  return (
    <div className="flex flex-col gap-5" aria-busy={loading}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="type-h2 m-0 flex items-center gap-2.5">
            <QueueIcon
              size={23}
              className="text-(--t-accent-primary)"
              aria-hidden
            />
            {workspace(state.category ?? "submissions")}
          </h2>
          <p className="mt-2 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
            {workspace(
              state.category ? `${state.category}Lead` : "submissionsCaption"
            )}
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setRefreshEpoch((value) => value + 1)
            router.refresh()
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-4 text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCw size={15} aria-hidden />
          {workspace("refresh")}
        </button>
      </header>
      <ModerationFilters
        value={state}
        queues={queues}
        locales={locales}
        counts={counts}
        onChange={onChange}
      />

      {state.drive ? (
        <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
          {driveTitle ? `Filtered by drive ${driveTitle}` : "Filtered by drive"}
          {" · "}
          <Link
            href={queueHref({ ...state, drive: "", page: 1 })}
            className="font-semibold underline-offset-2 hover:underline"
            style={{ color: T.accent.primary }}
          >
            Clear
          </Link>
        </p>
      ) : null}

      <p
        aria-live="polite"
        className={emptyList ? "sr-only" : "m-0 text-sm"}
        style={{ color: T.ink.dim }}
      >
        {loading
          ? "Loading submissions…"
          : error
            ? ""
            : emptyList
              ? empty.lead
              : `${total} submission${total === 1 ? "" : "s"}${pages > 1 ? ` · page ${state.page} of ${pages}` : ""}`}
      </p>

      {error ? (
        <p
          role="alert"
          className="m-0 rounded-[14px] px-4 py-3 text-base"
          style={{
            background: "var(--t-palette-coral-bg)",
            color: T.accent.danger,
          }}
        >
          {error}
        </p>
      ) : null}

      {emptyList ? (
        <div
          className="rounded-[20px]"
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.line}`,
          }}
        >
          <EmptyState
            icon={empty.icon}
            lead={empty.lead}
            detail={empty.detail}
            action={
              filtered ? (
                <Link
                  href={queueHref({
                    ...state,
                    queue: "",
                    locale: "",
                    q: "",
                    drive: "",
                    page: 1,
                  })}
                  className="inline-flex min-h-11 items-center rounded-full border bg-(--t-bg-deep) px-4 text-sm font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
                  style={{ borderColor: T.border.hi, color: T.ink.base }}
                >
                  {tUi("clear_filters")}{" "}
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : null}
      {loading && <ModerationQueueSkeleton />}

      {!loading && rows.length > 0 ? (
        <ModerationSubmissionList
          rows={rows}
          localeNames={localeNames}
          returnTo={queueHref(state)}
        />
      ) : null}

      {pages > 1 ? (
        <nav aria-label={tUi("queue_pages")}>
          <Pager
            prev={
              state.page > 1
                ? {
                    label: `Page ${state.page - 1}`,
                    href: queueHref({ ...state, page: state.page - 1 }),
                  }
                : undefined
            }
            next={
              state.page < pages
                ? {
                    label: `Page ${state.page + 1}`,
                    href: queueHref({ ...state, page: state.page + 1 }),
                  }
                : undefined
            }
          />
        </nav>
      ) : null}
    </div>
  )
}
