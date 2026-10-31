"use client"

import {
  ArrowUpRight,
  Check,
  Clock3,
  Languages,
  Link2,
  MessageCircle,
  MessageSquare,
  UsersRound,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import {
  DiscussionReviewSkeleton,
  DiscussionThreadSkeleton,
} from "@/components/discussions/DiscussionSkeleton"
import { DiscussionThreadHeading } from "@/components/discussions/DiscussionThreadHeading"
import { Badge } from "@/components/ds/Badge"
import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"

import {
  discussionAuthor,
  discussionReplyFlow,
  discussionErrorKey,
  discussionHref,
  discussionRequest,
  orderedDiscussionReplies,
  loadDiscussionReplyPages,
  mergeDiscussionRecords,
  type DiscussionList,
  type DiscussionLanguage,
  type DiscussionRecord,
  type DiscussionImage,
} from "./api"
import { DiscussionComposer } from "./DiscussionComposer"
import { DiscussionModeratorToolbar } from "./DiscussionModeratorToolbar"
import {
  DiscussionRelativeTime,
  subjectPalette,
} from "./DiscussionPresentation"
import { DiscussionRecordCard } from "./DiscussionRecordCard"
import { DiscussionReplyBranch } from "./DiscussionReplyBranch"
import { DiscussionReviewCard } from "./DiscussionReviewCard"
import { DiscussionThreadSidebar } from "./DiscussionThreadSidebar"
import { useDiscussionActor } from "./useDiscussionActor"
import { useThreadModeration } from "./useThreadModeration"

export function DiscussionThread(props: {
  id: string
  language?: string
  languages?: readonly DiscussionLanguage[]
  embedded?: boolean
  variant?: "default" | "suggestion"
  returnTo?: string
  footerAction?: ReactNode
  onActivity?: (thread: DiscussionRecord, latest?: DiscussionRecord) => void
}) {
  const actor = useDiscussionActor()

  return (
    <DiscussionThreadPanel
      {...props}
      key={`${props.id}:${actor.scope}`}
      actor={actor}
    />
  )
}

function DiscussionThreadPanel({
  id,
  language,
  actor,
  languages = [],
  embedded = false,
  variant = "default",
  returnTo,
  footerAction,
  onActivity,
}: {
  id: string
  language?: string
  languages?: readonly DiscussionLanguage[]
  embedded?: boolean
  variant?: "default" | "suggestion"
  returnTo?: string
  footerAction?: ReactNode
  onActivity?: (thread: DiscussionRecord, latest?: DiscussionRecord) => void
  actor: ReturnType<typeof useDiscussionActor>
}) {
  const t = useTranslations("discussions")
  const locale = useLocale()
  const scope = `${id}:${actor.scope}`
  const currentScope = useRef(scope)
  useEffect(() => {
    currentScope.current = scope
  }, [scope])
  const [loadedScope, setLoadedScope] = useState("")
  const [thread, setThread] = useState<DiscussionRecord | null>(null)
  const [related, setRelated] = useState<DiscussionRecord[]>([])
  const [replies, setReplies] = useState<DiscussionRecord[]>([])
  const [ownThreads, setOwnThreads] = useState<DiscussionRecord[]>([])
  const [ownReplies, setOwnReplies] = useState<DiscussionRecord[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [ownReplyOffset, setOwnReplyOffset] = useState<number | null>(null)
  const loadedReplyPages = useRef(1)
  const inlineSuggestion = variant === "suggestion"
  const historyStart = useRef<number | null>(null)
  const [earlierOffset, setEarlierOffset] = useState(0)
  const [openingExpanded, setOpeningExpanded] = useState(false)
  const [earlierBusy, setEarlierBusy] = useState(false)
  const composerRef = useRef<HTMLDivElement>(null)
  const joinComposerRef = useRef<HTMLDivElement>(null)
  const [joinOpen, setJoinOpen] = useState(false)
  useEffect(() => {
    if (!joinOpen) return
    joinComposerRef.current?.scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
    })
    joinComposerRef.current
      ?.querySelector<HTMLTextAreaElement>("textarea")
      ?.focus({ preventScroll: true })
  }, [joinOpen])
  const [composerAnchor, setComposerAnchor] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState<{
    body: string
    language?: string
  }>({ body: "", language: inlineSuggestion ? undefined : language })
  const [draftImages, setDraftImages] = useState<
    (DiscussionImage & { subjectId?: string })[]
  >([])
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [quote, setQuote] = useState<{
    kind: "thread" | "reply"
    id: string
    version: number
  } | null>(null)
  const [joinQuote, setJoinQuote] = useState<{
    kind: "thread"
    id: string
    version: number
  } | null>(null)
  const [memberPreview, setMemberPreview] = useState(false)
  const moderatorAccess =
    !inlineSuggestion &&
    actor.canModerate &&
    thread?.viewer?.canModerate === true
  const moderatorView = moderatorAccess && !memberPreview
  const privatePrimaryContext = thread?.contexts?.some(
    (link) => link.targetPublic === false && link.url === thread.target?.url
  )
  const moderation = useThreadModeration(id, moderatorView)
  const [error, setError] = useState("")
  const [readRetryable, setReadRetryable] = useState(false)
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const current = await discussionRequest<DiscussionRecord>(
      `threads/${encodeURIComponent(id)}`
    )
    const [visible, ownT, ownR, more] = await Promise.all([
      current.state === "visible"
        ? inlineSuggestion
          ? (async () => {
              // Load the latest public messages first; older pages are requested on demand.
              const start = Math.min(
                historyStart.current ??
                  Math.max(0, (current.replyCount ?? 0) - 3),
                Math.max(0, (current.replyCount ?? 0) - 3)
              )
              let offset = start
              let records: DiscussionRecord[] = []
              let next: number | null = offset
              while (next !== null) {
                const page = await discussionRequest<
                  DiscussionList<DiscussionRecord>
                >(
                  `threads/${encodeURIComponent(id)}/replies?limit=20&offset=${offset}&order=chronological`
                )
                records = mergeDiscussionRecords(records, page.data)
                next = page.nextOffset ?? null
                if (next === null || next <= offset) break
                offset = next
              }

              return { data: records, nextOffset: null, earlierOffset: start }
            })()
          : loadDiscussionReplyPages(id, loadedReplyPages.current)
        : { data: [], nextOffset: null },
      actor.signedIn
        ? discussionRequest<DiscussionList<DiscussionRecord>>(
            `my/records?kind=thread&recordId=${encodeURIComponent(id)}&limit=1`
          )
        : { data: [] },
      actor.signedIn
        ? discussionRequest<DiscussionList<DiscussionRecord>>(
            `my/records?kind=reply&threadId=${encodeURIComponent(id)}&limit=50`
          )
        : { data: [], nextOffset: null },
      !embedded && current.state === "visible"
        ? discussionRequest<DiscussionList<DiscussionRecord>>(
            `threads?subjectId=${encodeURIComponent(current.subjectId)}&limit=4`
          ).catch(() => ({ data: [] }))
        : { data: [] },
    ])
    if (currentScope.current !== scope) return
    setLoadedScope(scope)
    setThread(current)
    setRelated(
      (more.data ?? [])
        .filter((item) => item.id !== id && item.state === "visible")
        .slice(0, 3)
    )
    setReplies(visible.data)
    if ("earlierOffset" in visible)
      setEarlierOffset(visible.earlierOffset as number)
    setNextOffset(visible.nextOffset ?? null)
    setOwnThreads(ownT.data)
    setOwnReplies(ownR.data)
    setOwnReplyOffset(ownR.nextOffset ?? null)
    setError("")
    setReadRetryable(false)
    if (current.state === "visible")
      onActivity?.(
        current,
        visible.data.find((reply) => reply.createdAt === current.lastReplyAt)
      )
  }, [id, actor.signedIn, scope, embedded, inlineSuggestion, onActivity])
  const handleLoadFailure = useCallback(
    (failure: unknown) => {
      if (currentScope.current !== scope) return
      const errorKey = discussionErrorKey(failure)
      setThread(null)
      setLoadedScope(scope)
      setReadRetryable(errorKey === "error" || errorKey === "invalidInput")
      setError(t(errorKey === "invalidInput" ? "error" : errorKey))
    },
    [scope, t]
  )
  useEffect(() => {
    if (!actor.ready) return
    let cancelled = false
    load().catch((failure) => {
      if (!cancelled) handleLoadFailure(failure)
    })

    return () => {
      cancelled = true
    }
  }, [load, actor.ready, handleLoadFailure])
  useEffect(() => {
    if (
      loadedScope !== scope ||
      !window.location.hash.startsWith("#discussion-")
    )
      return
    try {
      const anchor = decodeURIComponent(window.location.hash.slice(1, 200))
      document.getElementById(anchor)?.scrollIntoView({ block: "center" })
    } catch {
      // Ignore malformed fragments; thread access still comes from the API.
    }
  }, [loadedScope, scope, replies.length])
  useEffect(() => {
    if (!composerAnchor) return
    const composer = composerRef.current
    composer?.scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
    })
    composer
      ?.querySelector<HTMLTextAreaElement>("textarea")
      ?.focus({ preventScroll: true })
  }, [composerAnchor])
  const refresh = async () => {
    await Promise.all([load(), moderation.reload()])
  }
  const action = async (path: string, input: unknown) => {
    setBusy(true)
    setError("")
    try {
      await discussionRequest(path, "PUT", input)
      setNotice(t("saved"))
      await refresh()

      return true
    } catch (failure) {
      setError(t(discussionErrorKey(failure)))

      return false
    } finally {
      setBusy(false)
    }
  }
  const readStateHeader = !embedded ? (
    <DiscussionThreadHeading title={t("threads")} />
  ) : null
  if (!actor.ready)
    return <DiscussionThreadSkeleton embedded={embedded} variant={variant} />
  if (error && (!thread || loadedScope !== scope))
    return (
      <div className="grid justify-items-start gap-4">
        {readStateHeader}
        <p role="alert" className="m-0">
          {error}
        </p>
        {readRetryable && (
          <button
            type="button"
            className="cursor-pointer text-sm font-semibold underline"
            onClick={() => {
              setError("")
              setLoadedScope("")
              load().catch(handleLoadFailure)
            }}
          >
            {t("retry")}
          </button>
        )}
      </div>
    )
  if (!thread || loadedScope !== scope)
    return <DiscussionThreadSkeleton embedded={embedded} variant={variant} />
  const ownThread = actor.signedIn
    ? ownThreads.find((record) => record.id === id)
    : undefined
  const ownReplyIds = new Set(
    (actor.signedIn ? ownReplies : []).map((record) => record.id)
  )
  if (
    (thread.state === "pending" || thread.state === "rejected") &&
    (!actor.signedIn || (!ownThread && !actor.canModerate))
  )
    return (
      <div className="grid gap-4">
        {readStateHeader}
        <p role="status">{t("unavailable")}</p>
      </div>
    )
  const queuedRecords = new Set(
    moderatorView
      ? moderation.revisions.map((revision) => revision.recordId)
      : []
  )
  const ownInFlow = (actor.signedIn ? ownReplies : []).filter(
    (record) => !queuedRecords.has(record.id)
  )
  const replyFlow = discussionReplyFlow(replies, ownInFlow)
  const replyNumbers = new Map(
    orderedDiscussionReplies(replies).map(({ record }, index) => [
      record.id,
      index + 2,
    ])
  )
  const canReply =
    actor.signedIn &&
    thread.state === "visible" &&
    !thread.locked &&
    thread.viewer?.canReply !== false
  const canReact =
    actor.signedIn &&
    thread.state === "visible" &&
    thread.viewer?.canReact !== false

  const palette = subjectPalette(thread.subject)
  const targetHref = discussionHref(thread.target?.url)
  const replyCount = thread.replyCount ?? replies.length
  const showOpening =
    !inlineSuggestion ||
    openingExpanded ||
    replyCount < 3 ||
    thread.state !== "visible" ||
    Boolean(ownThread?.pendingRevision) ||
    Boolean(
      ownThread?.latestRevision &&
      !["approved", "pending"].includes(ownThread.latestRevision.state)
    )
  const hiddenEarlier = earlierOffset + (showOpening ? 0 : 1)
  const subscriptionControl = actor.signedIn &&
    thread.state === "visible" &&
    typeof thread.subscribed === "boolean" && (
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          aria-pressed={thread.subscribed}
          aria-label={t(thread.subscribed ? "unfollow" : "follow")}
          className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold ${thread.subscribed ? "border-(--t-ink-base) bg-(--t-bg-inverse) text-white" : "border-(--t-border-hi) bg-(--t-bg-deep) text-(--t-accent-primary)"}`}
          onClick={() =>
            action(`threads/${encodeURIComponent(id)}/subscription`, {
              enabled: !thread.subscribed,
            })
          }
        >
          {thread.subscribed && <Check size={16} aria-hidden />}
          {t(thread.subscribed ? "following" : "follow")}
        </button>
      </div>
    )
  const inlineComposer = replyFlow.some(
    ({ record }) =>
      record.id === composerAnchor &&
      !record.parentId &&
      record.state === "visible"
  )
  const focusJoinComposer = () => {
    setJoinOpen(true)
    joinComposerRef.current?.scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
    })
    joinComposerRef.current
      ?.querySelector<HTMLTextAreaElement>("textarea")
      ?.focus({ preventScroll: true })
  }
  const conversationFooter = inlineSuggestion ? (
    <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
      {footerAction}
      <Link
        href={`/community/discussions/${encodeURIComponent(id)}`}
        className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-(--t-ink-dim) hover:text-(--t-accent-primary) hover:underline"
      >
        {t("openDiscussion")}
        <ArrowUpRight size={14} aria-hidden />
      </Link>
    </div>
  ) : (
    footerAction
  )
  const commonComposerProps = {
    threadId: id,
    language: inlineSuggestion ? undefined : language,
    defaultLanguage: thread.language,
    compositionPreferences: actor.compositionPreferences,
    subject: thread.subject,
    languages,
    showSubmittedNotice: false,
    variant,
    footerAction: conversationFooter,
    returnTo:
      returnTo ??
      (typeof window === "undefined"
        ? `/community/discussions/${encodeURIComponent(id)}`
        : `${window.location.pathname}${window.location.search}${embedded ? "#discussion" : window.location.hash}`),
    subjectId: thread.subjectId,
    signedIn: actor.signedIn,
    disabled: !canReply,
    disabledMessage: thread.locked ? t("locked") : t("notAllowed"),
  }
  const composer = (
    <div
      ref={composerRef}
      id={`discussion-reply-composer-${id}`}
      className="scroll-mt-24"
    >
      <DiscussionComposer
        {...commonComposerProps}
        key={`${actor.scope}:${composerAnchor}`}
        language={
          replyDraft.language ?? (inlineSuggestion ? undefined : language)
        }
        initialBody={replyDraft.body}
        initialAttachments={draftImages}
        onDraftChange={({ body, language: draftLanguage }) =>
          setReplyDraft({ body, language: draftLanguage })
        }
        onAttachmentsChange={setDraftImages}
        parentId={replyTo}
        quote={quote}
        heading={
          quote
            ? t("quoteSelected")
            : t("replyTo", {
                name: discussionAuthor(
                  replyFlow.find(({ record }) => record.id === composerAnchor)
                    ?.record.author,
                  t("member")
                ).name,
              })
        }
        onCancel={
          composerAnchor
            ? () => {
                setComposerAnchor(null)
                setReplyTo(null)
                setQuote(null)
              }
            : undefined
        }
        onSubmitted={() => {
          setReplyDraft((draft) => ({ ...draft, body: "" }))
          setDraftImages([])
          setComposerAnchor(null)
          setReplyTo(null)
          setQuote(null)
          refresh().catch((failure) => setError(t(discussionErrorKey(failure))))
        }}
      />
    </div>
  )

  return (
    <div
      className={
        embedded
          ? "grid gap-6"
          : "grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-10"
      }
    >
      <div
        className={
          inlineSuggestion ? "grid min-w-0 gap-5" : "grid min-w-0 gap-6"
        }
      >
        {!embedded && (
          <DiscussionThreadHeading
            title={
              thread.title ||
              ownThread?.pendingRevision?.title ||
              ownThread?.latestRevision?.title ||
              t("untitled")
            }
            language={thread.language}
            context={
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <Badge
                  color="violet"
                  label={thread.subject?.name ?? t("threads")}
                  style={{ background: palette.bg, color: palette.fg }}
                />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-(--t-bg-muted) px-3 py-1 text-sm">
                  <Languages size={13} aria-hidden />
                  {languageName(thread.language, languages, locale)}
                </span>
                {targetHref && thread.target && (
                  <a
                    href={targetHref}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-sm text-(--t-accent-primary) hover:underline"
                    style={{ background: palette.soft }}
                  >
                    <Link2 size={13} className="shrink-0" aria-hidden />
                    <span className="min-w-0 break-words">
                      {thread.target.title}
                    </span>
                  </a>
                )}
              </div>
            }
            activity={
              thread.state === "visible" ? (
                <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-(--t-ink-dim)">
                  <span className="inline-flex items-center gap-1.5">
                    <UsersRound size={14} aria-hidden />
                    {t("peopleCount", {
                      count:
                        thread.participantCount ??
                        thread.participants?.length ??
                        1,
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MessageCircle size={14} aria-hidden />
                    {t("replyTotal", { count: replyCount })}
                  </span>
                  {(thread.lastReplyAt ?? thread.createdAt) && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 size={14} aria-hidden />
                      {thread.lastReplyAt ? t("lastReply") : t("started")}
                      <DiscussionRelativeTime
                        value={(thread.lastReplyAt ?? thread.createdAt)!}
                      />
                    </span>
                  )}
                </p>
              ) : (
                <p className="m-0 text-sm text-(--t-ink-dim)">
                  {t("privateConversation")}
                </p>
              )
            }
            action={subscriptionControl}
          />
        )}
        {moderatorAccess && (
          <DiscussionModeratorToolbar
            thread={thread}
            total={moderation.total}
            globalTotal={moderation.globalTotal}
            busy={busy}
            preview={memberPreview}
            onPreview={() => setMemberPreview((previous) => !previous)}
            onAction={(command) => {
              void action(
                `moderation/records/thread/${encodeURIComponent(id)}`,
                { action: command, baseVersion: thread.version }
              )
            }}
          />
        )}
        {memberPreview &&
        (thread.state !== "visible" ||
          thread.subject?.visibility === "private" ||
          privatePrimaryContext) ? (
          <p role="status">{t("memberPreviewUnavailable")}</p>
        ) : (
          <>
            {inlineSuggestion && hiddenEarlier > 0 && (
              <button
                type="button"
                disabled={earlierBusy}
                className="w-fit rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-4 py-2.5 text-sm font-semibold text-(--t-accent-primary) disabled:opacity-50"
                onClick={async () => {
                  const requestScope = scope
                  setEarlierBusy(true)
                  try {
                    const start = Math.max(0, earlierOffset - 20)
                    if (earlierOffset > 0) {
                      const result = await discussionRequest<
                        DiscussionList<DiscussionRecord>
                      >(
                        `threads/${encodeURIComponent(id)}/replies?limit=${earlierOffset - start}&offset=${start}&order=chronological`
                      )
                      if (currentScope.current !== requestScope) return
                      setReplies((previous) =>
                        mergeDiscussionRecords(result.data, previous)
                      )
                    }
                    historyStart.current = start
                    setEarlierOffset(start)
                    if (start === 0) setOpeningExpanded(true)
                  } catch (failure) {
                    if (currentScope.current === requestScope)
                      setError(t(discussionErrorKey(failure)))
                  } finally {
                    if (currentScope.current === requestScope)
                      setEarlierBusy(false)
                  }
                }}
              >
                {t("showEarlierReplies", {
                  count: Math.min(hiddenEarlier, 20),
                })}
              </button>
            )}
            {showOpening && (
              <DiscussionRecordCard
                key={`${actor.scope}:${thread.id}`}
                record={
                  moderatorView && queuedRecords.has(id)
                    ? thread
                    : (ownThread ?? thread)
                }
                kind="thread"
                layout={inlineSuggestion ? "suggestion" : "conversation"}
                number={inlineSuggestion ? undefined : 1}
                own={Boolean(ownThread)}
                signedIn={actor.signedIn}
                locked={thread.locked}
                onReload={refresh}
                canReact={canReact}
                canReply={canReply}
                canModerate={moderatorView}
                canSanction={
                  moderatorView && thread.viewer?.canSanction === true
                }
                onReply={() => {
                  setJoinQuote(null)
                  focusJoinComposer()
                }}
                onQuote={() => {
                  setJoinQuote({
                    kind: "thread",
                    id: thread.id,
                    version: thread.version,
                  })
                  focusJoinComposer()
                }}
              />
            )}
            {thread.locked && <p role="status">{t("locked")}</p>}
            {embedded && !inlineSuggestion && subscriptionControl}
            {thread.state === "visible" && (
              <section aria-label={t("replies")} className="grid gap-4">
                {!inlineSuggestion && replyFlow.length > 0 && (
                  <h2 className="type-small-heading m-0 flex items-center gap-2 text-(--t-ink-dim)">
                    <MessageSquare size={17} aria-hidden />
                    {t("replyTotal", { count: replyCount })}
                  </h2>
                )}
                {replyFlow.length === 0 && !inlineSuggestion && (
                  <p className="m-0 text-sm text-(--t-ink-dim)">
                    {t("noReplies")}
                  </p>
                )}
                {replyFlow.map(({ record: reply, depth, parent }) => (
                  <DiscussionReplyBranch
                    key={reply.id}
                    depth={depth}
                    compact={inlineSuggestion}
                  >
                    <DiscussionRecordCard
                      key={`${actor.scope}:${reply.id}`}
                      record={reply}
                      kind="reply"
                      layout={inlineSuggestion ? "suggestion" : "conversation"}
                      number={
                        inlineSuggestion
                          ? undefined
                          : replyNumbers.get(reply.id)
                      }
                      replyingTo={
                        reply.parentId
                          ? {
                              id: reply.parentId,
                              name: discussionAuthor(
                                parent?.author ?? reply.parent?.author,
                                t("member")
                              ).name,
                            }
                          : undefined
                      }
                      own={ownReplyIds.has(reply.id)}
                      signedIn={actor.signedIn}
                      locked={thread.locked}
                      onReload={refresh}
                      canReact={reply.viewer?.canReact ?? canReact}
                      canReply={
                        !reply.parentId && (reply.viewer?.canReply ?? canReply)
                      }
                      canModerate={
                        !inlineSuggestion &&
                        !memberPreview &&
                        actor.canModerate &&
                        reply.viewer?.canModerate === true
                      }
                      canSanction={
                        !inlineSuggestion &&
                        !memberPreview &&
                        actor.canModerate &&
                        reply.viewer?.canSanction === true
                      }
                      onReply={() => {
                        setReplyTo(reply.id)
                        setQuote(null)
                        setComposerAnchor(reply.id)
                      }}
                      onQuote={() => {
                        setQuote({
                          kind: "reply",
                          id: reply.id,
                          version: reply.version,
                        })
                        setReplyTo(reply.id)
                        setComposerAnchor(reply.id)
                      }}
                    />
                    {inlineComposer && composerAnchor === reply.id && (
                      <div className="mt-4">{composer}</div>
                    )}
                  </DiscussionReplyBranch>
                ))}
                {nextOffset !== null && (
                  <button
                    type="button"
                    onClick={() =>
                      discussionRequest<DiscussionList<DiscussionRecord>>(
                        `threads/${encodeURIComponent(id)}/replies?limit=20&offset=${nextOffset}`
                      )
                        .then((result) => {
                          if (currentScope.current !== scope) return
                          loadedReplyPages.current = Math.max(
                            loadedReplyPages.current,
                            Math.floor(nextOffset / 20) + 1
                          )
                          setReplies((previous) =>
                            mergeDiscussionRecords(previous, result.data)
                          )
                          setNextOffset(result.nextOffset ?? null)
                        })
                        .catch((failure) =>
                          setError(t(discussionErrorKey(failure)))
                        )
                    }
                  >
                    {t("loadMore")}
                  </button>
                )}
              </section>
            )}
            {actor.signedIn && ownReplyOffset !== null && (
              <div>
                {ownReplyOffset !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      discussionRequest<DiscussionList<DiscussionRecord>>(
                        `my/records?kind=reply&threadId=${encodeURIComponent(id)}&limit=50&offset=${ownReplyOffset}`
                      )
                        .then((result) => {
                          if (currentScope.current !== scope) return
                          setOwnReplies((previous) => [
                            ...previous,
                            ...result.data,
                          ])
                          setOwnReplyOffset(result.nextOffset ?? null)
                        })
                        .catch((failure) =>
                          setError(t(discussionErrorKey(failure)))
                        )
                    }}
                  >
                    {t("loadMore")}
                  </button>
                )}
              </div>
            )}
            {moderatorView &&
              (moderation.total !== 0 || Boolean(moderation.error)) && (
                <section aria-label={t("waitingReview")} className="grid gap-3">
                  <header>
                    <h2 className="type-label m-0 text-(--t-palette-amber-fg) uppercase">
                      <span
                        aria-hidden
                        className="mr-2 inline-block size-2 rounded-full bg-[#d88b18]"
                      />
                      {t("waitingReview")} · {moderation.total ?? "…"}
                    </h2>
                    <p className="mt-1 mb-0 text-sm text-(--t-ink-dim)">
                      {t("queuePrivacy")}
                    </p>
                  </header>
                  {moderation.error ? (
                    <div className="text-sm">
                      <p role="alert">
                        {t(discussionErrorKey(moderation.error))}
                      </p>
                      <button
                        type="button"
                        onClick={() => moderation.reload()}
                        className="font-semibold underline"
                      >
                        {t("reload")}
                      </button>
                    </div>
                  ) : moderation.loading && moderation.total === null ? (
                    <DiscussionReviewSkeleton />
                  ) : (
                    <>
                      {moderation.revisions.map((revision) => (
                        <DiscussionReviewCard
                          key={revision.id}
                          revision={revision}
                          onReload={refresh}
                        />
                      ))}
                      {moderation.nextOffset !== null && (
                        <button
                          type="button"
                          className="justify-self-start text-sm font-semibold underline"
                          disabled={moderation.loading}
                          onClick={() => moderation.loadMore()}
                        >
                          {t("loadMore")}
                        </button>
                      )}
                    </>
                  )}
                </section>
              )}
            {thread.state === "visible" && (
              <div
                ref={joinComposerRef}
                id={`discussion-composer-${id}`}
                className="scroll-mt-24"
              >
                {joinQuote && (
                  <p className="mt-0 mb-2 text-sm text-(--t-ink-dim)">
                    {t("quoteSelected")}
                  </p>
                )}
                <DiscussionComposer
                  {...commonComposerProps}
                  key={`${actor.scope}:join`}
                  collapsed={!inlineSuggestion && !joinOpen}
                  onExpand={focusJoinComposer}
                  quote={joinQuote}
                  onCancel={
                    !inlineSuggestion || joinQuote
                      ? () => {
                          setJoinQuote(null)
                          setJoinOpen(false)
                        }
                      : undefined
                  }
                  onSubmitted={() => {
                    setJoinQuote(null)
                    refresh().catch((failure) =>
                      setError(t(discussionErrorKey(failure)))
                    )
                  }}
                />
              </div>
            )}
          </>
        )}
        {inlineSuggestion && thread.state !== "visible" && conversationFooter}
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
      </div>
      {!embedded && (
        <DiscussionThreadSidebar
          memberPreview={memberPreview}
          onContextChanged={
            memberPreview
              ? undefined
              : () => refresh().catch(() => setError(t("error")))
          }
          thread={thread}
          related={related}
          moderation={moderatorView ? moderation : undefined}
          hideMemberContext={
            memberPreview &&
            (thread.state !== "visible" ||
              thread.subject?.visibility === "private" ||
              privatePrimaryContext)
          }
        />
      )}
    </div>
  )
}
