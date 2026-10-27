"use client"

import { LockKeyhole, ShieldAlert } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import { AuthorBadges } from "@/components/discussions/AuthorBadges"
import { EmptyState } from "@/components/ds/EmptyState"

import {
  discussionErrorKey,
  discussionRequest,
  type DiscussionList,
  type DiscussionRestriction,
  type Subject,
} from "./api"
import { DiscussionModeratorButton } from "./DiscussionModeratorButton"
import { DiscussionTime } from "./DiscussionPresentation"

/** Only server-projected restrictions are shown; identity keys never reach the UI. */
export function DiscussionRestrictions({
  scope,
  moderation = false,
  subjects = [],
  showEmpty = false,
}: {
  scope: string
  moderation?: boolean
  subjects?: readonly Pick<Subject, "id" | "name">[]
  showEmpty?: boolean
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
      let result: DiscussionList<DiscussionRestriction>
      try {
        result = await discussionRequest<DiscussionList<DiscussionRestriction>>(
          moderation
            ? `moderation/sanctions?state=active&limit=20&offset=${offset}`
            : "my/status"
        )
      } catch (failure) {
        setRecords([])
        setNextOffset(null)
        setLoadedScope("")
        throw failure
      }
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
  const RestrictionButton = moderation ? DiscussionModeratorButton : "button"
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
  if (!records.length && !error)
    return showEmpty ? (
      <div className="rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep)">
        <EmptyState
          compact
          message={t("noRestrictions")}
          icon="mdi:shield-check-outline"
        />
      </div>
    ) : null

  return (
    <section
      className="grid gap-4 rounded-[24px] border border-(--t-palette-amber-bg) bg-(--t-palette-amber-soft) p-5 sm:p-6"
      aria-label={t("restrictions")}
    >
      <h2 className="type-h2 m-0 flex items-center gap-2.5">
        <ShieldAlert
          size={20}
          className="text-(--t-palette-amber-fg)"
          aria-hidden
        />
        {t("restrictions")}
      </h2>
      {records.map((record) => (
        <article
          key={record.id}
          className="rounded-[18px] border border-(--t-border-line) bg-(--t-bg-deep) p-4"
        >
          <h3 className="type-h3 m-0">
            {t(record.mode === "ban" ? "discussionBan" : "discussionMute")}
            {record.author ? ` · ${record.author.name}` : ""}
          </h3>
          {record.author && (
            <div className="mt-2">
              <AuthorBadges badges={record.author.badges} />
            </div>
          )}
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
              <label className="text-sm font-semibold text-(--t-ink-dim)">
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
                <label className="text-sm font-semibold text-(--t-ink-dim)">
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
              <RestrictionButton
                type="submit"
                disabled={
                  busy ||
                  !messages[record.id]?.trim() ||
                  (moderation && !feedback[record.id]?.trim())
                }
                className="min-h-11 justify-self-start rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                {...(moderation ? { tone: "neutral" as const } : {})}
              >
                {t(moderation ? "liftRestriction" : "sendAppeal")}
              </RestrictionButton>
            </form>
          )}
        </article>
      ))}
      {nextOffset !== null && (
        <button
          type="button"
          className="min-h-11 justify-self-center rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-4 text-sm font-semibold"
          onClick={() =>
            load(nextOffset).catch((failure) =>
              setError(t(discussionErrorKey(failure)))
            )
          }
        >
          {t("loadMore")}
        </button>
      )}
      {moderation && (
        <p className="m-0 flex items-center gap-1.5 text-xs text-(--t-ink-dim)">
          <LockKeyhole size={13} aria-hidden />
          {t("moderationLogPrivacy")}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
