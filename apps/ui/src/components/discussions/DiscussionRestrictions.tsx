"use client"

import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import {
  discussionErrorKey,
  discussionRequest,
  type DiscussionList,
  type DiscussionRestriction,
  type Subject,
} from "./api"
import { DiscussionTime } from "./DiscussionPresentation"

/** Only server-projected restrictions are shown; identity keys never reach the UI. */
export function DiscussionRestrictions({
  scope,
  moderation = false,
  subjects = [],
}: {
  scope: string
  moderation?: boolean
  subjects?: readonly Pick<Subject, "id" | "name">[]
}) {
  const t = useTranslations("discussions")
  const [records, setRecords] = useState<DiscussionRestriction[]>([])
  const [loadedScope, setLoadedScope] = useState("")
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const load = useCallback(
    async (offset = 0) => {
      const result = await discussionRequest<
        DiscussionList<DiscussionRestriction>
      >(
        moderation
          ? `moderation/sanctions?state=active&limit=20&offset=${offset}`
          : "my/status"
      )
      const valid = (result.data ?? []).filter(
        (record) => record.mode === "mute" || record.mode === "ban"
      )
      setRecords((previous) => (offset ? [...previous, ...valid] : valid))
      setNextOffset(result.nextOffset ?? null)
      setLoadedScope(scope)
    },
    [moderation, scope]
  )
  useEffect(() => {
    let cancelled = false
    Promise.resolve()
      .then(() => {
        if (!cancelled) return load()
      })
      .catch((failure) => {
        if (!cancelled) setError(t(discussionErrorKey(failure)))
      })

    return () => {
      cancelled = true
    }
  }, [load, t])
  const send = async (record: DiscussionRestriction) => {
    setBusy(true)
    setError("")
    try {
      await discussionRequest(
        moderation
          ? `moderation/sanctions/${encodeURIComponent(record.id)}`
          : `my/sanctions/${encodeURIComponent(record.id)}/appeal`,
        "PUT",
        moderation
          ? {
              baseVersion: record.version,
              reason: messages[record.id],
              contributorFeedback: feedback[record.id],
            }
          : { message: messages[record.id] }
      )
      await load()
    } catch (failure) {
      setError(t(discussionErrorKey(failure)))
    } finally {
      setBusy(false)
    }
  }
  if (loadedScope !== scope) return error ? <p role="alert">{error}</p> : null
  if (!records.length && !error) return null

  return (
    <section
      className="grid gap-4 rounded-2xl border border-(--t-border-line) bg-(--t-palette-amber-soft) p-5"
      aria-label={t("restrictions")}
    >
      <h2 className="m-0 text-xl font-semibold">{t("restrictions")}</h2>
      {records.map((record) => (
        <article
          key={record.id}
          className="border-t border-(--t-border-line) pt-4"
        >
          <h3 className="m-0 text-base font-semibold">
            {t(record.mode === "ban" ? "discussionBan" : "discussionMute")}
            {record.author ? ` · ${record.author.name}` : ""}
          </h3>
          <p className="text-sm">
            {record.subjectName ??
              subjects.find((subject) => subject.id === record.subjectId)
                ?.name ??
              (record.subjectId ? t("subject") : t("allDiscussions"))}
          </p>
          <p className="break-words whitespace-pre-wrap">{record.reason}</p>
          {moderation && record.contributorFeedback && (
            <p className="text-sm">{record.contributorFeedback}</p>
          )}
          <p className="text-sm">
            {t("restrictionDeadline")}:{" "}
            {record.expiresAt === null ? (
              t("restrictionNoEnd")
            ) : record.expiresAt &&
              Number.isFinite(Date.parse(record.expiresAt)) ? (
              <DiscussionTime value={record.expiresAt} />
            ) : (
              t("restrictionDeadlineUnknown")
            )}
          </p>
          {record.appeal && (
            <p className="text-sm whitespace-pre-wrap">
              {t("appeal")}: {record.appeal}
            </p>
          )}
          {((moderation && record.canLift) ||
            (!moderation && record.canAppeal)) && (
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                send(record)
              }}
            >
              <label className="text-sm">
                {t(moderation ? "liftReason" : "appeal")}
                <textarea
                  required
                  maxLength={2000}
                  value={messages[record.id] ?? ""}
                  onChange={(event) =>
                    setMessages((previous) => ({
                      ...previous,
                      [record.id]: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border bg-(--t-bg-deep) p-3"
                />
              </label>
              {moderation && (
                <label className="text-sm">
                  {t("authorFeedback")}
                  <textarea
                    required
                    maxLength={2000}
                    value={feedback[record.id] ?? ""}
                    onChange={(event) =>
                      setFeedback((previous) => ({
                        ...previous,
                        [record.id]: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border bg-(--t-bg-deep) p-3"
                  />
                </label>
              )}
              <button
                type="submit"
                disabled={
                  busy ||
                  !messages[record.id]?.trim() ||
                  (moderation && !feedback[record.id]?.trim())
                }
                className="justify-self-start rounded-full border px-4 py-2 font-semibold disabled:opacity-50"
              >
                {t(moderation ? "liftRestriction" : "sendAppeal")}
              </button>
            </form>
          )}
        </article>
      ))}
      {nextOffset !== null && (
        <button
          type="button"
          onClick={() =>
            load(nextOffset).catch((failure) =>
              setError(t(discussionErrorKey(failure)))
            )
          }
        >
          {t("loadMore")}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
