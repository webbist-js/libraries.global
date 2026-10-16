"use client"

import { useLocale, useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"

import {
  discussionErrorKey,
  discussionRequest,
  type DiscussionList,
  type DiscussionReport,
  type DiscussionRevision,
} from "./api"
import { DiscussionImages } from "./DiscussionPresentation"
import { DiscussionRestrictions } from "./DiscussionRestrictions"
import { useDiscussionActor } from "./useDiscussionActor"

export function DiscussionModeration() {
  const actor = useDiscussionActor()

  return <DiscussionModerationPanel key={actor.scope} actor={actor} />
}

function DiscussionModerationPanel({
  actor,
}: {
  actor: ReturnType<typeof useDiscussionActor>
}) {
  const t = useTranslations("discussions")
  const locale = useLocale()
  const [revisions, setRevisions] = useState<DiscussionRevision[]>([])
  const [reports, setReports] = useState<DiscussionReport[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const [exceptions, setExceptions] = useState<Record<string, boolean>>({})
  const [exceptionReasons, setExceptionReasons] = useState<
    Record<string, string>
  >({})
  const [confirmRemoval, setConfirmRemoval] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [loadedScope, setLoadedScope] = useState("")
  const [revisionOffset, setRevisionOffset] = useState<number | null>(null)
  const [reportOffset, setReportOffset] = useState<number | null>(null)
  const load = useCallback(async () => {
    const [proposals, flags] = await Promise.all([
      discussionRequest<DiscussionList<DiscussionRevision>>(
        "moderation/revisions?limit=20"
      ),
      discussionRequest<DiscussionList<DiscussionReport>>(
        "moderation/reports?limit=20"
      ),
    ])
    setRevisions(proposals.data)
    setReports(flags.data)
    setRevisionOffset(proposals.nextOffset ?? null)
    setReportOffset(flags.nextOffset ?? null)
    setLoadedScope(actor.scope)
    setError("")
  }, [actor.scope])
  useEffect(() => {
    if (!actor.ready || !actor.canModerate) return
    load().catch((failure) => setError(t(discussionErrorKey(failure))))
  }, [load, actor.ready, actor.canModerate, t])
  const decide = async (
    kind: "revisions" | "reports",
    id: string,
    decision: string,
    baseVersion: number,
    recordBaseVersion?: number
  ) => {
    setBusy(true)
    setError("")
    try {
      await discussionRequest(
        `moderation/${kind}/${encodeURIComponent(id)}`,
        "PUT",
        {
          decision,
          baseVersion,
          note: notes[id] ?? "",
          ...(feedback[id]?.trim()
            ? { contributorFeedback: feedback[id].trim() }
            : {}),
          ...(decision === "remove" ? { recordBaseVersion } : {}),
          ...(kind === "revisions" && decision === "approve" && exceptions[id]
            ? {
                profanityException: true,
                exceptionReason: exceptionReasons[id]?.trim(),
              }
            : {}),
        }
      )
      await load()
      setConfirmRemoval(null)
    } catch (failure) {
      setError(t(discussionErrorKey(failure)))
    } finally {
      setBusy(false)
    }
  }
  if (!actor.ready) return <p>{t("loading")}</p>
  if (!actor.canModerate) return <p role="status">{t("notAllowed")}</p>
  if (loadedScope !== actor.scope && !error)
    return <p role="status">{t("loading")}</p>

  return (
    <div className="grid gap-6">
      <p>{t("moderationLead")}</p>
      <button
        type="button"
        onClick={() =>
          load().catch((failure) => setError(t(discussionErrorKey(failure))))
        }
      >
        {t("reload")}
      </button>
      {error && <p role="alert">{error}</p>}
      {loadedScope === actor.scope && (
        <>
          <section aria-label={t("proposals")} className="grid gap-4">
            <h2 className="text-xl font-semibold">{t("proposals")}</h2>
            {revisions.length === 0 && <p>{t("emptyQueue")}</p>}
            {revisions.map((revision) => (
              <article
                key={revision.id}
                className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) p-5"
              >
                <h3>
                  {revision.title ?? revision.threadTitle ?? t("untitled")}
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4>{t("currentText")}</h4>
                    {revision.previousTitle && (
                      <p className="font-semibold">{revision.previousTitle}</p>
                    )}
                    <p className="break-words whitespace-pre-wrap">
                      {revision.previousBody}
                    </p>
                  </div>
                  <div>
                    <h4>{t("proposedText")}</h4>
                    {revision.title && (
                      <p className="font-semibold">{revision.title}</p>
                    )}
                    <p className="break-words whitespace-pre-wrap">
                      {revision.body}
                    </p>
                    <DiscussionImages images={revision.attachments} />
                  </div>
                </div>
                {revision.baseVersion !== revision.currentVersion && (
                  <p role="status">{t("conflict")}</p>
                )}
                <label>
                  {t("reviewNote")}
                  <textarea
                    value={notes[revision.id] ?? ""}
                    onChange={(event) =>
                      setNotes((previous) => ({
                        ...previous,
                        [revision.id]: event.target.value,
                      }))
                    }
                    maxLength={2000}
                    rows={2}
                    className="mt-1 w-full rounded-lg border p-2"
                  />
                </label>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    disabled={
                      busy ||
                      revision.baseVersion !== revision.currentVersion ||
                      (exceptions[revision.id] &&
                        !exceptionReasons[revision.id]?.trim())
                    }
                    onClick={() =>
                      decide(
                        "revisions",
                        revision.id,
                        "approve",
                        revision.baseVersion
                      )
                    }
                  >
                    {t("approve")}
                  </button>
                  <button
                    type="button"
                    disabled={busy || !feedback[revision.id]?.trim()}
                    onClick={() =>
                      decide(
                        "revisions",
                        revision.id,
                        "reject",
                        revision.baseVersion
                      )
                    }
                  >
                    {t("reject")}
                  </button>
                  <button
                    type="button"
                    disabled={busy || !feedback[revision.id]?.trim()}
                    onClick={() =>
                      decide(
                        "revisions",
                        revision.id,
                        "request_changes",
                        revision.baseVersion
                      )
                    }
                  >
                    {t("requestChanges")}
                  </button>
                </div>
                <label className="mt-3 block text-sm">
                  {t("authorFeedback")}
                  <textarea
                    value={feedback[revision.id] ?? ""}
                    onChange={(event) =>
                      setFeedback((previous) => ({
                        ...previous,
                        [revision.id]: event.target.value,
                      }))
                    }
                    rows={3}
                    maxLength={2000}
                    className="mt-1 w-full rounded-xl border p-3"
                  />
                </label>
                <p className="rounded-xl bg-(--t-bg-muted) p-3 text-sm">
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
                {revision.contentFlags?.terms?.length ? (
                  <p className="text-sm">
                    {t("wordFilterFlags")}:{" "}
                    {revision.contentFlags.terms.join(", ")}
                  </p>
                ) : null}
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={exceptions[revision.id] ?? false}
                    onChange={(event) =>
                      setExceptions((previous) => ({
                        ...previous,
                        [revision.id]: event.target.checked,
                      }))
                    }
                  />
                  {t("allowOriginalWording")}
                </label>
                {exceptions[revision.id] && (
                  <label className="mt-2 block text-sm">
                    {t("wordingReason")}
                    <textarea
                      required
                      rows={2}
                      maxLength={2000}
                      value={exceptionReasons[revision.id] ?? ""}
                      onChange={(event) =>
                        setExceptionReasons((previous) => ({
                          ...previous,
                          [revision.id]: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border p-3"
                    />
                  </label>
                )}
              </article>
            ))}
            {revisionOffset !== null && (
              <button
                type="button"
                onClick={() =>
                  discussionRequest<DiscussionList<DiscussionRevision>>(
                    `moderation/revisions?limit=20&offset=${revisionOffset}`
                  )
                    .then((result) => {
                      setRevisions((previous) => [...previous, ...result.data])
                      setRevisionOffset(result.nextOffset ?? null)
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
          <section aria-label={t("reports")} className="grid gap-4">
            <h2 className="text-xl font-semibold">{t("reports")}</h2>
            {reports.length === 0 && <p>{t("emptyQueue")}</p>}
            {reports.map((report) => (
              <article
                key={report.id}
                className="rounded-2xl border border-(--t-border-line) p-5"
              >
                <Link
                  href={`/community/discussions/${encodeURIComponent(report.threadId)}${report.recordType === "reply" ? `#discussion-reply-${encodeURIComponent(report.recordId)}` : ""}`}
                  className="underline"
                >
                  {t("viewReported")}
                </Link>
                <p className="break-words whitespace-pre-wrap">
                  {report.reason}
                </p>
                <div className="grid gap-4 rounded-xl bg-(--t-bg-muted) p-4 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {t("reportedText")}
                      {typeof report.recordVersion === "number" && (
                        <span className="block font-normal">
                          {t("versionLabel", { version: report.recordVersion })}
                        </span>
                      )}
                    </h3>
                    {report.reportedTitle && (
                      <p className="font-semibold">{report.reportedTitle}</p>
                    )}
                    <p className="break-words whitespace-pre-wrap">
                      {report.reportedBody}
                    </p>
                    <DiscussionImages images={report.reportedAttachments} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">
                      {t("currentText")}
                      {typeof report.currentVersion === "number" && (
                        <span className="block font-normal">
                          {t("versionLabel", {
                            version: report.currentVersion,
                          })}
                        </span>
                      )}
                    </h3>
                    {report.currentTitle && (
                      <p className="font-semibold">{report.currentTitle}</p>
                    )}
                    <p className="break-words whitespace-pre-wrap">
                      {report.currentBody}
                    </p>
                    <DiscussionImages images={report.currentAttachments} />
                  </div>
                </div>
                <label>
                  {t("reviewNote")}
                  <textarea
                    value={notes[report.id] ?? ""}
                    onChange={(event) =>
                      setNotes((previous) => ({
                        ...previous,
                        [report.id]: event.target.value,
                      }))
                    }
                    rows={2}
                    maxLength={2000}
                    className="mt-1 w-full rounded-lg border p-2"
                  />
                </label>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      decide("reports", report.id, "dismiss", report.version)
                    }
                  >
                    {t("dismiss")}
                  </button>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      report.currentState === "removed" ||
                      typeof report.currentVersion !== "number"
                    }
                    onClick={() => setConfirmRemoval(report.id)}
                  >
                    {t("remove")}
                  </button>
                </div>
                {confirmRemoval === report.id && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      if (!feedback[report.id]?.trim()) return
                      decide(
                        "reports",
                        report.id,
                        "remove",
                        report.version,
                        report.currentVersion
                      )
                    }}
                    className="mt-4 grid gap-3 rounded-xl border border-(--t-palette-coral-fg) bg-(--t-palette-coral-soft) p-4"
                  >
                    <h3 className="m-0 font-semibold">{t("confirmRemoval")}</h3>
                    <p className="m-0 text-sm">{t("removalLead")}</p>
                    <label>
                      {t("authorFeedback")}
                      <textarea
                        required
                        value={feedback[report.id] ?? ""}
                        onChange={(event) =>
                          setFeedback((previous) => ({
                            ...previous,
                            [report.id]: event.target.value,
                          }))
                        }
                        maxLength={2000}
                        rows={3}
                        className="mt-1 w-full rounded-xl border bg-(--t-bg-deep) p-3"
                      />
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={busy || !feedback[report.id]?.trim()}
                        className="rounded-full bg-(--t-palette-coral-fg) px-4 py-2 text-white"
                      >
                        {t("confirmRemove")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRemoval(null)}
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  </form>
                )}
              </article>
            ))}
            {reportOffset !== null && (
              <button
                type="button"
                onClick={() =>
                  discussionRequest<DiscussionList<DiscussionReport>>(
                    `moderation/reports?limit=20&offset=${reportOffset}`
                  )
                    .then((result) => {
                      setReports((previous) => [...previous, ...result.data])
                      setReportOffset(result.nextOffset ?? null)
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
          <DiscussionRestrictions
            key={actor.scope}
            scope={actor.scope}
            moderation
          />
        </>
      )}
    </div>
  )
}
