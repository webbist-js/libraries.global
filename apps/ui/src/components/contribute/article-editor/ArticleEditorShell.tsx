"use client"

import { Icon } from "@iconify/react"
import { useLocale, useTranslations as useUiTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { ArticleBodyBlocks } from "@/components/blog/ArticleBodyBlocks"
import { useCapabilities, useHydratedSession } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"
import type { ArticleBodyBlock } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrlForClient } from "@/lib/strapi-helpers"

import {
  ARTICLE_KIND_META,
  type ArticleDraft,
  type ArticleKind,
  type ArticleTag,
  type ArticleEventMention,
  type ArticleLocale,
  EMPTY_DOC,
  type ExistingArticle,
} from "./article.types"
import { dynamicZoneToTiptap, isEmptyDoc, wordCount } from "./articleBlocks"
import { ArticleBylineCard } from "./ArticleBylineCard"
import { articleDraftData, restoreArticleDraft } from "./articleDraft"
import { ArticleEditor, type UploadedImage } from "./ArticleEditor"
import { ArticlePreview } from "./ArticlePreview"
import {
  ArticleRevisionComparison,
  type PublishedComparison,
} from "./ArticleRevisionComparison"
import {
  ArticleEventsCard,
  EditSummaryCard,
  HowEditingWorks,
  LanguageCard,
  type SaveState,
  SectionsCard,
  StatusCard,
  type SubmitState,
  TagsCard,
} from "./ArticleSidebar"

type View = "write" | "preview" | "source"

type ServerDraft = {
  documentId: string
  status: string
  submissionType: string
  targetSlug?: string | null
  draftData?: Record<string, unknown> | null
  updatedAt?: string
}

const AUTOSAVE_MS = 1500
const NO_TAGS: ArticleTag[] = []
const NO_EVENT_MENTIONS: ArticleEventMention[] = []

function mediaUrl(url: string) {
  return formatStrapiMediaUrlForClient(url) ?? url
}

function relativeTime(iso: string | undefined, locale: string): string {
  if (!iso) return ""
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 2) return format.format(0, "second")
  if (mins < 60) return format.format(-mins, "minute")
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return format.format(-hrs, "hour")

  return format.format(-Math.floor(hrs / 24), "day")
}

async function readError(res: Response, fallback: string) {
  try {
    const json = (await res.json()) as { error?: { message?: string } | string }
    if (typeof json.error === "string") return json.error

    return json.error?.message ?? fallback
  } catch {
    return fallback
  }
}

/**
 * The article editor page: write, preview (and read the source while
 * translating), pick sections, tags and language, and send for review.
 * Drafts autosave through /api/submissions as the signed-in user; Strapi's
 * submission policy decides what a role may do with them.
 */
