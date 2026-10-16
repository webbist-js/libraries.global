"use client"

import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  discussionErrorKey,
  discussionRequest,
  type DiscussionList,
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
    const [threads, subjects] = await Promise.all([
      discussionRequest<DiscussionList<DiscussionRecord>>(`threads?${query}`),
      discussionRequest<DiscussionList<Subject>>("subjects?limit=50"),
    ])
    if (currentScope.current !== scope) return
    setThread(threads.data[0] ?? null)
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
    <section aria-label={t("attachedHeading")} className="mt-6 grid gap-4">
      <h2 className="text-2xl font-medium">{t("attachedHeading")}</h2>
      {error ? (
        <p role="alert">{error}</p>
      ) : loadedScope !== scope ? (
        <p role="status">{t("loading")}</p>
      ) : thread ? (
        <DiscussionThread id={thread.id} language={language} />
      ) : subject ? (
        <>
          <p>{t("attachedLead")}</p>
          <DiscussionComposer
            key={scope}
            subject={subject}
            target={target}
            initialTitle={t("attachedTitle", { title })}
            language={language}
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
