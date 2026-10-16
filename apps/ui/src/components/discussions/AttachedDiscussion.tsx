"use client"

import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  discussionErrorKey,
  discussionRequest,
  type DiscussionList,
  type DiscussionLanguage,
  type DiscussionRecord,
  type DiscussionTarget,
  type Subject,
} from "./api"
import { DiscussionComposer } from "./DiscussionComposer"
import { DiscussionThread } from "./DiscussionThread"
import { useDiscussionActor } from "./useDiscussionActor"

type AttachedDiscussionProps = {
  target: DiscussionTarget
  subjectSlug: "journal" | "knowledge" | "library-life" | "practice" | "general"
  title: string
  language: string
}

export function AttachedDiscussion(props: AttachedDiscussionProps) {
  const actor = useDiscussionActor()

  return <AttachedDiscussionPanel {...props} key={actor.scope} actor={actor} />
}

function AttachedDiscussionPanel({
  target,
  subjectSlug,
  title,
  language,
  actor,
}: AttachedDiscussionProps & { actor: ReturnType<typeof useDiscussionActor> }) {
  const t = useTranslations("discussions")
  const [thread, setThread] = useState<DiscussionRecord | null>(null)
  const [subject, setSubject] = useState<Subject | null>(null)
  const [languages, setLanguages] = useState<DiscussionLanguage[]>([])
  const [error, setError] = useState("")
  const [loadedScope, setLoadedScope] = useState("")
  const scope = `${target.uid}:${target.documentId}:${target.locale ?? language}:${subjectSlug}:${actor.scope}`
  const currentScope = useRef(scope)
  useEffect(() => {
    currentScope.current = scope
  }, [scope])
  const load = useCallback(async () => {
    const query = new URLSearchParams({
      targetUid: target.uid,
      targetId: target.documentId,
      targetLocale: target.locale ?? language,
      limit: "1",
    })
    const [threads, subjects, own, languageChoices] = await Promise.all([
      discussionRequest<DiscussionList<DiscussionRecord>>(`threads?${query}`),
      discussionRequest<DiscussionList<Subject>>("subjects?limit=50"),
      actor.signedIn
        ? discussionRequest<DiscussionList<DiscussionRecord>>(
            `my/records?${new URLSearchParams({ kind: "thread", targetUid: target.uid, targetId: target.documentId, language: target.locale ?? language, limit: "50" })}`
          )
        : { data: [] },
      fetch("/api/relations/locales", { cache: "no-store" })
        .then(async (response) =>
          response.ok
            ? (((await response.json()) as { data?: DiscussionLanguage[] })
                .data ?? [])
            : []
        )
        .catch(() => []),
    ])
    if (currentScope.current !== scope) return
    setThread(
      threads.data[0] ??
        own.data.find((record) => record.state !== "removed") ??
        null
    )
    setLanguages(
      languageChoices.filter(
        (item) => typeof item.code === "string" && typeof item.name === "string"
      )
    )
    setSubject(subjects.data.find((item) => item.slug === subjectSlug) ?? null)
    setError("")
    setLoadedScope(scope)
  }, [
    target.uid,
    target.documentId,
    target.locale,
    language,
    subjectSlug,
    scope,
    actor.signedIn,
  ])
  useEffect(() => {
    if (!actor.ready) return
    Promise.resolve()
      .then(load)
      .catch((failure) => {
        if (currentScope.current === scope) {
          setError(t(discussionErrorKey(failure)))
          setLoadedScope(scope)
        }
      })
  }, [load, actor.ready, scope, t])

  return (
    <section
      id="discussion"
      aria-label={t("attachedHeading")}
      className="mt-6 grid gap-4"
    >
      <h2 className="text-2xl font-medium">{t("attachedHeading")}</h2>
      {!actor.ready || loadedScope !== scope ? (
        <p role="status">{t("loading")}</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : thread ? (
        <DiscussionThread
          id={thread.id}
          language={language}
          languages={languages}
          embedded
        />
      ) : subject ? (
        <>
          <p>{t("attachedLead")}</p>
          <DiscussionComposer
            key={scope}
            subject={subject}
            target={target}
            initialTitle={t("attachedTitle", { title })}
            language={language}
            languages={languages}
            returnTo={
              typeof window !== "undefined"
                ? `${window.location.pathname}${window.location.search}#discussion`
                : undefined
            }
            signedIn={actor.signedIn}
            disabled={
              subject.createPolicy === "moderators" && !actor.canModerate
            }
            onSubmitted={(record) => {
              if (record) setThread(record)
              else
                load().catch((failure) =>
                  setError(t(discussionErrorKey(failure)))
                )
            }}
          />
        </>
      ) : (
        <p>{t("unavailable")}</p>
      )}
    </section>
  )
}
