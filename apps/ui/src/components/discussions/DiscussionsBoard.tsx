"use client"

import { MessagesSquare, Search, ShieldCheck } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  DiscussionComposerSkeleton,
  DiscussionListSkeleton,
} from "@/components/discussions/DiscussionSkeleton"
import { EmptyState } from "@/components/ds/EmptyState"
import { SelectField } from "@/components/ds/SelectField"
import { StepsCard } from "@/components/ds/StepsCard"
import { Container } from "@/components/elementary/Container"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { preferredContentLanguage } from "@/lib/content-language"
import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"

import {
  discussionAuthor,
  discussionErrorKey,
  discussionFilters,
  discussionRequest,
  discussionRecordState,
  discussionThreadQuery,
  type DiscussionFilters,
  type DiscussionLanguage,
  type DiscussionImage,
  type DiscussionList,
  type DiscussionRecord,
  type Subject,
} from "./api"
import { DiscussionComposer } from "./DiscussionComposer"
import { DiscussionContextFilter } from "./DiscussionContextFilter"
import {
  DiscussionPreview,
  DiscussionTime,
  subjectPalette,
} from "./DiscussionPresentation"
import { DiscussionRestrictions } from "./DiscussionRestrictions"
import { DiscussionsSectionHeader } from "./DiscussionsSectionHeader"
import { useDiscussionActor } from "./useDiscussionActor"

export function DiscussionsBoard({
  languages = [],
  initialSearch = "",
}: {
  languages?: readonly DiscussionLanguage[]
  initialSearch?: string
}) {
  const actor = useDiscussionActor()

  return (
    <DiscussionsBoardPanel
      key={actor.scope}
      actor={actor}
      languages={languages}
      initialSearch={initialSearch}
    />
  )
}

