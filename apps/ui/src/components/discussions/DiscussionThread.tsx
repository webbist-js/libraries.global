"use client"

import { ArrowLeft, Check, CornerDownRight } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"

import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"

import {
  discussionAuthor,
  discussionErrorKey,
  discussionRequest,
  orderedDiscussionReplies,
  type DiscussionList,
  type DiscussionLanguage,
  type DiscussionRecord,
} from "./api"
import { DiscussionComposer } from "./DiscussionComposer"
import { DiscussionRecordCard } from "./DiscussionRecordCard"
import { useDiscussionActor } from "./useDiscussionActor"

export function DiscussionThread(props: {
  id: string
  language?: string
  languages?: readonly DiscussionLanguage[]
  embedded?: boolean
}) {
  const actor = useDiscussionActor()

  return <DiscussionThreadPanel {...props} key={actor.scope} actor={actor} />
}

function DiscussionThreadPanel({
  id,
  language,
  actor,
  languages = [],
  embedded = false,
}: {
  id: string
  language?: string
  languages?: readonly DiscussionLanguage[]
  embedded?: boolean
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
  const [replies, setReplies] = useState<DiscussionRecord[]>([])
  const [ownThreads, setOwnThreads] = useState<DiscussionRecord[]>([])
  const [ownReplies, setOwnReplies] = useState<DiscussionRecord[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [ownReplyOffset, setOwnReplyOffset] = useState<number | null>(null)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [quote, setQuote] = useState<{
    kind: "thread" | "reply"
    id: string
    version: number
  } | null>(null)
  const [removeConfirm, setRemoveConfirm] = useState(false)
  const [removeReason, setRemoveReason] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const current = await discussionRequest<DiscussionRecord>(
      `threads/${encodeURIComponent(id)}`
    )
    const [visible, ownT, ownR] = await Promise.all([
      current.state === "visible"
        ? discussionRequest<DiscussionList<DiscussionRecord>>(
            `threads/${encodeURIComponent(id)}/replies?limit=20`
          )
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
    ])
    if (currentScope.current !== scope) return
    setLoadedScope(scope)
    setThread(current)
    setReplies(visible.data)
    setNextOffset(visible.nextOffset ?? null)
    setOwnThreads(ownT.data)
    setOwnReplies(ownR.data)
    setOwnReplyOffset(ownR.nextOffset ?? null)
    setError("")
  }, [id, actor.signedIn, scope])
  useEffect(() => {
    if (!actor.ready) return
    let cancelled = false
    load().catch((failure) => {
      if (!cancelled && currentScope.current === scope) {
        setThread(null)
        setLoadedScope(scope)
        setError(t(discussionErrorKey(failure)))
      }
    })

    return () => {
      cancelled = true
    }
  }, [load, actor.ready, scope, t])
  const action = async (path: string, input: unknown) => {
    setBusy(true)
    setError("")
    try {
      await discussionRequest(path, "PUT", input)
      setNotice(t("saved"))
      await load()

      return true
    } catch (failure) {
      setError(t(discussionErrorKey(failure)))

      return false
    } finally {
      setBusy(false)
    }
  }
  if (!actor.ready) return <p role="status">{t("loading")}</p>
  if (error && (!thread || loadedScope !== scope))
    return <p role="alert">{error}</p>
  if (!thread || loadedScope !== scope)
    return <p role="status">{t("loading")}</p>
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
    return <p role="status">{t("unavailable")}</p>
  const pendingReplies = (actor.signedIn ? ownReplies : []).filter(
    (record) => !replies.some((reply) => reply.id === record.id)
  )
  const canReply =
    actor.signedIn && !thread.locked && thread.viewer?.canReply !== false
  const canReact = actor.signedIn && thread.viewer?.canReact !== false
  const canModerate = actor.canModerate && thread.viewer?.canModerate !== false

  return (
    <div className="grid gap-6">
      {!embedded && (
        <header className="grid gap-4 border-b border-(--t-border-line) pb-6">
          <Link
            href="/community/discussions"
            className="inline-flex items-center gap-2 text-sm font-semibold text-(--t-accent-primary)"
          >
            <ArrowLeft size={16} aria-hidden />
            {t("back")}
          </Link>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-(--t-palette-violet-bg) px-3 py-1 text-(--t-palette-violet-fg)">
              {thread.subject?.name ?? t("threads")}
            </span>
            <span className="rounded-full bg-(--t-bg-muted) px-3 py-1">
              {languageName(thread.language, languages, locale)}
            </span>
          </div>
          <h1
            className="m-0 max-w-4xl font-serif text-4xl leading-tight tracking-tight sm:text-5xl"
            lang={thread.language}
          >
            {thread.title ||
              ownThread?.pendingRevision?.title ||
              ownThread?.latestRevision?.title ||
              t("untitled")}
          </h1>
        </header>
      )}
      <DiscussionRecordCard
        key={`${actor.scope}:${thread.id}`}
        record={ownThread ?? thread}
        kind="thread"
        own={Boolean(ownThread)}
        signedIn={actor.signedIn}
        locked={thread.locked}
        onReload={load}
        canReact={canReact}
        canReply={canReply}
        canSanction={thread.viewer?.canSanction === true}
        onReply={() => {
          setReplyTo(null)
          document
            .getElementById(`discussion-composer-${id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
        }}
        onQuote={() => {
          setQuote({ kind: "thread", id: thread.id, version: thread.version })
          document
            .getElementById(`discussion-composer-${id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
        }}
      />
      {thread.locked && <p role="status">{t("locked")}</p>}
      {actor.signedIn &&
        thread.state === "visible" &&
        typeof thread.subscribed === "boolean" && (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              aria-pressed={thread.subscribed}
              className="inline-flex items-center gap-2 rounded-full border border-(--t-accent-primary) px-5 py-2.5 font-semibold text-(--t-accent-primary)"
              onClick={() =>
                action(`threads/${encodeURIComponent(id)}/subscription`, {
                  enabled: !thread.subscribed,
                })
              }
            >
              {thread.subscribed && <Check size={16} aria-hidden />}
              {t(thread.subscribed ? "unfollow" : "follow")}
            </button>
          </div>
        )}
      {canModerate && (
        <div className="flex flex-wrap gap-3">
          {(
            [
              thread.locked ? "unlock" : "lock",
              thread.pinned ? "unpin" : "pin",
              "remove",
            ] as const
          ).map((command) => (
            <button
              key={command}
              type="button"
              disabled={busy || thread.state === "removed"}
              onClick={() =>
                command === "remove"
                  ? setRemoveConfirm(true)
                  : action(
                      `moderation/records/thread/${encodeURIComponent(id)}`,
                      {
                        action: command,
                        baseVersion: thread.version,
                      }
                    )
              }
            >
              {t(command)}
            </button>
          ))}
        </div>
      )}
      {removeConfirm && canModerate && (
        <form
          className="grid gap-3 rounded-2xl border border-(--t-palette-coral-fg) bg-(--t-palette-coral-soft) p-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!removeReason.trim()) return
            action(`moderation/records/thread/${encodeURIComponent(id)}`, {
              action: "remove",
              baseVersion: thread.version,
              contributorFeedback: removeReason.trim(),
            }).then((success) => {
              if (success) setRemoveConfirm(false)
            })
          }}
        >
          <h3 className="m-0 font-semibold">{t("confirmRemoval")}</h3>
          <p className="m-0 text-sm">{t("removalLead")}</p>
          <label>
            {t("removalReason")}
            <textarea
              required
              maxLength={2000}
              value={removeReason}
              onChange={(event) => setRemoveReason(event.target.value)}
              className="mt-1 block w-full rounded-xl border bg-(--t-bg-deep) p-3"
            />
          </label>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={busy || !removeReason.trim()}
              className="rounded-full bg-(--t-palette-coral-fg) px-4 py-2 text-white"
            >
              {t("confirmRemove")}
            </button>
            <button type="button" onClick={() => setRemoveConfirm(false)}>
              {t("cancel")}
            </button>
          </div>
        </form>
      )}
      {thread.state === "visible" && (
        <section aria-label={t("replies")} className="grid gap-4">
          <h2 className="text-xl font-semibold">{t("replies")}</h2>
          {replies.length === 0 && <p>{t("noReplies")}</p>}
          {orderedDiscussionReplies(replies).map(
            ({ record: reply, depth, parent }) => (
              <div
                key={reply.id}
                className={
                  depth
                    ? "ml-3 border-l-2 border-(--t-palette-violet-bg) pl-3 sm:ml-6 sm:pl-5"
                    : ""
                }
              >
                {reply.parentId && (
                  <p className="mb-2 flex items-center gap-2 text-sm text-(--t-ink-dim)">
                    <CornerDownRight size={15} aria-hidden />
                    <a
                      href={`#discussion-reply-${encodeURIComponent(reply.parentId)}`}
                      className="underline"
                    >
                      {parent
                        ? t("replyTo", {
                            name: discussionAuthor(parent.author, t("member"))
                              .name,
                          })
                        : t("parentMessage")}
                    </a>
                  </p>
                )}
                <DiscussionRecordCard
                  key={`${actor.scope}:${reply.id}`}
                  record={
                    actor.signedIn
                      ? (ownReplies.find((own) => own.id === reply.id) ?? reply)
                      : reply
                  }
                  kind="reply"
                  own={ownReplyIds.has(reply.id)}
                  signedIn={actor.signedIn}
                  locked={!(reply.viewer?.canReply ?? canReply)}
                  onReload={load}
                  canReact={reply.viewer?.canReact ?? canReact}
                  canReply={reply.viewer?.canReply ?? canReply}
                  canSanction={
                    reply.viewer?.canSanction ??
                    thread.viewer?.canSanction ??
                    false
                  }
                  onReply={() => {
                    setReplyTo(reply.parentId ?? reply.id)
                    setQuote(null)
                    document
                      .getElementById(`discussion-composer-${id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }}
                  onQuote={() => {
                    setQuote({
                      kind: "reply",
                      id: reply.id,
                      version: reply.version,
                    })
                    setReplyTo(reply.parentId ?? reply.id)
                    document
                      .getElementById(`discussion-composer-${id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }}
                />
              </div>
            )
          )}
          {nextOffset !== null && (
            <button
              type="button"
              onClick={() =>
                discussionRequest<DiscussionList<DiscussionRecord>>(
                  `threads/${encodeURIComponent(id)}/replies?limit=20&offset=${nextOffset}`
                )
                  .then((result) => {
                    if (currentScope.current !== scope) return
                    setReplies((previous) => [...previous, ...result.data])
                    setNextOffset(result.nextOffset ?? null)
                  })
                  .catch((failure) => setError(t(discussionErrorKey(failure))))
              }
            >
              {t("loadMore")}
            </button>
          )}
        </section>
      )}
      {(pendingReplies.length > 0 || ownReplyOffset !== null) && (
        <section aria-label={t("yourPending")} className="grid gap-3">
          <h2>{t("yourPending")}</h2>
          {pendingReplies.map((reply) => (
            <DiscussionRecordCard
              key={`${actor.scope}:${reply.id}`}
              record={reply}
              kind="reply"
              own
              signedIn={actor.signedIn}
              locked={thread.locked}
              onReload={load}
            />
          ))}
          {ownReplyOffset !== null && (
            <button
              type="button"
              onClick={() => {
                discussionRequest<DiscussionList<DiscussionRecord>>(
                  `my/records?kind=reply&threadId=${encodeURIComponent(id)}&limit=50&offset=${ownReplyOffset}`
                )
                  .then((result) => {
                    if (currentScope.current !== scope) return
                    setOwnReplies((previous) => [...previous, ...result.data])
                    setOwnReplyOffset(result.nextOffset ?? null)
                  })
                  .catch((failure) => setError(t(discussionErrorKey(failure))))
              }}
            >
              {t("loadMore")}
            </button>
          )}
        </section>
      )}
      {thread.state === "visible" && (
        <>
          {(replyTo || quote) && (
            <p>
              {t("replySelected")}{" "}
              <button
                type="button"
                onClick={() => {
                  setReplyTo(null)
                  setQuote(null)
                }}
              >
                {t("cancel")}
              </button>
            </p>
          )}
          <div id={`discussion-composer-${id}`}>
            <DiscussionComposer
              key={actor.scope}
              threadId={id}
              language={language ?? thread.language}
              parentId={replyTo}
              quote={quote}
              languages={languages}
              returnTo={
                typeof window === "undefined"
                  ? `/community/discussions/${encodeURIComponent(id)}`
                  : `${window.location.pathname}${window.location.search}${embedded ? "#discussion" : window.location.hash}`
              }
              subjectId={thread.subjectId}
              signedIn={actor.signedIn}
              disabled={!canReply}
              disabledMessage={thread.locked ? t("locked") : t("notAllowed")}
              onSubmitted={() => {
                setReplyTo(null)
                setQuote(null)
                load().catch((failure) =>
                  setError(t(discussionErrorKey(failure)))
                )
              }}
            />
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  )
}
