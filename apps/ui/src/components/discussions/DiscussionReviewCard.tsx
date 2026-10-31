"use client"

import { ArrowUpRight, Check, Ellipsis, Flag, ShieldCheck } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { AuthorBadges } from "@/components/discussions/AuthorBadges"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"
import { cn } from "@/lib/styles"

import {
  discussionAuthor,
  discussionErrorKey,
  discussionRequest,
  type DiscussionRevision,
} from "./api"
import { DiscussionParticipantRestriction } from "./DiscussionParticipantRestriction"
import {
  DiscussionAvatar,
  DiscussionImages,
  DiscussionTime,
} from "./DiscussionPresentation"

/** The thread and full queue use the same immutable revision and decision form. */
export function DiscussionReviewCard({
  revision,
  onReload,
  showThread = false,
}: {
  revision: DiscussionRevision
  onReload: () => Promise<void>
  showThread?: boolean
}) {
  const t = useTranslations("discussions")
  const locale = useLocale()
  const [declining, setDeclining] = useState(false)
  const [checksOpen, setChecksOpen] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [note, setNote] = useState("")
  const [exception, setException] = useState(false)
  const [exceptionReason, setExceptionReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const author = discussionAuthor(revision.author, t("member"))
  const editing =
    revision.recordState === "visible" || Boolean(revision.previousBody)
  const canReview = revision.canReview === true
  const conflict = revision.baseVersion !== revision.currentVersion
  const pill =
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-4 py-2 text-sm font-semibold disabled:opacity-50"
  const decide = async (decision: "approve" | "reject" | "request_changes") => {
    if (!canReview || busy || (decision !== "approve" && !feedback.trim()))
      return
    setBusy(true)
    setError("")
    try {
      await discussionRequest(
        `moderation/revisions/${encodeURIComponent(revision.id)}`,
        "PUT",
        {
          decision,
          baseVersion: revision.baseVersion,
          note: note.trim(),
          ...(decision !== "approve"
            ? { contributorFeedback: feedback.trim() }
            : {}),
          ...(decision === "approve" && exception
            ? {
                profanityException: true,
                exceptionReason: exceptionReason.trim(),
              }
            : {}),
        }
      )
      await onReload()
    } catch (failure) {
      setError(t(discussionErrorKey(failure)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article
      id={`discussion-review-${revision.id}`}
      className="rounded-[24px] border border-(--t-edge-warn) bg-(--t-palette-amber-soft) p-5 text-base [--spacing:0.25rem] sm:p-6"
    >
      <div className="flex items-start gap-3.5">
        <DiscussionAvatar author={author} colourful />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="type-label m-0 text-(--t-palette-amber-fg) uppercase">
              {t(
                editing
                  ? "editPublished"
                  : revision.recordType === "thread"
                    ? "newOpening"
                    : "newReply"
              )}
            </h3>
            <div className="flex shrink-0 items-center gap-2">
              {Boolean(revision.contentFlags?.terms?.length) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-(--t-palette-rose-soft) px-2.5 py-1 text-xs font-semibold text-(--t-palette-rose-fg)">
                  <Flag size={12} aria-hidden />
                  {t("flaggedWording")}
                </span>
              )}
              <Popover open={checksOpen} onOpenChange={setChecksOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("reviewChecks")}
                    title={t("reviewChecks")}
                    className="inline-flex size-6 items-center justify-center rounded-full text-(--t-ink-dim) hover:bg-(--t-palette-amber-soft) focus-visible:outline-2 focus-visible:outline-(--t-accent-primary)"
                  >
                    <Ellipsis size={16} aria-hidden />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="max-h-[75vh] w-[min(380px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border-(--t-border-line) bg-(--t-bg-deep) p-4 text-sm text-(--t-ink-dim)"
                >
                  <h4 className="type-h4 m-0 flex items-center gap-2 text-(--t-ink-base)">
                    <ShieldCheck size={15} aria-hidden />
                    {t("reviewChecks")}
                  </h4>
                  <p>
                    {revision.contentFlags
                      ? t(
                          revision.contentFlags.covered
                            ? "wordFilterCovered"
                            : "wordFilterUncovered",
                          {
                            language: languageName(
                              revision.contentFlags.language,
                              [],
                              locale
                            ),
                          }
                        )
                      : t("wordFilterUnknown")}
                  </p>
                  {Boolean(revision.contentFlags?.terms?.length) && (
                    <p>
                      {t("wordFilterFlags")}:{" "}
                      {revision.contentFlags!.terms.join(", ")}
                    </p>
                  )}
                  {canReview && (
                    <>
                      <label className="block">
                        {t("reviewNote")}
                        <textarea
                          maxLength={2000}
                          rows={2}
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          className="mt-1 w-full rounded-xl border bg-(--t-bg-deep) p-3"
                        />
                      </label>
                      <label className="mt-3 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={exception}
                          onChange={(event) =>
                            setException(event.target.checked)
                          }
                        />
                        {t("allowOriginalWording")}
                      </label>
                      {exception && (
                        <label className="mt-2 block">
                          {t("wordingReason")}
                          <textarea
                            required
                            maxLength={2000}
                            rows={2}
                            value={exceptionReason}
                            onChange={(event) =>
                              setExceptionReason(event.target.value)
                            }
                            className="mt-1 w-full rounded-xl border bg-(--t-bg-deep) p-3"
                          />
                        </label>
                      )}
                    </>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1 text-sm leading-relaxed text-(--t-ink-dim)">
            <span className="font-bold text-(--t-ink-base)">{author.name}</span>
            <AuthorBadges badges={author.badges} />
            {revision.parentAuthor && (
              <span>
                · {t("replyingTo", { name: revision.parentAuthor.name })}
              </span>
            )}
            {revision.language && (
              <span>· {languageName(revision.language, [], locale)}</span>
            )}
            {revision.createdAt && (
              <>
                <span>·</span>
                <DiscussionTime value={revision.createdAt} compact />
              </>
            )}
          </div>
          {showThread && (
            <Link
              href={`/community/discussions/${encodeURIComponent(revision.threadId)}`}
              className="mt-3 flex w-fit items-center gap-1.5 rounded-full border border-(--t-palette-amber-bg) bg-(--t-bg-deep) px-3 py-1.5 text-sm font-semibold text-(--t-accent-primary) hover:border-(--t-accent-primary)"
            >
              {revision.threadTitle ?? revision.title ?? t("untitled")}
              <ArrowUpRight size={14} className="shrink-0" aria-hidden />
            </Link>
          )}
          {revision.quote && (
            <blockquote className="mx-0 my-3 rounded-lg border-l-2 border-(--t-palette-violet-bg) bg-(--t-bg-deep) p-3 text-sm">
              <p className="m-0 font-semibold">
                {revision.quote.author?.name ?? t("quotedMessage")}
              </p>
              <p className="m-0 whitespace-pre-wrap">
                {revision.quote.available
                  ? revision.quote.excerpt
                  : t("quoteUnavailable")}
              </p>
            </blockquote>
          )}
          {editing && (
            <div className="mt-3 rounded-xl border border-(--t-border-line) bg-(--t-bg-deep) p-3">
              <h4 className="type-label m-0 mb-1 text-(--t-ink-dim) uppercase">
                {t("publishedNow")}
              </h4>
              {revision.previousTitle && (
                <p className="m-0 font-semibold">{revision.previousTitle}</p>
              )}
              <p
                className="m-0 text-base leading-[1.65] break-words whitespace-pre-wrap text-(--t-ink-dim)"
                lang={revision.language}
              >
                {revision.previousBody}
              </p>
            </div>
          )}
          <div
            className={
              editing
                ? "mt-2 rounded-xl border border-(--t-edge-ok) bg-(--t-bg-deep) p-3"
                : "mt-3"
            }
          >
            {editing && (
              <h4 className="type-label m-0 mb-1 text-(--t-palette-mint-fg) uppercase">
                {t("proposedEdit")}
              </h4>
            )}
            {revision.title && (
              <p className="m-0 mb-1 font-semibold" lang={revision.language}>
                {revision.title}
              </p>
            )}
            <p
              className="m-0 text-base leading-[1.65] break-words whitespace-pre-wrap"
              lang={revision.language}
            >
              {revision.body}
            </p>
            <DiscussionImages images={revision.attachments} />
          </div>
          {conflict && (
            <p role="status" className="text-sm">
              {t("conflict")}
            </p>
          )}
          {!canReview && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <p role="status" className="m-0 text-xs text-(--t-ink-dim)">
                {t("selfReviewDisabled")}
              </p>
              {revision.isOwn && (
                <Link
                  href="/contribute/submissions?tab=discussions"
                  className={pill}
                >
                  {t("edit")}
                </Link>
              )}
            </div>
          )}
          {canReview && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={cn(
                  pill,
                  "border-transparent bg-[#21704d] text-white hover:brightness-110"
                )}
                disabled={
                  busy || conflict || (exception && !exceptionReason.trim())
                }
                onClick={() => decide("approve")}
                title={t("moderatorAction")}
              >
                <Check size={17} aria-hidden />
                {t("acceptPublish")}
              </button>
              <button
                type="button"
                className={pill}
                disabled={busy}
                aria-expanded={declining}
                onClick={() => setDeclining(!declining)}
              >
                {t("decline")}
              </button>
              {revision.canSanction === true && (
                <div className="ml-auto">
                  <DiscussionParticipantRestriction
                    record={{
                      id: revision.recordId,
                      author: revision.author ?? null,
                    }}
                    kind={revision.recordType}
                    onReload={onReload}
                    triggerLabel={t("restrictAuthor")}
                    triggerClassName="min-h-9 border-transparent bg-transparent px-0 text-sm text-(--t-palette-coral-fg) underline underline-offset-2 hover:bg-transparent"
                  />
                </div>
              )}
            </div>
          )}
          {declining && canReview && (
            <form
              className="mt-3 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                decide("reject")
              }}
            >
              <label className="text-sm">
                {t("authorFeedback")}
                <textarea
                  required
                  maxLength={2000}
                  rows={3}
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  className="mt-1 w-full rounded-xl border bg-(--t-bg-deep) p-3"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className={`${pill} text-(--t-palette-coral-fg)`}
                  disabled={busy || !feedback.trim()}
                >
                  {t("reject")}
                </button>
                <button
                  type="button"
                  className={pill}
                  disabled={busy || !feedback.trim()}
                  onClick={() => decide("request_changes")}
                >
                  {t("requestChanges")}
                </button>
              </div>
            </form>
          )}
          {error && (
            <p role="alert" className="text-sm">
              {error}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