function DiscussionsBoardPanel({
  actor,
  languages,
  initialSearch,
}: {
  actor: ReturnType<typeof useDiscussionActor>
  languages: readonly DiscussionLanguage[]
  initialSearch: string
}) {
  const t = useTranslations("discussions")
  const locale = useLocale()
  const [storedFilters, setStoredFilters] = useState(() =>
    discussionFilters(new URLSearchParams(initialSearch))
  )
  const [explicitLanguage, setExplicitLanguage] = useState(() =>
    new URLSearchParams(initialSearch).has("lang")
  )
  const filters = {
    ...storedFilters,
    language: explicitLanguage
      ? storedFilters.language
      : preferredContentLanguage(
          locale,
          actor.compositionPreferences,
          languages.map((language) => language.code)
        ),
  }
  const [settledSearch, setSettledSearch] = useState(filters.q)
  useEffect(() => {
    const timer = setTimeout(() => setSettledSearch(filters.q), 250)

    return () => clearTimeout(timer)
  }, [filters.q])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [subjectScope, setSubjectScope] = useState("")
  const [subjectOffset, setSubjectOffset] = useState<number | null>(null)
  const [threads, setThreads] = useState<DiscussionRecord[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [total, setTotal] = useState<number | undefined>()
  const [own, setOwn] = useState<DiscussionRecord[]>([])
  const [ownScope, setOwnScope] = useState("")
  const [ownOffset, setOwnOffset] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [resolvedQuery, setResolvedQuery] = useState("")
  const [showComposer, setShowComposer] = useState(
    () => new URLSearchParams(initialSearch).get("compose") === "1"
  )
  const [composerSubject, setComposerSubject] = useState("")
  const [draft, setDraft] = useState<{
    title: string
    body: string
    language?: string
  }>({ title: "", body: "" })
  const [draftImages, setDraftImages] = useState<
    (DiscussionImage & { subjectId?: string })[]
  >([])
  const query = discussionThreadQuery({ ...filters, q: settledSearch })
  const queryScope = `${actor.scope}:${query}`
  const currentQuery = useRef(queryScope)
  const currentActor = useRef(actor.scope)
  useEffect(() => {
    currentQuery.current = queryScope
    currentActor.current = actor.scope
  }, [queryScope, actor.scope])
  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search)
      setStoredFilters(discussionFilters(params))
      setExplicitLanguage(params.has("lang"))
    }
    window.addEventListener("popstate", restore)

    return () => window.removeEventListener("popstate", restore)
  }, [])
  const changeFilters = (change: Partial<DiscussionFilters>) => {
    const next = { ...storedFilters, ...change }
    const explicit = explicitLanguage || change.language !== undefined
    setStoredFilters(next)
    setExplicitLanguage(explicit)
    const url = new URL(window.location.href)
    for (const [key, value] of [
      ["subject", next.subjectId],
      ["lang", explicit ? next.language || "all" : ""],
      ["view", next.view === "latest" ? "" : next.view],
      ["q", next.q],
      ["context", next.contextType ?? ""],
      ["entity", next.contextId ?? ""],
      ["contextLocale", next.contextLocale ?? ""],
    ]) {
      if (value) url.searchParams.set(key!, value)
      else url.searchParams.delete(key!)
    }
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`
    )
  }
  const recover = useCallback(
    async (offset = 0) => {
      const result = await discussionRequest<DiscussionList<DiscussionRecord>>(
        `my/records?kind=thread&limit=50&offset=${offset}`
      )
      if (currentActor.current !== actor.scope) return
      setOwn((previous) =>
        offset ? [...previous, ...result.data] : result.data
      )
      setOwnOffset(result.nextOffset ?? null)
      setOwnScope(actor.scope)
    },
    [actor.scope]
  )
  useEffect(() => {
    if (!actor.ready) return
    let cancelled = false
    discussionRequest<DiscussionList<Subject>>("subjects?limit=50")
      .then((result) => {
        if (cancelled) return
        setSubjects(result.data)
        setSubjectScope(actor.scope)
        setSubjectOffset(result.nextOffset ?? null)
      })
      .catch((failure) => {
        if (!cancelled) setError(t(discussionErrorKey(failure)))
      })
    if (actor.signedIn)
      Promise.resolve()
        .then(() => recover())
        .catch((failure) => {
          if (!cancelled) setError(t(discussionErrorKey(failure)))
        })

    return () => {
      cancelled = true
    }
  }, [actor.ready, actor.scope, actor.signedIn, recover, t])
  useEffect(() => {
    if (!actor.ready || (filters.view === "following" && !actor.signedIn))
      return
    let cancelled = false
    discussionRequest<DiscussionList<DiscussionRecord>>(`threads?${query}`)
      .then((result) => {
        if (cancelled) return
        setResolvedQuery(queryScope)
        setThreads(result.data)
        setNextOffset(result.nextOffset ?? null)
        setTotal(result.total)
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
  }, [query, actor.ready, actor.signedIn, queryScope, filters.view, t])
  const visibleSubjects =
    actor.ready && subjectScope === actor.scope ? subjects : []
  const visibleThreads =
    actor.ready && resolvedQuery === queryScope ? threads : []
  const visibleOwn =
    actor.ready && actor.signedIn && ownScope === actor.scope ? own : []
  const pending = visibleOwn.filter(
    (record) =>
      (record.state === "pending" &&
        record.latestRevision?.state !== "changes_requested") ||
      record.pendingRevision
  )
  const subject =
    visibleSubjects.find((item) => item.id === composerSubject) ??
    visibleSubjects.find((item) => item.id === filters.subjectId) ??
    visibleSubjects.find((item) => item.slug === "library-life") ??
    visibleSubjects[0]
  const openComposer = () => {
    setComposerSubject(filters.subjectId)
    setShowComposer(true)
  }
  const loading =
    !actor.ready || filters.q !== settledSearch || resolvedQuery !== queryScope
  const waiting = visibleThreads
    .filter((record) => record.replyCount === 0 && !record.locked)
    .slice(0, 3)
  const followed = visibleThreads
    .filter((record) => record.subscribed)
    .slice(0, 3)
  const buttonClass =
    "inline-flex items-center justify-center gap-2 rounded-full bg-(--t-accent-primary) px-5 py-3 font-semibold text-white"

  return (
    <>
      <DiscussionsSectionHeader onStart={openComposer} />
      <Container className="grid gap-8 py-8 sm:py-10">
        {actor.ready && actor.signedIn && (
          <DiscussionRestrictions
            key={actor.scope}
            scope={actor.scope}
            subjects={visibleSubjects.filter(
              (subject) => subject.visibility === "public"
            )}
          />
        )}
        <section aria-labelledby="discussion-subjects" className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="discussion-subjects" className="m-0 font-serif text-3xl">
              {t("pickSubject")}
            </h2>
            <button
              className="text-sm font-semibold text-(--t-accent-primary) underline underline-offset-4"
              type="button"
              onClick={() => changeFilters({ subjectId: "" })}
            >
              {t("allSubjects")}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {visibleSubjects.map((item) => {
              const palette = subjectPalette(item)

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={filters.subjectId === item.id}
                  onClick={() =>
                    changeFilters({
                      subjectId: filters.subjectId === item.id ? "" : item.id,
                    })
                  }
                  className="flex min-h-36 flex-col items-start gap-3 rounded-[22px] border-2 p-4 text-left transition-transform hover:-translate-y-0.5"
                  style={{
                    background: palette.bg,
                    borderColor:
                      filters.subjectId === item.id
                        ? palette.fg
                        : "transparent",
                  }}
                >
                  <span
                    aria-hidden
                    className="inline-flex size-8 items-center justify-center rounded-xl"
                    style={{ color: palette.fg }}
                  >
                    <MessagesSquare size={28} />
                  </span>
                  <span className="text-base leading-tight font-bold">
                    {item.name}
                  </span>
                  <span className="mt-auto text-sm text-(--t-ink-dim)">
                    {typeof item.threadCount === "number"
                      ? t("conversationCount", { count: item.threadCount })
                      : item.description}
                  </span>
                </button>
              )
            })}
          </div>
          {subjectOffset !== null &&
            actor.ready &&
            subjectScope === actor.scope && (
              <button
                type="button"
                className="justify-self-start underline"
                onClick={() =>
                  discussionRequest<DiscussionList<Subject>>(
                    `subjects?limit=50&offset=${subjectOffset}`
                  )
                    .then((result) => {
                      if (currentActor.current !== actor.scope) return
                      setSubjects((previous) => [...previous, ...result.data])
                      setSubjectOffset(result.nextOffset ?? null)
                    })
                    .catch((failure) =>
                      setError(t(discussionErrorKey(failure)))
                    )
                }
              >
                {t("moreSubjects")}
              </button>
            )}
        </section>
        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-label={t("threads")} className="grid min-w-0 gap-4">
            <DiscussionContextFilter
              type={filters.contextType}
              id={filters.contextId}
              onChange={changeFilters}
            />
            <div className="flex flex-wrap items-center gap-3">
              <div
                aria-label={t("view")}
                className="inline-flex rounded-full bg-(--t-bg-muted) p-1"
              >
                {(["latest", "unanswered", "following"] as const).map(
                  (view) => (
                    <button
                      type="button"
                      key={view}
                      aria-pressed={filters.view === view}
                      onClick={() => changeFilters({ view })}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${filters.view === view ? "bg-(--t-bg-deep) shadow-sm" : ""}`}
                    >
                      {t(view)}
                    </button>
                  )
                )}
              </div>
              <label className="flex min-w-40 flex-1 items-center gap-2 rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-4">
                <Search size={17} aria-hidden />
                <input
                  aria-label={t("search")}
                  type="search"
                  placeholder={t("search")}
                  value={filters.q}
                  maxLength={180}
                  onChange={(event) => changeFilters({ q: event.target.value })}
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
                />
              </label>
              <label className="sr-only" htmlFor="discussion-language-filter">
                {t("language")}
              </label>
              <SelectField
                id="discussion-language-filter"
                label={t("language")}
                value={filters.language}
                onValueChange={(language) => changeFilters({ language })}
                className="w-auto rounded-full"
                options={[
                  { value: "", label: t("allLanguages") },
                  ...[
                    ...new Set([
                      ...languages.map((item) => item.code),
                      ...(filters.language ? [filters.language] : []),
                    ]),
                  ].map((code) => ({
                    value: code,
                    label: languageName(code, languages, locale),
                  })),
                ]}
              />
            </div>
            {pending.length > 0 && (
              <p
                role="status"
                className="m-0 rounded-2xl border border-dashed border-(--t-palette-violet-fg) bg-(--t-palette-violet-soft) p-4 text-sm text-(--t-palette-violet-fg)"
              >
                {t("privatePendingLead")}{" "}
                <Link
                  className="font-semibold underline"
                  href="/contribute/submissions?tab=discussions"
                >
                  {t("myRecords")}
                </Link>
              </p>
            )}
            {filters.view === "following" && !actor.signedIn && actor.ready ? (
              <Link
                className="rounded-2xl border p-5 underline"
                href={`/auth/signin?callbackUrl=${encodeURIComponent("/community/discussions?view=following")}`}
              >
                {t("signIn")}
              </Link>
            ) : loading ? (
              <DiscussionListSkeleton />
            ) : (
              <>
                <p
                  aria-live="polite"
                  className="m-0 text-sm text-(--t-ink-dim)"
                >
                  {total === undefined
                    ? t("shownCount", { count: visibleThreads.length })
                    : t("conversationCount", { count: total })}
                </p>
                {visibleThreads.map((thread) => (
                  <DiscussionPreview
                    key={thread.id}
                    record={thread}
                    subject={visibleSubjects.find(
                      (item) => item.id === thread.subjectId
                    )}
                  />
                ))}
                {visibleThreads.length === 0 && !error && (
                  <EmptyState
                    surface
                    headingLevel={3}
                    icon="mdi:forum-outline"
                    lead={t("empty")}
                    detail={t("emptyLead")}
                    action={
                      <>
                        <button
                          type="button"
                          className="min-h-11 rounded-full border border-(--t-border-hi) px-5 py-2.5 font-semibold text-(--t-accent-primary)"
                          onClick={() =>
                            changeFilters({
                              subjectId: "",
                              language: "",
                              view: "latest",
                              q: "",
                              contextType: "",
                              contextId: "",
                              contextLocale: "",
                            })
                          }
                        >
                          {t("showAll")}
                        </button>
                        <button
                          type="button"
                          onClick={openComposer}
                          className={buttonClass}
                        >
                          {t("newThread")}
                        </button>
                      </>
                    }
                  />
                )}
                {nextOffset !== null && (
                  <button
                    type="button"
                    className="rounded-full border py-3 font-semibold"
                    onClick={() =>
                      discussionRequest<DiscussionList<DiscussionRecord>>(
                        `threads?${discussionThreadQuery(filters, nextOffset)}`
                      )
                        .then((result) => {
                          if (currentQuery.current !== queryScope) return
                          setThreads((previous) => [
                            ...previous,
                            ...result.data,
                          ])
                          setNextOffset(result.nextOffset ?? null)
                        })
                        .catch((failure) =>
                          setError(t(discussionErrorKey(failure)))
                        )
                    }
                  >
                    {t("loadMore")}
                  </button>
                )}
              </>
            )}
            {visibleOwn.length > 0 && (
              <details className="rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) p-5">
                <summary className="font-semibold">{t("myRecords")}</summary>
                {visibleOwn.map((record) => (
                  <div
                    key={record.id}
                    className="mt-3 border-t border-(--t-border-line) pt-3"
                  >
                    <Link
                      className="font-semibold underline"
                      href={`/community/discussions/${encodeURIComponent(record.id)}`}
                    >
                      {record.pendingRevision?.title ??
                        record.latestRevision?.title ??
                        record.title ??
                        t("untitled")}
                    </Link>
                    <p className="m-0 text-sm">
                      {t(`states.${discussionRecordState(record)}`)}
                    </p>
                    {record.latestRevision?.feedback && (
                      <p className="text-sm">
                        {record.latestRevision.feedback}
                      </p>
                    )}
                  </div>
                ))}
                {ownOffset !== null && (
                  <button
                    type="button"
                    className="mt-3 underline"
                    onClick={() =>
                      recover(ownOffset).catch((failure) =>
                        setError(t(discussionErrorKey(failure)))
                      )
                    }
                  >
                    {t("loadMore")}
                  </button>
                )}
              </details>
            )}
            {error && <p role="alert">{error}</p>}
          </section>
          <aside className="grid content-start gap-4">
            <section className="rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-6">
              <h2 className="m-0 font-serif text-2xl">{t("waitingHeading")}</h2>
              <p className="mt-3 mb-4 text-sm text-(--t-ink-dim)">
                {t("waitingLead")}
              </p>
              {waiting.length ? (
                <ul className="m-0 grid list-none gap-4 p-0">
                  {waiting.map((record) => (
                    <li
                      key={record.id}
                      className="flex gap-3 border-t border-(--t-border-line) pt-4"
                    >
                      <span
                        aria-hidden
                        className="mt-1.5 size-2.5 shrink-0 rounded-full"
                        style={{
                          background: subjectPalette(
                            visibleSubjects.find(
                              (item) => item.id === record.subjectId
                            )
                          ).bg,
                        }}
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/community/discussions/${encodeURIComponent(record.id)}`}
                          className="leading-snug font-bold hover:underline"
                          lang={record.language}
                        >
                          {record.title ?? t("untitled")}
                        </Link>
                        <p className="mt-1 mb-0 text-sm text-(--t-ink-dim)">
                          {discussionAuthor(record.author, t("member")).name}
                          {" · "}
                          {languageName(record.language, [], locale)}
                          {record.createdAt && (
                            <>
                              {" · "}
                              {t("started")}{" "}
                              <DiscussionTime value={record.createdAt} />
                            </>
                          )}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-0 text-sm">{t("waitingEmpty")}</p>
              )}
            </section>
            <StepsCard
              title={t("howHeading")}
              steps={(["howLanguage", "reviewLead", "howFollow"] as const).map(
                (key) => ({ id: key, content: t(key) })
              )}
              footer={<Link href="/knowledge">{t("guidelines")}</Link>}
            />
            {actor.signedIn && actor.ready && (
              <section className="rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-6">
                <h2 className="m-0 font-serif text-2xl">{t("youFollow")}</h2>
                {followed.length ? (
                  <ul className="mt-4 mb-0 grid list-none gap-4 p-0">
                    {followed.map((record) => (
                      <li
                        key={record.id}
                        className="border-t border-(--t-border-line) pt-3"
                      >
                        <Link
                          href={`/community/discussions/${encodeURIComponent(record.id)}`}
                          className="leading-snug font-bold hover:underline"
                          lang={record.language}
                        >
                          {record.title ?? t("untitled")}
                        </Link>
                        {record.activityAt && (
                          <p className="mt-1 mb-0 text-sm text-(--t-ink-dim)">
                            {t("latestActivity")}{" "}
                            <DiscussionTime value={record.activityAt} />
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-(--t-ink-dim)">
                    {t("followLead")}
                  </p>
                )}
                <Button
                  type="button"
                  variant="surface"
                  size="pill"
                  onClick={() => changeFilters({ view: "following" })}
                  className="mt-3"
                >
                  {t("following")}
                </Button>
              </section>
            )}
            {actor.canModerate && actor.ready && (
              <Button
                asChild
                variant="surface"
                size="pill"
                className="border-dashed border-(--t-palette-coral-fg) bg-(--t-palette-coral-bg) text-(--t-palette-coral-fg) hover:bg-(--t-palette-coral-soft) focus-visible:ring-(--t-palette-coral-fg)/50"
              >
                <Link href="/contribute/moderation?tab=discussions">
                  <ShieldCheck aria-hidden="true" />
                  {t("moderation")}
                </Link>
              </Button>
            )}
          </aside>
        </div>
      </Container>
      {actor.ready && (
        <Dialog open={showComposer} onOpenChange={setShowComposer}>
          <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl bg-(--t-bg-deep) sm:max-w-xl">
            <DialogTitle className="font-serif text-3xl">
              {t("newThread")}
            </DialogTitle>
            <DialogDescription>{t("reviewLead")}</DialogDescription>
            {subject ? (
              <>
                <label>
                  {t("subject")}
                  <SelectField
                    label={t("newThreadSubject")}
                    value={subject.id}
                    onValueChange={setComposerSubject}
                    className="mt-1"
                    options={visibleSubjects.map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))}
                  />
                </label>
                <DiscussionComposer
                  subject={subject}
                  language={draft.language}
                  compositionPreferences={actor.compositionPreferences}
                  initialTitle={draft.title}
                  initialBody={draft.body}
                  onDraftChange={setDraft}
                  initialAttachments={draftImages}
                  onAttachmentsChange={setDraftImages}
                  languages={languages}
                  returnTo={
                    typeof window === "undefined"
                      ? "/community/discussions"
                      : `${window.location.pathname}${window.location.search}`
                  }
                  signedIn={actor.signedIn}
                  disabled={
                    subject.createPolicy === "moderators" && !actor.canModerate
                  }
                  onSubmitted={() =>
                    recover().catch((failure) =>
                      setError(t(discussionErrorKey(failure)))
                    )
                  }
                />
              </>
            ) : (
              <DiscussionComposerSkeleton />
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
