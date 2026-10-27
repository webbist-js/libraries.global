"use client"

import { Heart, ThumbsUp, Ellipsis, LockKeyhole } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { ProfileFollowButton } from "@/app/[locale]/profile/[username]/_components/ProfileFollowButton"
import { AuthorBadges } from "@/components/discussions/AuthorBadges"
import { Badge } from "@/components/ds/Badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import {
  DiscussionAvatar,
  DiscussionImages,
  DiscussionTime,
  DiscussionRelativeTime,
} from "./DiscussionPresentation"
import { DiscussionRecordModerationMenu } from "./DiscussionRecordModerationMenu"

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
  canModerate = false,
  layout = "card",
  number,
  replyingTo,
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
  canModerate?: boolean
  layout?: "card" | "conversation" | "suggestion"
  number?: number
  replyingTo?: { id: string; name: string }
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
  const conversation = layout !== "card"
  const suggestionLayout = layout === "suggestion"
  const privateDraft = own && ["pending", "rejected"].includes(record.state)
  const displayedBody = privateDraft
    ? (record.pendingRevision?.body ??
      record.latestRevision?.body ??
      record.body)
    : record.body
  const [profileActionsOpen, setProfileActionsOpen] = useState(false)
  const secondaryActions =
    conversation && signedIn && record.state === "visible"
  const pill =
    "inline-flex min-h-8 items-center gap-1.5 rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
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
      className={
        conversation
          ? kind === "thread" && !suggestionLayout
            ? "scroll-mt-24 rounded-[24px] border border-(--t-palette-violet-bg) bg-[#f7f5fc] p-5 sm:p-6"
            : privateDraft
              ? "scroll-mt-24 rounded-xl border border-dashed border-(--t-palette-violet-bg) bg-(--t-palette-violet-soft) p-4"
              : "scroll-mt-24 py-1"
          : "scroll-mt-24 rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-7"
      }
    >
      <div className={conversation ? "flex items-start gap-3" : ""}>
        {conversation && (
          <DiscussionAvatar
            author={record.author}
            colourful
            size={replyingTo ? "sm" : "md"}
          />
        )}
        <div className="min-w-0 flex-1">
          <div
            className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${suggestionLayout ? "text-sm" : "text-xs"} text-(--t-ink-dim)`}
          >
            {!conversation && <DiscussionAvatar author={record.author} />}
            {authorHref ? (
              <a
                href={authorHref}
                rel="nofollow"
                className="font-bold text-(--t-ink-base) hover:underline"
              >
                {author.name}
              </a>
            ) : (
              <span className="font-bold text-(--t-ink-base)">
                {author.name}
              </span>
            )}
            <AuthorBadges badges={author.badges} />
            {conversation && kind === "thread" && !suggestionLayout && (
              <span>{t("startedThis")}</span>
            )}
            {replyingTo && (
              <a
                href={`#discussion-reply-${encodeURIComponent(replyingTo.id)}`}
                className="hover:underline"
              >
                {t("replyTo", { name: replyingTo.name })}
              </a>
            )}
            {!conversation && (
              <span lang={record.language}>
                {languageName(record.language, [], locale)}
              </span>
            )}
            {(!conversation || record.state !== "visible") && (
              <Badge
                size="xs"
                color={record.state === "rejected" ? "danger" : "violet"}
                icon={
                  record.state === "pending" ? "mdi:clock-outline" : undefined
                }
                label={t(`states.${discussionRecordState(record)}`)}
              />
            )}
            {suggestionLayout && record.createdAt ? (
              <DiscussionRelativeTime value={record.createdAt} />
            ) : (
              <DiscussionTime value={record.createdAt} />
            )}
            {number !== undefined && (
              <a
                href={`#discussion-${kind}-${encodeURIComponent(record.id)}`}
                className="ml-auto text-(--t-ink-low) hover:underline"
                aria-label={t("postNumber", { number })}
              >
                #{number}
              </a>
            )}
            {!conversation && !own && signedIn && author.slug && (
              <ProfileFollowButton
                key={author.slug}
                targetUsername={author.slug}
                isSignedIn={signedIn}
                compact
              />
            )}
          </div>
          {!conversation &&
            (record.title ||
              (own &&
                (record.pendingRevision?.title ||
                  record.latestRevision?.title))) && (
              <h2 className="type-h2 mt-3" lang={record.language}>
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
              className={
                suggestionLayout
                  ? "mt-2 mb-2 text-base leading-relaxed break-words whitespace-pre-wrap"
                  : conversation
                    ? "mt-3 mb-4 text-base leading-[1.7] break-words whitespace-pre-wrap"
                    : "max-w-[72ch] text-base leading-relaxed break-words whitespace-pre-wrap"
              }
            >
              {displayedBody}
            </p>
          )}
          {!conversation && record.target && targetHref && (
            <a href={targetHref} className={pill}>
              {record.target.title}
            </a>
          )}
          {record.state === "visible" && (
            <DiscussionImages images={record.attachments} />
          )}
          {privateDraft && (
            <>
              <DiscussionImages
                images={
                  record.pendingRevision?.attachments ??
                  record.latestRevision?.attachments ??
                  record.attachments
                }
              />
              <p className="mt-2 mb-0 flex items-center gap-1.5 text-xs text-(--t-ink-dim)">
                <LockKeyhole size={12} aria-hidden />
                {t("privateReply")}
              </p>
            </>
          )}
          {own && record.moderationFeedback && (
            <p className="rounded-xl bg-(--t-palette-amber-soft) p-4 text-sm whitespace-pre-wrap">
              {record.moderationFeedback}
            </p>
          )}
          {own &&
            !privateDraft &&
            record.state !== "removed" &&
            record.pendingRevision && (
              <details
                open={record.state !== "visible"}
                className="mt-3 rounded-xl border border-(--t-border-line) bg-(--t-bg-deep) p-4"
              >
                <summary>{t("yourPending")}</summary>
                <p className="max-w-[72ch] text-base leading-relaxed break-words whitespace-pre-wrap">
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
                {!privateDraft && (
                  <details>
                    <summary>{t("recoverText")}</summary>
                    <p className="whitespace-pre-wrap">
                      {record.latestRevision.body}
                    </p>
                    <DiscussionImages
                      images={record.latestRevision.attachments}
                    />
                  </details>
                )}
              </div>
            )}
          {!suggestionLayout && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {onReply &&
                canReply &&
                signedIn &&
                !locked &&
                record.state === "visible" && (
                  <button type="button" className={pill} onClick={onReply}>
                    {t(conversation ? "replyShort" : "reply")}
                  </button>
                )}
              {!conversation &&
                onQuote &&
                canReply &&
                signedIn &&
                !locked &&
                record.state === "visible" && (
                  <button type="button" className={pill} onClick={onQuote}>
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
                    aria-label={`${t(reaction)} ${record.reactions![reaction]}`}
                    className={`${pill} ${record.myReaction === reaction ? "border-(--t-accent-primary) bg-(--t-palette-violet-soft) text-(--t-accent-primary)" : ""}`}
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
                    {t(reaction)}
                    {record.reactions![reaction] > 0
                      ? ` · ${record.reactions![reaction]}`
                      : ""}
                  </button>
                ))}
              {own && record.state !== "removed" && !locked && (
                <button
                  type="button"
                  onClick={() => beginEdit()}
                  className="text-xs font-semibold text-(--t-ink-dim) underline underline-offset-4"
                >
                  {t("edit")}
                </button>
              )}
              {!conversation && signedIn && record.state === "visible" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("report")
                    setError("")
                    setMessage("")
                  }}
                  className="text-xs font-semibold text-(--t-ink-dim) underline underline-offset-4"
                >
                  {t("report")}
                </button>
              )}
              {secondaryActions && (
                <Popover
                  open={profileActionsOpen}
                  onOpenChange={setProfileActionsOpen}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={pill}
                      aria-label={t("messageActions")}
                    >
                      <Ellipsis size={15} aria-hidden />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-fit min-w-48 rounded-xl border-(--t-border-line) bg-(--t-bg-deep) p-3"
                  >
                    <p className="mt-0 mb-2 text-xs font-semibold">
                      {author.name}
                    </p>
                    <div className="grid gap-3">
                      {onQuote && canReply && !locked && (
                        <button
                          type="button"
                          onClick={() => {
                            onQuote()
                            setProfileActionsOpen(false)
                          }}
                          className="text-left text-sm font-semibold"
                        >
                          {t("quote")}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setMode("report")
                          setError("")
                          setMessage("")
                          setProfileActionsOpen(false)
                        }}
                        className="text-left text-sm font-semibold"
                      >
                        {t("report")}
                      </button>
                      {profileActionsOpen && !own && author.slug && (
                        <ProfileFollowButton
                          targetUsername={author.slug}
                          isSignedIn={signedIn}
                          compact
                        />
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {(canModerate || (canSanction && !own)) &&
                signedIn &&
                record.state === "visible" && (
                  <div className="ml-auto">
                    <DiscussionRecordModerationMenu
                      record={record}
                      kind={kind}
                      canRemove={canModerate}
                      canSanction={canSanction && !own}
                      onReload={onReload}
                    />
                  </div>
                )}
            </div>
          )}
          {mode !== "read" && (
            <form
              onSubmit={(event) => submit(event)}
              className="mt-4 grid gap-3"
            >
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
        </div>
      </div>
    </article>
  )
}
