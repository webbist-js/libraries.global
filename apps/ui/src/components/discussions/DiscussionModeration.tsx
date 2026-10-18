"use client"

import {
  ClipboardCheck,
  Flag,
  LockKeyhole,
  MessagesSquare,
  RefreshCw,
  ShieldAlert,
} from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  discussionErrorKey,
  discussionRequest,
  type DiscussionList,
  type DiscussionReport,
  type DiscussionRevision,
} from "@/components/discussions/api"
import { DiscussionReportReviewCard } from "@/components/discussions/DiscussionReportReviewCard"
import { DiscussionRestrictions } from "@/components/discussions/DiscussionRestrictions"
import { DiscussionReviewCard } from "@/components/discussions/DiscussionReviewCard"
import { DiscussionReviewSkeleton } from "@/components/discussions/DiscussionSkeleton"
import { useDiscussionActor } from "@/components/discussions/useDiscussionActor"
import { Badge } from "@/components/ds/Badge"
import { EmptyState } from "@/components/ds/EmptyState"
import { cn } from "@/lib/styles"

type ReviewView = "messages" | "reports" | "restrictions"
const pill =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-4 py-2 text-[13px] font-semibold hover:border-(--t-accent-primary) disabled:opacity-50"

export function DiscussionModeration() {
  const actor = useDiscussionActor()

  return (
    <div className="w-full min-w-0">
      <DiscussionModerationPanel key={actor.scope} actor={actor} />
    </div>
  )
}

