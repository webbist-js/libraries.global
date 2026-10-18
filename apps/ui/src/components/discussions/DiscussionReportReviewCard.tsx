"use client"

import { ArrowUpRight, Flag, LockKeyhole } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import {
  discussionErrorKey,
  discussionRequest,
  type DiscussionReport,
} from "@/components/discussions/api"
import { DiscussionModeratorButton } from "@/components/discussions/DiscussionModeratorButton"
import { DiscussionImages } from "@/components/discussions/DiscussionPresentation"
import { Link } from "@/lib/navigation"
import { cn } from "@/lib/styles"

const field =
  "mt-2 block w-full rounded-[16px] border border-(--t-border-hi) bg-(--t-bg-deep) p-3 text-[14px] leading-relaxed focus-visible:outline-2 focus-visible:outline-(--t-accent-primary)"

/** Immutable evidence stays alongside the current message; removal checks both versions. */
export function DiscussionReportReviewCard({
  report,
  onReload,
}: {
  report: DiscussionReport
  onReload: () => Promise<void>
}) {
  const t = useTranslations("discussions")
  const workspace = useTranslations("moderationWorkspace")
  const [note, setNote] = useState("")
  const [feedback, setFeedback] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const canRemove =
    report.currentState !== "removed" &&
    typeof report.currentVersion === "number"
  const decide = async (decision: "dismiss" | "remove") => {
    if (busy || (decision === "remove" && (!canRemove || !feedback.trim())))
      return
    setBusy(true)
    setError("")
    try {
      await discussionRequest(
        `moderation/reports/${encodeURIComponent(report.id)}`,
        "PUT",
        {
          decision,
          baseVersion: report.version,
          note,
          ...(decision === "remove"
            ? {
                recordBaseVersion: report.currentVersion,
                contributorFeedback: feedback.trim(),
              }
            : {}),
        }
      )
      await onReload()
      setConfirming(false)
    } catch (failure) {
      setError(t(discussionErrorKey(failure)))
    } finally {
      setBusy(false)
    }
  }
  const versions = [
    {
      label: t("reportedText"),
      version: report.recordVersion,
      title: report.reportedTitle,
      body: report.reportedBody,
      images: report.reportedAttachments,
    },
    {
      label: t("currentText"),
      version: report.currentVersion,
      title: report.currentTitle,
      body: report.currentBody,
      images: report.currentAttachments,
    },
  ]

  return (
    <article className="grid gap-4 rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-(--t-palette-rose-soft) px-3 py-1.5 text-[12px] font-semibold text-(--t-palette-rose-fg)">
          <Flag size={14} aria-hidden />
          {workspace("reports")}
        </span>
        <Link
          href={`/community/discussions/${encodeURIComponent(report.threadId)}${report.recordType === "reply" ? `#discussion-reply-${encodeURIComponent(report.recordId)}` : ""}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-(--t-accent-primary) hover:underline"
        >
          {t("viewReported")}
          <ArrowUpRight size={15} aria-hidden />
        </Link>
      </header>
      <div className="rounded-[16px] bg-(--t-palette-rose-soft) p-4">
        <h3 className="mt-0 mb-1 text-[11px] font-bold tracking-wide text-(--t-palette-rose-fg) uppercase">
          {workspace("reportReason")}
        </h3>
        <p className="m-0 text-[15px] leading-relaxed break-words whitespace-pre-wrap">
          {report.reason}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {versions.map((version, index) => (
          <section
            key={version.label}
            aria-label={version.label}
            className={cn(
              "min-w-0 rounded-[16px] border p-4",
              index === 0
                ? "border-(--t-border-line) bg-(--t-bg-surface)"
                : "border-(--t-palette-violet-bg) bg-(--t-palette-violet-soft)"
            )}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="m-0 text-[12px] font-bold tracking-wide text-(--t-ink-dim) uppercase">
                {version.label}
              </h3>
              {typeof version.version === "number" && (
                <span className="rounded-full bg-(--t-bg-deep) px-2 py-1 text-[11px] text-(--t-ink-dim)">
                  {t("versionLabel", { version: version.version })}
                </span>
              )}
            </div>
            {version.title && (
              <p className="mt-0 mb-2 font-semibold">{version.title}</p>
            )}
            <p
              className="m-0 text-[15px] leading-[1.65] break-words whitespace-pre-wrap"
              lang={report.language}
            >
              {version.body}
            </p>
            <DiscussionImages images={version.images} />
          </section>
        ))}
      </div>
      <label className="text-[13px] font-semibold text-(--t-ink-dim)">
        <span className="inline-flex items-center gap-1.5">
          <LockKeyhole size={13} aria-hidden />
          {t("reviewNote")}
        </span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={2000}
          className={field}
          disabled={busy}
        />
      </label>
      <div className="flex flex-wrap gap-2 border-t border-(--t-border-line) pt-4">
        <DiscussionModeratorButton
          tone="neutral"
          disabled={busy}
          onClick={() => void decide("dismiss")}
          className="min-h-11 px-4 text-[13px]"
        >
          {t("dismiss")}
        </DiscussionModeratorButton>
        <DiscussionModeratorButton
          tone="danger"
          disabled={busy || !canRemove}
          onClick={() => setConfirming(true)}
          className="min-h-11 px-4 text-[13px]"
        >
          {t("remove")}
        </DiscussionModeratorButton>
      </div>
      {confirming && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void decide("remove")
          }}
          className="grid gap-3 rounded-[18px] border border-(--t-palette-coral-fg)/30 bg-(--t-palette-coral-soft) p-4"
        >
          <h3 className="m-0 text-[16px] font-semibold">
            {t("confirmRemoval")}
          </h3>
          <p className="m-0 text-[13px] leading-relaxed">{t("removalLead")}</p>
          <label className="text-[13px] font-semibold">
            {t("authorFeedback")}
            <textarea
              required
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={3}
              maxLength={2000}
              className={field}
              disabled={busy}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <DiscussionModeratorButton
              tone="danger"
              type="submit"
              disabled={busy || !feedback.trim()}
              className="min-h-11 px-4 text-[13px]"
            >
              {t("confirmRemove")}
            </DiscussionModeratorButton>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="min-h-11 rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-4 text-[13px] font-semibold"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p
          role="alert"
          className="m-0 rounded-xl bg-(--t-palette-coral-soft) p-3 text-[13px] text-(--t-palette-coral-fg)"
        >
          {error}
        </p>
      )}
    </article>
  )
}
