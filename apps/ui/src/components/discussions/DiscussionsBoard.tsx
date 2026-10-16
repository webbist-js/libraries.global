"use client"

import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"

import {
  discussionErrorKey,
  discussionRequest,
  type DiscussionList,
  type DiscussionRecord,
  type Subject,
} from "./api"
import { DiscussionComposer } from "./DiscussionComposer"
import { useDiscussionActor } from "./useDiscussionActor"

type DiscussionLanguage = { code: string; name: string }

export function DiscussionsBoard({
  languages = [],
}: {
  languages?: readonly DiscussionLanguage[]
}) {
  const actor = useDiscussionActor()

  return (
    <DiscussionsBoardPanel
      key={actor.scope}
      actor={actor}
      languages={languages}
    />
  )
}

function DiscussionsBoardPanel({
  actor,
  languages,
}: {
  actor: ReturnType<typeof useDiscussionActor>
  languages: readonly DiscussionLanguage[]
}) {
  const t = useTranslations("discussions")
  const locale = useLocale()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectScope, setSubjectScope] = useState("")
  const [subjectOffset, setSubjectOffset] = useState<number | null>(null)
  const [ownOffset, setOwnOffset] = useState<number | null>(null)
  const [subjectId, setSubjectId] = useState("")
  const [language, setLanguage] = useState("")
  const [threads, setThreads] = useState<DiscussionRecord[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [own, setOwn] = useState<DiscussionRecord[]>([])
  const [ownScope, setOwnScope] = useState("")
  const [error, setError] = useState("")
  const [resolvedQuery, setResolvedQuery] = useState("")
  const queryScope = `${actor.scope}:${subjectId}:${language}`
  const currentQuery = useRef(queryScope)
  const currentActor = useRef(actor.scope)
  useEffect(() => {
    currentQuery.current = queryScope
    currentActor.current = actor.scope
  }, [queryScope, actor.scope])
  const loading = resolvedQuery !== queryScope
  const visibleSubjects =
    subjectScope === actor.scope && actor.ready ? subjects : []
  const [showComposer, setShowComposer] = useState(false)
  useEffect(() => {
    if (!actor.ready) return
    let cancelled = false
    discussionRequest<DiscussionList<Subject>>("subjects?limit=50")
      .then((result) => {
        if (!cancelled) {
          setSubjects(result.data)
          setSubjectScope(actor.scope)
          setSubjectOffset(result.nextOffset ?? null)
        }
      })
      .catch((failure) => {
        if (!cancelled) setError(t(discussionErrorKey(failure)))
      })

    return () => {
      cancelled = true
    }
  }, [actor.ready, actor.scope, t])
  useEffect(() => {
    if (!actor.ready) return
    let cancelled = false
    const query = new URLSearchParams({
      limit: "20",
      ...(subjectId ? { subjectId } : {}),
      ...(language ? { language } : {}),
    })
    discussionRequest<DiscussionList<DiscussionRecord>>(`threads?${query}`)
      .then((result) => {
        if (cancelled) return
        setResolvedQuery(queryScope)
        setThreads(result.data)
        setNextOffset(result.nextOffset ?? null)
        setError("")
      })
      .catch((failure) => {
        if (!cancelled) {
          setResolvedQuery(queryScope)
          setThreads([])
          setError(t(discussionErrorKey(failure)))
        }
      })

    return () => {
      cancelled = true
    }
  }, [subjectId, language, actor.ready, actor.scope, queryScope, t])
  const recover = async (offset = 0) => {
    try {
      const result = await discussionRequest<DiscussionList<DiscussionRecord>>(
        `my/records?kind=thread&limit=50&offset=${offset}`
      )
      if (currentActor.current !== actor.scope) return
      setOwn((previous) =>
        offset ? [...previous, ...result.data] : result.data
      )
      setOwnOffset(result.nextOffset ?? null)
      setOwnScope(actor.scope)
    } catch (failure) {
      setError(t(discussionErrorKey(failure)))
    }
  }
  const subject =
    visibleSubjects.find((item) => item.id === subjectId) ??
    visibleSubjects.find((item) => item.slug === "library-life") ??
    visibleSubjects.find((item) => item.slug === "general") ??
    visibleSubjects[0]

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <label>
          {t("subject")}
          <select
            className="mt-1 block rounded-lg border border-(--t-border-line) p-2"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
          >
            <option value="">{t("allSubjects")}</option>
            {visibleSubjects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("language")}
          <select
            className="mt-1 block rounded-lg border border-(--t-border-line) p-2"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="">{t("allLanguages")}</option>
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {languageName(item.code, languages, locale)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setShowComposer((value) => !value)}
          className="rounded-full border px-4 py-2"
        >
          {t("newThread")}
        </button>
        {actor.signedIn && (
          <button type="button" onClick={() => recover()} className="underline">
            {t("myRecords")}
          </button>
        )}
        {actor.canModerate && (
          <Link href="/community/discussions/moderation" className="underline">
            {t("moderation")}
          </Link>
        )}
      </div>
      {subjectOffset !== null && subjectScope === actor.scope && (
        <button
          type="button"
          className="justify-self-start underline"
          onClick={() => {
            discussionRequest<DiscussionList<Subject>>(
              `subjects?limit=50&offset=${subjectOffset}`
            )
              .then((result) => {
                if (currentActor.current !== actor.scope) return
                setSubjects((previous) => [...previous, ...result.data])
                setSubjectOffset(result.nextOffset ?? null)
              })
              .catch((failure) => setError(t(discussionErrorKey(failure))))
          }}
        >
          {t("moreSubjects")}
        </button>
      )}
      {subjectId && subject?.description && <p>{subject.description}</p>}
      {showComposer && subject && (
        <div className="grid gap-3">
          <label>
            {t("subject")}
            <select
              aria-label={t("newThreadSubject")}
              value={subject.id}
              onChange={(event) => setSubjectId(event.target.value)}
              className="mt-1 block rounded-lg border p-2"
            >
              {visibleSubjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <DiscussionComposer
            key={`${actor.scope}:${subject.id}`}
            subject={subject}
            language={language || locale}
            signedIn={actor.signedIn}
            disabled={
              subject.createPolicy === "moderators" && !actor.canModerate
            }
            onSubmitted={(record) => {
              if (record) {
                setOwn((previous) => [record, ...previous])
                setOwnScope(actor.scope)
              }
              recover()
            }}
          />
        </div>
      )}
      {loading ? (
        <p role="status">{t("loading")}</p>
      ) : (
        <section aria-label={t("threads")} className="grid gap-3">
          {threads.length === 0 && <p>{t("empty")}</p>}
          {threads.map((thread) => (
            <article
              key={thread.id}
              className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) p-5"
            >
              <Link
                href={`/community/discussions/${encodeURIComponent(thread.id)}`}
                className="text-xl font-semibold"
              >
                {thread.title}
              </Link>
              <p className="mb-0 text-sm text-(--t-ink-dim)">
                {thread.author.name} · {thread.language}
                {thread.locked ? ` · ${t("lockedLabel")}` : ""}
                {thread.pinned ? ` · ${t("pinned")}` : ""}
              </p>
            </article>
          ))}
          {nextOffset !== null && (
            <button
              type="button"
              onClick={() => {
                const query = new URLSearchParams({
                  limit: "20",
                  offset: String(nextOffset),
                  ...(subjectId ? { subjectId } : {}),
                  ...(language ? { language } : {}),
                })
                discussionRequest<DiscussionList<DiscussionRecord>>(
                  `threads?${query}`
                )
                  .then((result) => {
                    if (currentQuery.current !== queryScope) return
                    setThreads((previous) => [...previous, ...result.data])
                    setNextOffset(result.nextOffset ?? null)
                  })
                  .catch((failure) => setError(t(discussionErrorKey(failure))))
              }}
            >
              {t("loadMore")}
            </button>
          )}
        </section>
      )}
      {actor.signedIn && ownScope === actor.scope && own.length > 0 && (
        <section
          aria-label={t("myRecords")}
          className="rounded-2xl border border-(--t-border-line) p-5"
        >
          <h2>{t("myRecords")}</h2>
          {own.map((record) => (
            <div
              key={record.id}
              className="border-t border-(--t-border-line) py-3"
            >
              <Link
                href={`/community/discussions/${encodeURIComponent(record.id)}`}
              >
                {record.pendingRevision?.title ?? record.title ?? t("untitled")}
              </Link>
              <p>
                {t(`states.${record.state}`)}
                {record.pendingRevision ? ` · ${t("yourPending")}` : ""}
              </p>
            </div>
          ))}
          {ownOffset !== null && (
            <button type="button" onClick={() => recover(ownOffset)}>
              {t("loadMore")}
            </button>
          )}
        </section>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
