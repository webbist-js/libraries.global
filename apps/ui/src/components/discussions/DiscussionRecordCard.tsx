"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

import {
  DiscussionRequestError,
  discussionErrorKey,
  discussionHref,
  discussionRequest,
  type DiscussionRecord,
} from "./api"

export function DiscussionRecordCard({
  record,
  kind,
  own,
  signedIn,
  locked,
  onReload,
}: {
  record: DiscussionRecord
  kind: "thread" | "reply"
  own: boolean
  signedIn: boolean
  locked?: boolean
  onReload: () => Promise<void>
}) {
  const t = useTranslations("discussions")
  const [mode, setMode] = useState<"read" | "edit" | "report">("read")
  const [body, setBody] = useState(record.body)
  const [title, setTitle] = useState(record.title ?? "")
  const [baseVersion, setBaseVersion] = useState(record.version)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [conflicted, setConflicted] = useState(false)
  const [busy, setBusy] = useState(false)
  const authorHref =
    discussionHref(record.author.url) ??
    (record.author.slug
      ? `/profile/${encodeURIComponent(record.author.slug)}`
      : null)
  const targetHref = discussionHref(record.target?.url)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      await discussionRequest(
        `records/${kind}/${encodeURIComponent(record.id)}/${mode === "edit" ? "revisions" : "reports"}`,
        "POST",
        mode === "edit"
          ? { body, ...(kind === "thread" ? { title } : {}), baseVersion }
          : { reason }
      )
      setMessage(t(mode === "edit" ? "pendingFeedback" : "reportSent"))
      setMode("read")
      await onReload()
    } catch (failure) {
      if (failure instanceof DiscussionRequestError && failure.status === 409)
        setConflicted(true)
      setError(t(discussionErrorKey(failure)))
    } finally {
      setBusy(false)
    }
  }
  const beginEdit = async () => {
    setBody(record.pendingRevision?.body ?? record.body)
    setTitle(record.pendingRevision?.title ?? record.title ?? "")
    setBaseVersion(record.version)
    setConflicted(false)
    setMode("edit")
    setError("")
    setMessage("")
    if (!record.body && !record.pendingRevision) {
      try {
        const history = await discussionRequest<{
          data: { body: string; title?: string }[]
        }>(`records/${kind}/${encodeURIComponent(record.id)}/revisions`)
        const latest = history.data[0]
        if (latest) {
          setBody(latest.body)
          setTitle(latest.title ?? record.title ?? "")
        }
      } catch (failure) {
        setError(t(discussionErrorKey(failure)))
      }
    }
  }

  return (
    <article
      id={`discussion-${kind}-${record.id}`}
      className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) p-5"
    >
      <div className="flex flex-wrap items-center gap-3 text-sm text-(--t-ink-dim)">
        {authorHref ? (
          <a href={authorHref} rel="nofollow">
            {record.author.name}
          </a>
        ) : (
          <span>{record.author.name}</span>
        )}
        <span lang={record.language}>{record.language}</span>
        <span>{t(`states.${record.state}`)}</span>
      </div>
      {record.title && (
        <h2 className="mt-3 text-xl font-semibold" lang={record.language}>
          {record.title}
        </h2>
      )}
      {record.state === "removed" ? (
        <p>{t("removed")}</p>
      ) : (
        <p lang={record.language} className="break-words whitespace-pre-wrap">
          {record.body}
        </p>
      )}
      {record.target && targetHref && (
        <a href={targetHref} className="text-sm underline">
          {record.target.title}
        </a>
      )}
      {own && record.state !== "removed" && record.pendingRevision && (
        <details className="mt-3 rounded-lg border border-(--t-border-line) p-3">
          <summary>{t("yourPending")}</summary>
          <p className="break-words whitespace-pre-wrap">
            {record.pendingRevision.body}
          </p>
        </details>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        {own && record.state !== "removed" && !locked && (
          <button
            type="button"
            onClick={() => beginEdit()}
            className="underline"
          >
            {t("edit")}
          </button>
        )}
        {signedIn && record.state === "visible" && (
          <button
            type="button"
            onClick={() => {
              setMode("report")
              setError("")
              setMessage("")
            }}
            className="underline"
          >
            {t("report")}
          </button>
        )}
      </div>
      {mode !== "read" && (
        <form onSubmit={(event) => submit(event)} className="mt-4 grid gap-3">
          {mode === "edit" ? (
            <>
              {kind === "thread" && (
                <label>
                  {t("threadTitle")}
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={250}
                    required
                    className="mt-1 w-full rounded-lg border p-2"
                  />
                </label>
              )}
              <label>
                {t("body")}
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={20000}
                  rows={6}
                  required
                  className="mt-1 w-full rounded-lg border p-3"
                />
              </label>
            </>
          ) : (
            <label>
              {t("reportReason")}
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={2000}
                required
                className="mt-1 w-full rounded-lg border p-3"
              />
            </label>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className="rounded-full border px-4 py-2"
            >
              {t("submit")}
            </button>
            <button type="button" onClick={() => setMode("read")}>
              {t("cancel")}
            </button>
            {error && mode === "edit" && (
              <button
                type="button"
                onClick={() =>
                  onReload().catch((failure) =>
                    setError(t(discussionErrorKey(failure)))
                  )
                }
              >
                {t("reload")}
              </button>
            )}
          </div>
        </form>
      )}
      {conflicted && mode === "edit" && record.version !== baseVersion && (
        <div className="mt-3 grid gap-2">
          <p>{t("compareEdit")}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBaseVersion(record.version)
              setConflicted(false)
              setError("")
            }}
          >
            {t("adoptEditBase")}
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </article>
  )
}
