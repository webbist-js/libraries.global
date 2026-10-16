"use client"

import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  discussionErrorKey,
  discussionRequest,
  type DiscussionList,
  type DiscussionRecord,
} from "./api"
import { DiscussionComposer } from "./DiscussionComposer"
import { DiscussionRecordCard } from "./DiscussionRecordCard"
import { useDiscussionActor } from "./useDiscussionActor"

export function DiscussionThread(props: { id: string; language?: string }) {
  const actor = useDiscussionActor()

  return <DiscussionThreadPanel {...props} key={actor.scope} actor={actor} />
}

function DiscussionThreadPanel({
  id,
  language,
  actor,
}: {
  id: string
  language?: string
  actor: ReturnType<typeof useDiscussionActor>
}) {
  const t = useTranslations("discussions")
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
    } catch (failure) {
      setError(t(discussionErrorKey(failure)))
    } finally {
      setBusy(false)
    }
  }
  if (error && (!thread || loadedScope !== scope))
    return <p role="alert">{error}</p>
  if (!thread || loadedScope !== scope)
    return <p role="status">{t("loading")}</p>
  const ownThread = ownThreads.find((record) => record.id === id)
  const ownReplyIds = new Set(ownReplies.map((record) => record.id))
  const pendingReplies = ownReplies.filter(
    (record) => !replies.some((reply) => reply.id === record.id)
  )

  return (
    <div className="grid gap-5">
      <DiscussionRecordCard
        key={`${actor.scope}:${thread.id}`}
        record={ownThread ?? thread}
        kind="thread"
        own={Boolean(ownThread)}
        signedIn={actor.signedIn}
        locked={thread.locked}
        onReload={load}
      />
      {thread.locked && <p role="status">{t("locked")}</p>}
      {actor.signedIn && thread.state === "visible" && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              action(`threads/${encodeURIComponent(id)}/subscription`, {
                enabled: true,
              })
            }
          >
            {t("follow")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              action(`threads/${encodeURIComponent(id)}/subscription`, {
                enabled: false,
              })
            }
          >
            {t("unfollow")}
          </button>
        </div>
      )}
      {actor.canModerate && (
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
                action(`moderation/records/thread/${encodeURIComponent(id)}`, {
                  action: command,
                  baseVersion: thread.version,
                })
              }
            >
              {t(command)}
            </button>
          ))}
        </div>
      )}
      {thread.state === "visible" && (
        <section aria-label={t("replies")} className="grid gap-4">
          <h2 className="text-xl font-semibold">{t("replies")}</h2>
          {replies.length === 0 && <p>{t("noReplies")}</p>}
          {replies.map((reply) => (
            <div
              key={reply.id}
              className={
                reply.parentId
                  ? "ml-5 border-l border-(--t-border-line) pl-4"
                  : ""
              }
            >
              <DiscussionRecordCard
                key={`${actor.scope}:${reply.id}`}
                record={ownReplies.find((own) => own.id === reply.id) ?? reply}
                kind="reply"
                own={ownReplyIds.has(reply.id)}
                signedIn={actor.signedIn}
                locked={thread.locked}
                onReload={load}
              />
              {actor.signedIn && !thread.locked && !reply.parentId && (
                <button
                  type="button"
                  onClick={() => setReplyTo(reply.id)}
                  className="mt-2 text-sm underline"
                >
                  {t("replyTo", { name: reply.author.name })}
                </button>
              )}
            </div>
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
          {replyTo && (
            <p>
              {t("replySelected")}{" "}
              <button type="button" onClick={() => setReplyTo(null)}>
                {t("cancel")}
              </button>
            </p>
          )}
          <DiscussionComposer
            key={`${actor.scope}:${replyTo ?? "root"}`}
            threadId={id}
            language={language ?? thread.language}
            parentId={replyTo}
            signedIn={actor.signedIn}
            disabled={thread.locked}
            onSubmitted={() => {
              setReplyTo(null)
              load().catch((failure) =>
                setError(t(discussionErrorKey(failure)))
              )
            }}
          />
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
  )
}
