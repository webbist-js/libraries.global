"use client"

import { useTranslations } from "next-intl"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { DiscussionComposerDrawer } from "@/components/discussions/DiscussionComposerDrawer"
import { DiscussionThreadSkeleton } from "@/components/discussions/DiscussionSkeleton"
import { ARTICLE_DISCUSSION_EVENT } from "@/lib/discussion-composer"

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
  subjectSlug:
    | "journal"
    | "knowledge"
    | "library-life"
    | "practice"
    | "general"
    | "suggestions"
  title: string
  language: string
  variant?: "default" | "suggestion"
  presentation?: "article"
  returnTo?: string
  footerAction?: ReactNode
  onActivity?: (thread: DiscussionRecord, latest?: DiscussionRecord) => void
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
  variant = "default",
  presentation,
  returnTo,
  footerAction,
  onActivity,
}: AttachedDiscussionProps & { actor: ReturnType<typeof useDiscussionActor> }) {
  const t = useTranslations("discussions")
  const common = useTranslations("ui")
  const articleCard = presentation === "article"
  const journal = subjectSlug === "journal"
  const heading = t(articleCard && journal ? "storyHeading" : "attachedHeading")
  const [thread, setThread] = useState<DiscussionRecord | null>(null)
  const [subject, setSubject] = useState<Subject | null>(null)
  const [languages, setLanguages] = useState<DiscussionLanguage[]>([])
  const [error, setError] = useState("")
  const [retryable, setRetryable] = useState(false)
  const [composing, setComposing] = useState(false)
  const [loadedScope, setLoadedScope] = useState("")
  const scope = `${target.uid}:${target.documentId}:${target.locale ?? language}:${subjectSlug}:${actor.scope}`
  const sectionRef = useRef<HTMLElement>(null)
  const pendingActivation = useRef<string | null>(null)
  const currentScope = useRef(scope)
  useLayoutEffect(() => {
    currentScope.current = scope
    pendingActivation.current = null

    return () => {
      currentScope.current = ""
      pendingActivation.current = null
    }
  }, [scope])
  // Match the external click handler to the committed loading/error UI before input.
  useLayoutEffect(() => {
    if (!articleCard || variant === "suggestion") return
    const panel = sectionRef.current?.closest("#article-discussion")
    if (!panel) return
    const activate = (event: Event) => {
      if (!actor.ready || loadedScope !== scope) {
        event.preventDefault()
        pendingActivation.current = scope
      } else if (!thread && subject && !error) {
        event.preventDefault()
        setComposing(true)
      }
    }
    panel.addEventListener(ARTICLE_DISCUSSION_EVENT, activate)

    return () => panel.removeEventListener(ARTICLE_DISCUSSION_EVENT, activate)
  }, [
    articleCard,
    variant,
    actor.ready,
    loadedScope,
    scope,
    thread,
    subject,
    error,
  ])

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
            `my/records?${new URLSearchParams({ kind: "thread", targetUid: target.uid, targetId: target.documentId, targetLocale: target.locale ?? language, limit: "50" })}`
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
    const nextThread =
      threads.data[0] ??
      own.data.find((record) => record.state !== "removed") ??
      null
    const nextSubject =
      subjects.data.find((item) => item.slug === subjectSlug) ?? null
    setThread(nextThread)
    setLanguages(
      languageChoices.filter(
        (item) => typeof item.code === "string" && typeof item.name === "string"
      )
    )
    setSubject(nextSubject)
    setError("")
    setRetryable(false)
    setLoadedScope(scope)
    if (pendingActivation.current === scope) {
      pendingActivation.current = null
      if (!nextThread && nextSubject) setComposing(true)
      else window.location.hash = "article-discussion"
    }
  }, [
    target.uid,
    target.documentId,
    target.locale,
    language,
    subjectSlug,
    scope,
    actor.signedIn,
  ])
  const handleLoadFailure = useCallback(
    (failure: unknown) => {
      if (currentScope.current !== scope) return
      const requestError = discussionErrorKey(failure)
      const errorKey = requestError === "invalidInput" ? "error" : requestError
      setError(t(errorKey))
      setRetryable(errorKey === "error")
      setLoadedScope(scope)
      if (pendingActivation.current === scope) {
        pendingActivation.current = null
        window.location.hash = "article-discussion"
      }
    },
    [scope, t]
  )
  useEffect(() => {
    if (!actor.ready) return
    Promise.resolve().then(load).catch(handleLoadFailure)
  }, [load, actor.ready, handleLoadFailure])

  return (
    <section
      ref={sectionRef}
      id={variant === "suggestion" ? undefined : "discussion"}
      aria-label={heading}
      className={
        articleCard
          ? "grid gap-5 rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-7"
          : variant === "suggestion"
            ? "grid gap-4"
            : "mt-6 grid gap-4"
      }
    >
      {variant !== "suggestion" && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className={`type-h2 ${articleCard ? "m-0" : ""}`}>{heading}</h2>
            {articleCard && (
              <p className="mt-2 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
                {t(journal ? "storyLead" : "attachedLead")}
              </p>
            )}
          </div>
          {loadedScope === scope && !thread && subject && !error && (
            <button
              type="button"
              data-start-discussion
              onClick={() => setComposing(true)}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-(--t-bg-inverse) px-4 text-sm font-semibold text-white hover:opacity-90"
            >
              {t("startDiscussion")}
            </button>
          )}
        </div>
      )}
      {!actor.ready || loadedScope !== scope ? (
        <DiscussionThreadSkeleton embedded variant={variant} />
      ) : error ? (
        <div className="grid justify-items-start gap-2">
          <p role="alert">{error}</p>
          {retryable && (
            <button
              type="button"
              className="text-sm underline"
              onClick={() => {
                setLoadedScope("")
                load().catch(handleLoadFailure)
              }}
            >
              {common("retry")}
            </button>
          )}
        </div>
      ) : thread ? (
        <DiscussionThread
          id={thread.id}
          language={language}
          languages={languages}
          embedded
          variant={variant}
          returnTo={returnTo}
          footerAction={footerAction}
          onActivity={onActivity}
        />
      ) : subject && variant === "suggestion" ? (
        <>
          {variant !== "suggestion" && !articleCard && (
            <p>{t("attachedLead")}</p>
          )}
          <DiscussionComposer
            key={scope}
            subject={subject}
            target={target}
            initialTitle={t("attachedTitle", { title })}
            language={variant === "suggestion" ? undefined : language}
            defaultLanguage={language}
            compositionPreferences={actor.compositionPreferences}
            variant={variant}
            embedded={articleCard}
            onCancel={articleCard ? () => setComposing(false) : undefined}
            footerAction={footerAction}
            lockLanguage={variant !== "suggestion"}
            languages={languages}
            returnTo={
              returnTo ??
              (typeof window !== "undefined"
                ? `${window.location.pathname}${window.location.search}#discussion`
                : undefined)
            }
            signedIn={actor.signedIn}
            disabled={
              subject.createPolicy === "moderators" && !actor.canModerate
            }
            onSubmitted={(record) => {
              if (record) setThread(record)
              else load().catch(handleLoadFailure)
            }}
          />
        </>
      ) : !subject ? (
        <p>{t("unavailable")}</p>
      ) : null}
      {variant !== "suggestion" &&
        actor.ready &&
        loadedScope === scope &&
        subject && (
          <DiscussionComposerDrawer
            key={scope}
            open={composing}
            onOpen={() => setComposing(true)}
            onClose={() => setComposing(false)}
            subject={subject}
            target={target}
            contextTitle={title}
            initialTitle={t("attachedTitle", { title })}
            language={language}
            defaultLanguage={language}
            compositionPreferences={actor.compositionPreferences}
            languages={languages}
            returnTo={returnTo}
            signedIn={actor.signedIn}
            lockLanguage
            disabled={
              subject.createPolicy === "moderators" && !actor.canModerate
            }
            onSubmitted={(record) => {
              if (record) setThread(record)
              else load().catch(handleLoadFailure)
            }}
          />
        )}
    </section>
  )
}