function DiscussionModerationPanel({
  actor,
}: {
  actor: ReturnType<typeof useDiscussionActor>
}) {
  const t = useTranslations("discussions")
  const workspace = useTranslations("moderationWorkspace")
  const formatter = useFormatter()
  const [revisions, setRevisions] = useState<DiscussionRevision[]>([])
  const [reports, setReports] = useState<DiscussionReport[]>([])
  const [totals, setTotals] = useState<{
    messages: number
    reports: number
  } | null>(null)
  const [view, setView] = useState<ReviewView>("messages")
  const [error, setError] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [paging, setPaging] = useState(false)
  const [loadedScope, setLoadedScope] = useState("")
  const [revisionOffset, setRevisionOffset] = useState<number | null>(null)
  const [reportOffset, setReportOffset] = useState<number | null>(null)
  const generation = useRef(0)
  const initialized = useRef(false)
  const clear = useCallback(() => {
    setRevisions([])
    setReports([])
    setTotals(null)
    setRevisionOffset(null)
    setReportOffset(null)
    setLoadedScope("")
  }, [])
  const load = useCallback(async () => {
    const request = ++generation.current
    setRefreshing(true)
    setPaging(false)
    try {
      const [proposals, flags] = await Promise.all([
        discussionRequest<DiscussionList<DiscussionRevision>>(
          "moderation/revisions?limit=20&reviewableOnly=true"
        ),
        discussionRequest<DiscussionList<DiscussionReport>>(
          "moderation/reports?limit=20"
        ),
      ])
      if (request !== generation.current) return
      setRevisions(proposals.data)
      setReports(flags.data)
      setTotals({
        messages: proposals.total ?? proposals.data.length,
        reports: flags.total ?? flags.data.length,
      })
      setRevisionOffset(proposals.nextOffset ?? null)
      setReportOffset(flags.nextOffset ?? null)
      setLoadedScope(actor.scope)
      setError("")
      if (!initialized.current) {
        setView(
          !proposals.data.length && flags.data.length ? "reports" : "messages"
        )
        initialized.current = true
      }
    } catch (failure) {
      if (request === generation.current) {
        clear()
        setError(t(discussionErrorKey(failure)))
      }
      throw failure
    } finally {
      if (request === generation.current) setRefreshing(false)
    }
  }, [actor.scope, clear, t])
  useEffect(() => {
    if (!actor.ready || !actor.canModerate) return
    load().catch(() => {})

    const activeGeneration = generation

    return () => {
      activeGeneration.current++
    }
  }, [load, actor.ready, actor.canModerate])
  const loadMore = async (kind: "messages" | "reports") => {
    const offset = kind === "messages" ? revisionOffset : reportOffset
    if (paging || refreshing || offset === null) return
    const request = generation.current
    setPaging(true)
    try {
      if (kind === "messages") {
        const result = await discussionRequest<
          DiscussionList<DiscussionRevision>
        >(`moderation/revisions?limit=20&reviewableOnly=true&offset=${offset}`)
        if (request !== generation.current) return
        setRevisions((previous) => [
          ...new Map(
            [...previous, ...result.data].map((record) => [record.id, record])
          ).values(),
        ])
        setRevisionOffset(result.nextOffset ?? null)
      } else {
        const result = await discussionRequest<
          DiscussionList<DiscussionReport>
        >(`moderation/reports?limit=20&offset=${offset}`)
        if (request !== generation.current) return
        setReports((previous) => [
          ...new Map(
            [...previous, ...result.data].map((record) => [record.id, record])
          ).values(),
        ])
        setReportOffset(result.nextOffset ?? null)
      }
    } catch (failure) {
      if (request === generation.current) {
        clear()
        setError(t(discussionErrorKey(failure)))
      }
    } finally {
      if (request === generation.current) setPaging(false)
    }
  }
  if (!actor.ready) return <DiscussionReviewSkeleton />
  if (!actor.canModerate) return <p role="status">{t("notAllowed")}</p>
  if (loadedScope !== actor.scope && !error) return <DiscussionReviewSkeleton />

  const filters = [
    {
      id: "messages",
      label: workspace("messages"),
      icon: ClipboardCheck,
      count: totals?.messages,
    },
    {
      id: "reports",
      label: workspace("reports"),
      icon: Flag,
      count: totals?.reports,
    },
    {
      id: "restrictions",
      label: workspace("restrictions"),
      icon: ShieldAlert,
      count: undefined,
    },
  ] as const

  return (
    <div className="grid gap-5 text-[16px] [--spacing:0.25rem]">
      <section className="grid gap-5 rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="m-0 flex items-center gap-2.5 font-serif text-[30px] leading-tight tracking-tight">
              <MessagesSquare
                size={23}
                className="text-(--t-accent-primary)"
                aria-hidden
              />
              {workspace("discussions")}
            </h2>
            <p className="mt-2 mb-0 max-w-[72ch] text-[14px] leading-relaxed text-(--t-ink-dim)">
              {t("moderationLead")}
            </p>
          </div>
          <button
            type="button"
            disabled={refreshing || paging}
            onClick={() => load().catch(() => {})}
            className={pill}
            aria-busy={refreshing}
          >
            <RefreshCw size={15} aria-hidden />
            {workspace("refresh")}
          </button>
        </header>
        <div
          role="group"
          aria-label={workspace("reviewType")}
          className="flex flex-wrap gap-2"
        >
          {filters.map((filter) => {
            const Icon = filter.icon

            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={view === filter.id}
                onClick={() => setView(filter.id)}
                className={cn(
                  pill,
                  view === filter.id &&
                    "border-(--t-accent-primary) bg-(--t-accent-chip) text-(--t-accent-primary)"
                )}
              >
                <Icon size={15} aria-hidden />
                {filter.label}
                {filter.count !== undefined && (
                  <Badge
                    color={view === filter.id ? "violet" : "dim"}
                    size="xs"
                    label={formatter.number(filter.count)}
                  />
                )}
              </button>
            )
          })}
        </div>
        <p className="m-0 flex items-center gap-1.5 border-t border-(--t-border-line) pt-3 text-[12px] text-(--t-ink-dim)">
          <LockKeyhole size={13} aria-hidden />
          {workspace("privateReview")}
        </p>
      </section>
      {error && (
        <p
          role="alert"
          className="m-0 rounded-[18px] border border-(--t-palette-coral-fg)/20 bg-(--t-palette-coral-soft) p-4 text-[14px] text-(--t-palette-coral-fg)"
        >
          {error}
        </p>
      )}
      {loadedScope === actor.scope && (
        <>
          <section
            aria-label={t("proposals")}
            hidden={view !== "messages"}
            className={view === "messages" ? "grid gap-4" : "hidden"}
          >
            <h2 className="sr-only">{t("proposals")}</h2>
            <p className="m-0 text-[13px] text-(--t-ink-dim)">
              {workspace("messagesLead")}
            </p>
            {!revisions.length && (
              <div className="rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep)">
                <EmptyState
                  compact
                  message={t("emptyQueue")}
                  icon="mdi:clipboard-check-outline"
                />
              </div>
            )}
            {revisions.map((revision) => (
              <DiscussionReviewCard
                key={revision.id}
                revision={revision}
                onReload={load}
                showThread
              />
            ))}
            {revisionOffset !== null && (
              <button
                type="button"
                disabled={paging || refreshing}
                className={cn(pill, "justify-self-center")}
                onClick={() => void loadMore("messages")}
              >
                {t("loadMore")}
              </button>
            )}
          </section>
          <section
            aria-label={t("reports")}
            hidden={view !== "reports"}
            className={view === "reports" ? "grid gap-4" : "hidden"}
          >
            <h2 className="sr-only">{t("reports")}</h2>
            <p className="m-0 text-[13px] leading-relaxed text-(--t-ink-dim)">
              {workspace("reportsLead")}
            </p>
            {!reports.length && (
              <div className="rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep)">
                <EmptyState
                  compact
                  lead={workspace("noReports")}
                  detail={workspace("noReportsLead")}
                  icon="mdi:flag-checkered"
                />
              </div>
            )}
            {reports.map((report) => (
              <DiscussionReportReviewCard
                key={report.id}
                report={report}
                onReload={load}
              />
            ))}
            {reportOffset !== null && (
              <button
                type="button"
                disabled={paging || refreshing}
                className={cn(pill, "justify-self-center")}
                onClick={() => void loadMore("reports")}
              >
                {t("loadMore")}
              </button>
            )}
          </section>
          <div hidden={view !== "restrictions"}>
            <p className="mt-0 mb-4 text-[13px] text-(--t-ink-dim)">
              {workspace("restrictionLead")}
            </p>
            <DiscussionRestrictions
              key={actor.scope}
              scope={actor.scope}
              moderation
              showEmpty
            />
          </div>
        </>
      )}
    </div>
  )
}
