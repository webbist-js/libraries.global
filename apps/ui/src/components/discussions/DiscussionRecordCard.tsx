"use client"

import { Heart, ThumbsUp } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { ProfileFollowButton } from "@/app/[locale]/profile/[username]/_components/ProfileFollowButton"
import { languageName } from "@/lib/locale-fallback"

import {
  DiscussionRequestError,
  discussionAuthor,
  discussionErrorKey,
  discussionHref,
  discussionRequest,
  discussionRecordState,
  type DiscussionRecord,
  type DiscussionImage,
} from "./api"
import { DiscussionImageEditor } from "./DiscussionImageEditor"
import { DiscussionParticipantRestriction } from "./DiscussionParticipantRestriction"
import {
  DiscussionAvatar,
  DiscussionImages,
  DiscussionTime,
} from "./DiscussionPresentation"

export function DiscussionRecordCard({
  record,
  kind,
  own,
  signedIn,
  locked,
  onReload,
  onReply,
  onQuote,
  canReact = signedIn,
  canReply = signedIn,
  canSanction = false,
}: {
  record: DiscussionRecord
  kind: "thread" | "reply"
  own: boolean
  signedIn: boolean
  locked?: boolean
  onReload: () => Promise<void>
  onReply?: () => void
  onQuote?: () => void
  canReact?: boolean
  canReply?: boolean
  canSanction?: boolean
}) {
  const t = useTranslations("discussions")
  const locale = useLocale()
  const author = discussionAuthor(record.author, t("member"))
  const [mode, setMode] = useState<"read" | "edit" | "report">("read")
  const [body, setBody] = useState(record.body)
  const [title, setTitle] = useState(record.title ?? "")
  const [baseVersion, setBaseVersion] = useState(record.version)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [conflicted, setConflicted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [images, setImages] = useState<DiscussionImage[]>(
    record.attachments ?? []
  )
  const [uploading, setUploading] = useState(false)
  const authorHref =
    discussionHref(author.url) ??
    (author.slug ? `/profile/${encodeURIComponent(author.slug)}` : null)
  const targetHref = discussionHref(record.target?.url)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (uploading || images.some((image) => !image.altText.trim())) return
    setBusy(true)
    setError("")
    try {
      await discussionRequest(
        `records/${kind}/${encodeURIComponent(record.id)}/${mode === "edit" ? "revisions" : "reports"}`,
        "POST",
        mode === "edit"
          ? {
              body,
              ...(kind === "thread" ? { title } : {}),
              baseVersion,
              ...(record.attachments ||
              record.pendingRevision?.attachments ||
              record.latestRevision?.attachments ||
              images.length
                ? {
                    attachments: images.map(({ id, altText, caption }) => ({
                      id,
                      altText,
                      ...(caption ? { caption } : {}),
                    })),
                  }
                : {}),
            }
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
    setImages(
      record.pendingRevision?.attachments ??
        record.latestRevision?.attachments ??
        record.attachments ??
        []
    )
    setBody(
      record.pendingRevision?.body ?? record.latestRevision?.body ?? record.body
    )
    setTitle(
      record.pendingRevision?.title ??
        record.latestRevision?.title ??
        record.title ??
        ""
    )
    setBaseVersion(record.version)
    setConflicted(false)
    setMode("edit")
    setError("")
    setMessage("")
    if (!record.body && !record.pendingRevision && !record.latestRevision) {
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
      className="scroll-mt-24 rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-center gap-3 text-sm text-(--t-ink-dim)">
        <DiscussionAvatar author={record.author} />
        {authorHref ? (
          <a href={authorHref} rel="nofollow">
            {author.name}
          </a>
        ) : (
          <span>{author.name}</span>
        )}
        <span lang={record.language}>
          {languageName(record.language, [], locale)}
        </span>
        <span>{t(`states.${discussionRecordState(record)}`)}</span>
        <DiscussionTime value={record.createdAt} />
        {!own && signedIn && author.slug && (
          <ProfileFollowButton
            key={author.slug}
            targetUsername={author.slug}
            isSignedIn={signedIn}
            compact
          />
        )}
      </div>
      {(record.title ||
        (own &&
          (record.pendingRevision?.title || record.latestRevision?.title))) && (
        <h2 className="mt-3 text-xl font-semibold" lang={record.language}>
          {record.title ||
            record.pendingRevision?.title ||
            record.latestRevision?.title}
        </h2>
      )}
      {record.state === "visible" && record.quote && (
        <blockquote className="my-4 rounded-xl border-l-4 border-(--t-palette-violet-fg) bg-(--t-palette-violet-soft) p-4 text-sm">
          <a
            href={`#discussion-${record.quote.kind}-${encodeURIComponent(record.quote.id)}`}
            className="font-semibold underline"
          >
            {record.quote.available
              ? (record.quote.author?.name ?? t("quotedMessage"))
              : t("quotedMessage")}
          </a>
          <p className="mb-0 whitespace-pre-wrap">
            {!record.quote.available
              ? t("quoteUnavailable")
              : record.quote.excerpt}
          </p>
        </blockquote>
      )}
      {record.state === "removed" ? (
        <p>{t("removed")}</p>
      ) : (
        <p
          lang={record.language}
          className="max-w-[72ch] text-[17px] leading-relaxed break-words whitespace-pre-wrap"
        >
          {record.body}
        </p>
      )}
      {record.target && targetHref && (
        <a href={targetHref} className="text-sm underline">
          {record.target.title}
        </a>
      )}
      {record.state === "visible" && (
        <DiscussionImages images={record.attachments} />
      )}
      {own && record.moderationFeedback && (
        <p className="rounded-xl bg-(--t-palette-amber-soft) p-4 text-sm whitespace-pre-wrap">
          {record.moderationFeedback}
        </p>
      )}
      {own && record.state !== "removed" && record.pendingRevision && (
        <details className="mt-3 rounded-lg border border-(--t-border-line) p-3">
          <summary>{t("yourPending")}</summary>
          <p className="max-w-[72ch] text-[17px] leading-relaxed break-words whitespace-pre-wrap">
            {record.pendingRevision.body}
          </p>
          <DiscussionImages images={record.pendingRevision.attachments} />
        </details>
      )}
      {own &&
        record.state !== "removed" &&
        record.latestRevision &&
        record.latestRevision.state !== "pending" &&
        record.latestRevision.state !== "approved" && (
          <div className="mt-3 rounded-xl bg-(--t-palette-amber-soft) p-4 text-sm">
            <p className="mt-0 font-semibold">{t("reviewFeedback")}</p>
            {record.latestRevision.feedback && (
              <p>{record.latestRevision.feedback}</p>
            )}
            <details>
              <summary>{t("recoverText")}</summary>
              <p className="whitespace-pre-wrap">
                {record.latestRevision.body}
              </p>
              <DiscussionImages images={record.latestRevision.attachments} />
            </details>
          </div>
        )}
      <div className="mt-3 flex flex-wrap gap-3">
        {canSanction && !own && signedIn && record.state === "visible" && (
          <DiscussionParticipantRestriction
            record={record}
            kind={kind}
            onReload={onReload}
          />
        )}
        {onReply &&
          canReply &&
          signedIn &&
          !locked &&
          record.state === "visible" && (
            <button
              type="button"
              className="text-sm font-semibold text-(--t-accent-primary)"
              onClick={onReply}
            >
              {t("reply")}
            </button>
          )}
        {onQuote &&
          canReply &&
          signedIn &&
          !locked &&
          record.state === "visible" && (
            <button
              type="button"
              className="text-sm underline"
              onClick={onQuote}
            >
              {t("quote")}
            </button>
          )}
        {record.state === "visible" &&
          record.reactions &&
          (["like", "love"] as const).map((reaction) => (
            <button
              type="button"
              key={reaction}
              disabled={!signedIn || !canReact || busy}
              aria-pressed={record.myReaction === reaction}
              className="inline-flex items-center gap-2 rounded-full border border-(--t-border-line) px-3 py-1.5 text-sm disabled:opacity-60"
              onClick={async () => {
                setBusy(true)
                setError("")
                try {
                  await discussionRequest(
                    `records/${kind}/${encodeURIComponent(record.id)}/reaction`,
                    "PUT",
                    {
                      reaction:
                        record.myReaction === reaction ? null : reaction,
                    }
                  )
                  await onReload()
                } catch (failure) {
                  setError(t(discussionErrorKey(failure)))
                } finally {
                  setBusy(false)
                }
              }}
            >
              {reaction === "like" ? (
                <ThumbsUp size={15} aria-hidden />
              ) : (
                <Heart size={15} aria-hidden />
              )}
              {t(reaction)} {record.reactions![reaction]}
            </button>
          ))}
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
              <DiscussionImageEditor
                subjectId={record.subjectId}
                images={images}
                disabled={busy}
                onBusyChange={setUploading}
                onChange={setImages}
              />
            </>
          ) : (
            <label>
              <p className="mt-0 text-sm">{t("reportLead")}</p>
              {t("reportReason")}
              <textarea
                aria-label={t("reportReason")}
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
              disabled={
                busy ||
                uploading ||
                (mode === "edit" &&
                  images.some((image) => !image.altText.trim()))
              }
              aria-busy={busy}
              className="rounded-full border px-4 py-2"
            >
              {t(mode === "report" ? "sendReport" : "submit")}
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
