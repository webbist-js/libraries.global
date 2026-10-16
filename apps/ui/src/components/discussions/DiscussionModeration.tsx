"use client"

import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import { Link } from "@/lib/navigation"

import {
  discussionErrorKey,
  discussionRequest,
  type DiscussionList,
  type DiscussionReport,
  type DiscussionRevision,
} from "./api"
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
  const [revisions, setRevisions] = useState<DiscussionRevision[]>([])
  const [reports, setReports] = useState<DiscussionReport[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
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
    baseVersion: number
  ) => {
    setBusy(true)
    setError("")
    try {
      await discussionRequest(
        `moderation/${kind}/${encodeURIComponent(id)}`,
        "PUT",
        { decision, baseVersion, note: notes[id] ?? "" }
      )
      await load()
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
                      busy || revision.baseVersion !== revision.currentVersion
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
                    disabled={busy}
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
                </div>
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
                    disabled={busy}
                    onClick={() =>
                      decide("reports", report.id, "remove", report.version)
                    }
                  >
                    {t("remove")}
                  </button>
                </div>
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
        </>
      )}
    </div>
  )
}