export function ArticleEditorShell({
  kind,
  mode,
  article,
  resumeDraftId,
  locales,
  uiLocale,
  initialLocale,
  initialTags = NO_TAGS,
  initialEventMentions = NO_EVENT_MENTIONS,
  canOwnEdit = false,
}: {
  readonly kind: ArticleKind
  readonly mode: "new" | "edit"
  readonly article?: ExistingArticle
  /** A saved new-article draft to continue (its submission documentId). */
  readonly resumeDraftId?: string
  readonly locales: ArticleLocale[]
  readonly uiLocale: string
  /** Language to open on load (from `?locale=`), a configured locale. */
  readonly initialLocale?: string
  readonly initialTags?: ArticleTag[]
  readonly initialEventMentions?: ArticleEventMention[]
  /** Server-authorized ownership; own edits still require moderation. */
  readonly canOwnEdit?: boolean
}) {
  const tUi = useUiTranslations("ui")
  const tLanguage = useUiTranslations("translation")
  const tEditor = useUiTranslations("articleEditor")
  const tConflict = useUiTranslations("articleConflict")
  const { data: session } = useHydratedSession()
  const displayLocale = useLocale()

  const meta = ARTICLE_KIND_META[kind]
  const { canDirectEdit, ready } = useCapabilities()
  const sourceLocale =
    article?.locale ??
    locales.find((l) => l.code === uiLocale)?.code ??
    locales.find((l) => l.isDefault)?.code ??
    uiLocale

  const initialDraft = useMemo<ArticleDraft>(
    () =>
      article
        ? {
            title: article.title,
            summary: article.summary,
            doc: dynamicZoneToTiptap(article.body, mediaUrl),
            sections: article.sections,
            tags: article.tags,
            editSummary: "",
            eventMentions: article.eventMentions ?? [],
          }
        : {
            title: "",
            summary: "",
            doc: EMPTY_DOC,
            sections: [],
            tags: initialTags,
            editSummary: "",
            eventMentions: initialEventMentions,
            byline: "",
            origin: "community",
          },
    [article, initialTags, initialEventMentions]
  )

  const [draft, setDraft] = useState<ArticleDraft>(initialDraft)
  const draftRef = useRef(initialDraft)
  const baseRevisionRef = useRef<string | null>(article?.baseRevision ?? null)
  const rebaseRevisionRef = useRef<string | null>(null)
  const [staleArticle, setStaleArticle] = useState(false)
  const [comparison, setComparison] = useState<PublishedComparison | null>(null)
  const [comparing, setComparing] = useState(false)
  const [docKey, setDocKey] = useState("initial")
  const [locale, setLocale] = useState(sourceLocale)
  const editorKind = kind === "knowledge" ? "docs" : "journal"
  const canDirect = ready && canDirectEdit(editorKind, locale)
  const openJournalDraft = mode === "new" && kind === "journal"
  const [loadedResumeId, setLoadedResumeId] = useState<string | null>(null)
  const [resumeUnavailable, setResumeUnavailable] = useState(false)
  const resuming = Boolean(resumeDraftId && loadedResumeId !== resumeDraftId)
  const canWrite =
    !resuming &&
    !resumeUnavailable &&
    (openJournalDraft || canOwnEdit || canDirect)
  const allowIndexOrigin =
    canDirect &&
    (session?.user as { editorLocales?: { journal?: unknown } } | undefined)
      ?.editorLocales?.journal === "all"
  const [view, setView] = useState<View>("write")
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [submitState, setSubmitState] = useState<SubmitState>("idle")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [resumable, setResumable] = useState<ServerDraft | null>(null)
  const [loadingLocale, setLoadingLocale] = useState(false)

  const dirty = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveGeneration = useRef(0)
  const inFlight = useRef<Promise<boolean> | null>(null)
  const submissionRef = useRef<string | null>(null)
  const localeRef = useRef(locale)
  localeRef.current = locale
  const translating = mode === "edit" && locale !== sourceLocale
  const submitted = submitState === "submitted"
  const editorBusy = loadingLocale || comparing || submitState === "submitting"
  const localeName = languageName(locale, locales, displayLocale)

  useEffect(
    () => () => {
      saveGeneration.current++
      if (saveTimer.current) clearTimeout(saveTimer.current)
    },
    []
  )

  const hydrate = useCallback(
    (d: ServerDraft) => {
      const from = restoreArticleDraft(d.draftData ?? {}, mediaUrl)
      const previous = draftRef.current
      const next = {
        title: from.title ?? previous.title,
        summary: from.summary ?? previous.summary,
        doc: from.doc ?? previous.doc,
        sections: from.sections ?? previous.sections,
        tags: from.tags ?? previous.tags,
        editSummary: from.editSummary ?? previous.editSummary,
        eventMentions: from.eventMentions ?? previous.eventMentions,
        byline: from.byline ?? previous.byline,
        origin: from.origin ?? previous.origin,
      }
      draftRef.current = next
      setDraft(next)
      baseRevisionRef.current = from.baseRevision ?? null
      rebaseRevisionRef.current = null
      setComparison(null)
      setStaleArticle(
        Boolean(
          from.baseRevision &&
          article?.baseRevision &&
          (!from.locale || from.locale === article.locale) &&
          from.baseRevision !== article.baseRevision
        )
      )
      if (from.locale) setLocale(from.locale)
      setDocKey(`draft:${d.documentId}`)
      setSubmissionId(d.documentId)
      submissionRef.current = d.documentId
      setLastSavedAt(d.updatedAt ? new Date(d.updatedAt) : new Date())
      setResumable(null)
      setLoadedResumeId(d.documentId)
      setResumeUnavailable(false)
    },
    [article?.baseRevision, article?.locale]
  )

  const lookupLocale = resumeDraftId ? null : locale

  // Find an unsent draft to continue: by id for a new article, by target
  // for an existing one.
  useEffect(() => {
    let cancelled = false
    const url = resumeDraftId
      ? `/api/submissions/my?documentId=${encodeURIComponent(resumeDraftId)}`
      : mode === "new"
        ? null
        : `/api/submissions/draft/${meta.submissionType}?targetSlug=${encodeURIComponent(article?.slug ?? "")}&locale=${encodeURIComponent(lookupLocale ?? "")}`
    if (!url) return
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { data?: ServerDraft | ServerDraft[] | null } | null) => {
        if (cancelled) return
        const found = Array.isArray(json?.data)
          ? json.data.find(
              (s) =>
                s.documentId === resumeDraftId &&
                ["draft", "needs_info"].includes(s.status)
            )
          : json?.data
        if (
          !found?.draftData ||
          found.submissionType !== meta.submissionType ||
          (mode === "edit" && found.targetSlug !== article?.slug) ||
          (mode === "new" && Boolean(found.targetSlug))
        ) {
          if (resumeDraftId) {
            setLoadedResumeId(resumeDraftId)
            setResumeUnavailable(true)
            setSubmitError(tConflict("draftUnavailable"))
            setSubmitState("error")
          }

          return
        }
        if (mode === "new" || resumeDraftId) hydrate(found)
        else setResumable(found)
      })
      .catch(() => {
        if (!cancelled && resumeDraftId) {
          setLoadedResumeId(resumeDraftId)
          setResumeUnavailable(true)
          setSubmitError(tConflict("draftUnavailable"))
          setSubmitState("error")
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    mode,
    resumeDraftId,
    article?.slug,
    meta.submissionType,
    hydrate,
    lookupLocale,
    tConflict,
  ])

  const buildDraftData = useCallback(
    (value: ArticleDraft) =>
      articleDraftData(value, {
        mode,
        direct: canOwnEdit || canDirect,
        locale: localeRef.current,
        targetSlug: article?.slug,
        sourceLocale,
        baseRevision: baseRevisionRef.current,
        rebaseRevision: rebaseRevisionRef.current,
        journal: kind === "journal",
      }),
    [mode, kind, canOwnEdit, canDirect, article?.slug, sourceLocale]
  )

  const persist = useCallback(
    async (d: ArticleDraft) => {
      if (submitted) return false
      setSaveState("saving")
      try {
        const draftData = buildDraftData(d)
        const requestedRebase = rebaseRevisionRef.current
        if (!submissionRef.current) {
          const res = await fetch("/api/submissions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              submissionType: meta.submissionType,
              targetEntityType: meta.targetEntityType,
              ...(mode === "edit" ? { targetSlug: article?.slug } : {}),
              draftData,
              editSummary: d.editSummary,
              asDraft: true,
            }),
          })
          if (!res.ok) {
            if (res.status === 409) setStaleArticle(true)
            throw new Error(await readError(res, tUi("couldnt_save")))
          }
          const json = (await res.json()) as { data?: { documentId?: string } }
          if (!json.data?.documentId) throw new Error(tUi("couldnt_save"))
          submissionRef.current = json.data.documentId
          setSubmissionId(json.data.documentId)
        } else {
          const res = await fetch(
            `/api/submissions/${submissionRef.current}/draft`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ draftData, stepCompleted: 1 }),
            }
          )
          if (!res.ok) {
            if (res.status === 409) setStaleArticle(true)
            throw new Error(await readError(res, tUi("couldnt_save")))
          }
        }
        if (requestedRebase && rebaseRevisionRef.current === requestedRebase) {
          baseRevisionRef.current = requestedRebase
          rebaseRevisionRef.current = null
          setStaleArticle(false)
          setComparison(null)
        }
        setSaveState("saved")
        setLastSavedAt(new Date())

        return true
      } catch {
        setSaveState("error")

        return false
      }
    },
    [buildDraftData, meta, mode, article?.slug, submitted, tUi]
  )

  // Debounced autosave; one request at a time.
  const scheduleSave = useCallback(
    (d: ArticleDraft) => {
      dirty.current = true
      if (saveTimer.current) clearTimeout(saveTimer.current)
      const generation = saveGeneration.current
      saveTimer.current = setTimeout(() => {
        const run = async () => {
          if (inFlight.current) await inFlight.current
          if (generation !== saveGeneration.current) return
          dirty.current = false
          inFlight.current = persist(d).finally(() => {
            inFlight.current = null
          })
          if (!(await inFlight.current)) dirty.current = true
        }
        void run()
      }, AUTOSAVE_MS)
    },
    [persist]
  )

  const update = useCallback(
    (patch: Partial<ArticleDraft>) => {
      if (editorBusy || submitted || !canWrite) return
      const previous = draftRef.current
      // A TipTap mount may report a normalized document without an edit.
      if (
        patch.doc &&
        Object.keys(patch).length === 1 &&
        JSON.stringify(patch.doc) === JSON.stringify(previous.doc)
      )
        return
      const next = { ...previous, ...patch }
      draftRef.current = next
      setDraft(next)
      scheduleSave(next)
    },
    [scheduleSave, editorBusy, submitted, canWrite]
  )

  // Switching language on an existing article loads that translation, or
  // starts an empty one with the original showing as the source.
  const changeLocale = async (code: string) => {
    if (
      editorBusy ||
      submitted ||
      !locales.some((l) => l.code === code) ||
      !(openJournalDraft || canOwnEdit || canDirectEdit(editorKind, code))
    )
      return
    if (code === locale) return
    setLoadingLocale(true)
    try {
      // Flush the old language before replacing its draft or submission ID.
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveGeneration.current++
      if (inFlight.current) await inFlight.current
      if ((dirty.current || saveState === "error") && !(await persist(draft))) {
        setSubmitError(tLanguage("saveFailed"))
        setSubmitState("error")

        return
      }
      dirty.current = false
      if (mode !== "edit" || !article) {
        // A new language starts its own submission, keeping the current text
        // available to adapt rather than changing a saved draft's locale.
        setDocKey(`locale:${code}`)
      } else if (code === sourceLocale) {
        draftRef.current = initialDraft
        setDraft(initialDraft)
        baseRevisionRef.current = article.baseRevision ?? null
        setDocKey(`locale:${code}`)
        setView("write")
      } else {
        const res = await fetch(
          `/api/contribute/article?kind=${kind}&slug=${encodeURIComponent(article.slug)}&locale=${encodeURIComponent(code)}`
        )
        if (!res.ok && res.status !== 404) throw new Error("Locale read failed")
        const json = res.ok
          ? ((await res.json()) as {
              data?: {
                title?: string
                summary?: string
                body?: unknown
                contentRevision?: string
                sections?: string[]
                tags?: ArticleTag[]
                eventMentions?: ArticleEventMention[]
              } | null
            })
          : null
        const existing = json?.data
        const next = {
          ...draftRef.current,
          title: existing?.title ?? "",
          summary: existing?.summary ?? "",
          doc: existing?.body
            ? dynamicZoneToTiptap(existing.body, mediaUrl)
            : EMPTY_DOC,
          editSummary: "",
          sections: existing?.sections ?? draftRef.current.sections,
          tags: existing?.tags ?? draftRef.current.tags,
          eventMentions:
            existing?.eventMentions ?? draftRef.current.eventMentions,
        }
        draftRef.current = next
        setDraft(next)
        baseRevisionRef.current = existing?.contentRevision ?? null
        setDocKey(`locale:${code}`)
        setView("source")
      }
      submissionRef.current = null
      setSubmissionId(null)
      setSaveState("idle")
      setLastSavedAt(null)
      setResumable(null)
      rebaseRevisionRef.current = null
      setComparison(null)
      setStaleArticle(false)
      setSubmitState("idle")
      setSubmitError(null)
      localeRef.current = code
      setLocale(code)
    } catch {
      setSubmitError(tLanguage("switchFailed"))
      setSubmitState("error")
    } finally {
      setLoadingLocale(false)
    }
  }

  // A link such as "Translate into French" opens that language once, on load.
  const openedInitialLocale = useRef(false)
  useEffect(() => {
    if (!ready) return
    if (openedInitialLocale.current) return
    openedInitialLocale.current = true
    if (!resumeDraftId && initialLocale && initialLocale !== sourceLocale)
      void changeLocale(initialLocale)
  })

  const uploadImage = useCallback(
    async (file: File): Promise<UploadedImage | null> => {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/submissions/upload-image", {
        method: "POST",
        body: form,
      })
      if (!res.ok) return null
      const json = (await res.json()) as { id?: number; url?: string }
      if (typeof json.id !== "number" || !json.url) return null

      return {
        id: json.id,
        url: json.url,
        alt: file.name.replace(/\.[a-z0-9]+$/i, ""),
      }
    },
    []
  )

  const words = wordCount(draft.doc)
  const empty = isEmptyDoc(draft.doc)
  const validation = !draft.title.trim()
    ? tUi("give_the_article_a_title")
    : empty && !(mode === "edit" && !translating)
      ? tUi("write_something_before_sending")
      : draft.sections.length === 0
        ? kind === "knowledge"
          ? tUi("pick_at_least_one_knowledge_section")
          : tUi("pick_a_journal_section")
        : mode === "edit" && !draft.editSummary.trim()
          ? tUi("say_what_changed")
          : null
  const canSubmit = !validation && !editorBusy && !staleArticle && canWrite

  const submit = async () => {
    if (!canWrite || staleArticle || editorBusy) return
    if (validation) {
      setSubmitError(validation)
      setSubmitState("error")

      return
    }
    setSubmitState("submitting")
    setSubmitError(null)
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (inFlight.current) await inFlight.current
      if ((!submissionRef.current || dirty.current) && !(await persist(draft)))
        throw new Error(tLanguage("saveFailed"))
      if (!submissionRef.current) throw new Error(tUi("couldnt_save_the_draft"))
      const res = await fetch(
        `/api/submissions/${submissionRef.current}/finalize`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(mode === "new" ? { kind: "new_article" } : {}),
            title: draft.title.trim(),
            summary: draft.summary.trim(),
            sections: draft.sections,
            tags: draft.tags,
            locale,
            isTranslation: translating,
            sourceLocale,
            editSummary:
              draft.editSummary.trim() ||
              (mode === "new"
                ? tEditor("newArticle", {
                    kind: tEditor(
                      kind === "knowledge" ? "kindKnowledge" : "kindJournal"
                    ),
                    title: draft.title.trim(),
                  })
                : ""),
          }),
        }
      )
      if (!res.ok) {
        if (res.status === 409) setStaleArticle(true)
        throw new Error(await readError(res, tUi("couldnt_send_for_review")))
      }
      setSubmitState("submitted")
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : tUi("couldnt_send_for_review")
      )
      setSubmitState("error")
    }
  }

  const comparePublished = async () => {
    if (!article || comparing) return
    setComparing(true)
    try {
      const read = async (code: string) => {
        const response = await fetch(
          `/api/contribute/article?kind=${kind}&slug=${encodeURIComponent(article.slug)}&locale=${encodeURIComponent(code)}`
        )
        if (!response.ok) throw new Error(tConflict("loadFailed"))

        return (await response.json()) as {
          data?: {
            title: string
            summary?: string
            body?: unknown
            contentRevision?: string
            sections?: string[]
            tags?: ArticleTag[]
            eventMentions?: ArticleEventMention[]
          } | null
        }
      }
      let comparisonLocale = localeRef.current
      let result = await read(comparisonLocale)
      if (!result.data && comparisonLocale !== sourceLocale) {
        comparisonLocale = sourceLocale
        result = await read(comparisonLocale)
      }
      if (!result.data?.contentRevision)
        throw new Error(tConflict("loadFailed"))
      setComparison({
        title: result.data.title,
        summary: result.data.summary ?? "",
        doc: dynamicZoneToTiptap(result.data.body ?? [], mediaUrl),
        revision: result.data.contentRevision,
        locale: comparisonLocale,
        sections: result.data.sections ?? [],
        tags: result.data.tags ?? [],
        eventMentions: result.data.eventMentions ?? [],
      })
      setSubmitError(null)
    } catch (failure) {
      setSubmitError(
        failure instanceof Error ? failure.message : tConflict("loadFailed")
      )
      setSubmitState("error")
    } finally {
      setComparing(false)
    }
  }

  const adoptComparedRevision = async () => {
    if (!comparison || comparing || !canWrite) return
    setComparing(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveGeneration.current++
    if (inFlight.current) await inFlight.current
    // The audited adoption seam updates an existing private submission.
    if (!submissionRef.current && !(await persist(draftRef.current))) {
      setSubmitError(tLanguage("saveFailed"))
      setSubmitState("error")
      setComparing(false)

      return
    }
    rebaseRevisionRef.current = comparison.revision
    dirty.current = true
    if (await persist(draftRef.current)) {
      dirty.current = false
      setSubmitState("idle")
      setSubmitError(null)
    } else {
      rebaseRevisionRef.current = null
      setStaleArticle(true)
      setSubmitState("error")
      setSubmitError(tConflict("changedAgain"))
    }
    setComparing(false)
  }

  const sourceBlocks = useMemo(
    () =>
      (Array.isArray(article?.body) ? article.body : []).map((b, i) => ({
        id: i,
        ...(b as object),
      })) as unknown as ArticleBodyBlock[],
    [article?.body]
  )

  const segment = (id: View, label: string) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={view === id}
      onClick={() => setView(id)}
      className="rounded-full px-4 py-2 text-[14px] font-semibold transition-colors"
      style={{
        background: view === id ? T.bg.deep : "transparent",
        color: view === id ? T.ink.base : T.ink.dim,
        border: "none",
        cursor: "pointer",
        boxShadow: view === id ? `0 0 0 1px ${T.border.line}` : "none",
        fontFamily: T.font.sans,
      }}
    >
      {label}
    </button>
  )

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8 lg:py-10">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Link
              href={
                kind === "journal"
                  ? "/contribute/knowledge?type=journal"
                  : "/contribute/knowledge"
              }
              className="inline-flex items-center gap-1.5 text-[15px] font-semibold no-underline"
              style={{ color: T.ink.base }}
            >
              <Icon icon="mdi:chevron-left" width={20} aria-hidden="true" />
              {tUi("all_articles")}{" "}
            </Link>
            <div
              role="tablist"
              aria-label={tUi("view")}
              className="inline-flex gap-1 rounded-full p-1"
              style={{ background: T.bg.muted2 }}
            >
              {segment("write", tUi("write"))}
              {segment("preview", tUi("preview"))}
              {translating && segment("source", tUi("source"))}
            </div>
          </div>

          {resuming && <p role="status">{tConflict("loadingDraft")}</p>}
          {resumable && (
            <div
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] px-5 py-3.5"
              style={{ background: T.accent.chip, color: T.ink.base }}
            >
              <p className="m-0 text-[15px]">
                <strong>{tUi("you_have_an_unsent_draft")}</strong>{" "}
                {tEditor("resume", {
                  time: relativeTime(resumable.updatedAt, displayLocale),
                })}
              </p>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => hydrate(resumable)}
                  className="rounded-full px-4 py-2 text-[14px] font-semibold text-white"
                  style={{
                    background: T.accent.primary,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: T.font.sans,
                  }}
                >
                  {tUi("continue_draft")}{" "}
                </button>
                <button
                  type="button"
                  onClick={() => setResumable(null)}
                  className="rounded-full px-4 py-2 text-[14px] font-semibold"
                  style={{
                    background: T.bg.deep,
                    border: `1px solid ${T.border.hi}`,
                    color: T.ink.base,
                    cursor: "pointer",
                    fontFamily: T.font.sans,
                  }}
                >
                  {tUi("start_again")}{" "}
                </button>
              </span>
            </div>
          )}

          {mode === "edit" && !submitted && (
            <div className="mb-4 grid gap-2">
              {staleArticle && (
                <p
                  role="alert"
                  className="rounded-xl border border-(--t-border-line) p-4"
                >
                  {tConflict("stale")}
                </p>
              )}
              <button
                type="button"
                className="justify-self-start underline"
                disabled={comparing || loadingLocale}
                onClick={() => {
                  comparePublished()
                }}
              >
                {comparing ? tConflict("loading") : tConflict("compare")}
              </button>
            </div>
          )}
          {comparison && (
            <ArticleRevisionComparison
              kind={kind}
              draft={draft}
              published={comparison}
              busy={comparing || loadingLocale}
              onAdopt={() => {
                adoptComparedRevision()
              }}
            />
          )}

          {view === "write" && (
            <div
              className={editorBusy ? "opacity-60" : undefined}
              aria-busy={editorBusy}
            >
              <ArticleEditor
                kind={kind}
                title={draft.title}
                summary={draft.summary}
                doc={draft.doc}
                docKey={docKey}
                readOnly={submitted || editorBusy || !canWrite}
                onTitleChange={(title) => update({ title })}
                onSummaryChange={(summary) => update({ summary })}
                onDocChange={(doc) => update({ doc })}
                uploadImage={uploadImage}
              />
            </div>
          )}
          {view === "preview" && (
            <div
              className="overflow-hidden rounded-[24px]"
              style={{
                background: T.bg.deep,
                border: `1px solid ${T.border.line}`,
              }}
            >
              <ArticlePreview
                kind={kind}
                title={draft.title}
                summary={draft.summary}
                doc={draft.doc}
              />
            </div>
          )}
          {view === "source" && article && (
            <div
              className="overflow-hidden rounded-[24px]"
              style={{
                background: T.bg.deep,
                border: `1px solid ${T.border.line}`,
              }}
            >
              <article
                aria-label={tUi("source_article")}
                className="px-6 py-8 sm:px-10"
              >
                <p
                  className="m-0 mb-3 text-[13px] font-semibold tracking-wide uppercase"
                  style={{ color: T.ink.dim }}
                >
                  {tEditor("source", {
                    language: languageName(
                      sourceLocale,
                      locales,
                      displayLocale
                    ),
                  })}
                </p>
                <h1
                  className="m-0"
                  style={{
                    fontFamily: T.font.serif,
                    fontSize: "clamp(34px,4vw,48px)",
                    fontWeight: 500,
                    lineHeight: 1.1,
                    letterSpacing: "-0.02em",
                    color: T.ink.base,
                  }}
                >
                  {article.title}
                </h1>
                {article.summary && (
                  <p
                    className="mt-4 mb-0 text-[19px] leading-[1.55]"
                    style={{ color: T.ink.dim }}
                  >
                    {article.summary}
                  </p>
                )}
                <hr
                  className="my-8 border-0"
                  style={{ height: 1, background: T.border.divider }}
                />
                <ArticleBodyBlocks blocks={sourceBlocks} />
              </article>
            </div>
          )}

          <p
            className="mt-3 mb-0 flex flex-wrap gap-x-4 text-[14px]"
            style={{ color: T.ink.dim }}
          >
            <span>{tEditor("words", { count: words })}</span>
            <span>
              {tEditor("readingTime", {
                count: Math.max(1, Math.ceil(words / 200)),
              })}
            </span>
            <span>{tUi("select_text_to_format_it_with_the_toolbar")}</span>
          </p>
        </div>

        <aside className="flex flex-col gap-4 self-start lg:sticky lg:top-[112px]">
          <StatusCard
            mode={mode}
            kind={kind}
            translating={translating}
            localeName={localeName}
            saveState={saveState}
            lastSavedAt={lastSavedAt}
            submitState={submitState}
            submitError={submitError}
            canSubmit={canSubmit}
            publishesDirectly={canDirect}
            onSubmit={() => void submit()}
          />
          {mode === "new" && kind === "journal" && (
            <ArticleBylineCard
              byline={draft.byline ?? ""}
              origin={draft.origin ?? "community"}
              allowIndex={allowIndexOrigin}
              disabled={submitted || editorBusy || !canWrite}
              onChange={update}
            />
          )}
          {mode === "edit" && (
            <EditSummaryCard
              value={draft.editSummary}
              onChange={(editSummary) => update({ editSummary })}
              disabled={submitted || editorBusy || !canWrite}
            />
          )}
          <SectionsCard
            kind={kind}
            locale={locale}
            sections={draft.sections}
            onChange={(sections) => update({ sections })}
            disabled={submitted || editorBusy || !canWrite}
          />
          <TagsCard
            tags={draft.tags}
            locale={locale}
            onChange={(tags) => update({ tags })}
            disabled={submitted || editorBusy || !canWrite}
          />
          <ArticleEventsCard
            mentions={draft.eventMentions ?? []}
            libraries={draft.tags}
            onChange={(eventMentions) => update({ eventMentions })}
            disabled={submitted || editorBusy || !canWrite}
          />
          <LanguageCard
            mode={mode}
            locale={locale}
            locales={locales}
            sourceLocale={sourceLocale}
            availableLocales={article?.availableLocales ?? []}
            allowedLocales={
              ready
                ? locales
                    .filter(
                      (l) =>
                        openJournalDraft ||
                        canOwnEdit ||
                        canDirectEdit(editorKind, l.code)
                    )
                    .map((l) => l.code)
                : []
            }
            onChange={(code) => void changeLocale(code)}
            disabled={submitted || editorBusy}
          />
          <HowEditingWorks publishesDirectly={canDirect} />
          {submissionId && (
            <p
              className="m-0 px-2 text-[12.5px]"
              style={{ color: T.ink.faint, fontFamily: T.font.mono }}
            >
              {tEditor("draft", { id: submissionId })}
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
