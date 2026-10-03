"use client"

import { Icon } from "@iconify/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { ArticleBodyBlocks } from "@/components/blog/ArticleBodyBlocks"
import { useCapabilities } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import type { ArticleBodyBlock } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

import {
  ARTICLE_KIND_META,
  type ArticleDraft,
  type ArticleKind,
  type ArticleLocale,
  EMPTY_DOC,
  type ExistingArticle,
} from "./article.types"
import {
  dynamicZoneToTiptap,
  isEmptyDoc,
  tiptapToDynamicZone,
  wordCount,
} from "./articleBlocks"
import { ArticleEditor, type UploadedImage } from "./ArticleEditor"
import { ArticlePreview } from "./ArticlePreview"
import {
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

/** A submission's draftData back into editor state. */
function draftFromServer(d: Record<string, unknown>): Partial<ArticleDraft> & {
  locale?: string
} {
  const body = Array.isArray(d.body)
    ? d.body
    : Array.isArray(d.proposedBody)
      ? d.proposedBody
      : null
  const str = (v: unknown) => (typeof v === "string" ? v : undefined)

  return {
    title: str(d.title) ?? str(d.proposedTitle),
    summary: str(d.summary) ?? str(d.proposedSummary),
    doc: body ? dynamicZoneToTiptap(body, mediaUrl) : undefined,
    sections: Array.isArray(d.sections)
      ? d.sections.filter((s): s is string => typeof s === "string")
      : undefined,
    tags: Array.isArray(d.tags) ? (d.tags as ArticleDraft["tags"]) : undefined,
    editSummary: str(d.editSummary),
    locale: str(d.locale),
  }
}

function mediaUrl(url: string) {
  return formatStrapiMediaUrl(url) ?? url
}

function relativeTime(iso: string | undefined): string {
  if (!iso) return ""
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 2) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} h ago`

  return `${Math.floor(hrs / 24)} d ago`
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
}) {
  const meta = ARTICLE_KIND_META[kind]
  const { has, ready } = useCapabilities()
  const canDirect = ready && has(meta.capability)
  const sourceLocale =
    article?.locale ?? locales.find((l) => l.isDefault)?.code ?? uiLocale

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
          }
        : {
            title: "",
            summary: "",
            doc: EMPTY_DOC,
            sections: [],
            tags: [],
            editSummary: "",
          },
    [article]
  )

  const [draft, setDraft] = useState<ArticleDraft>(initialDraft)
  const [docKey, setDocKey] = useState("initial")
  const [locale, setLocale] = useState(sourceLocale)
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
  const inFlight = useRef<Promise<void> | null>(null)
  const submissionRef = useRef<string | null>(null)
  const localeRef = useRef(locale)
  localeRef.current = locale
  const translating = mode === "edit" && locale !== sourceLocale
  const submitted = submitState === "submitted"
  const localeName = locales.find((l) => l.code === locale)?.name ?? locale

  const hydrate = useCallback((d: ServerDraft) => {
    const from = draftFromServer(d.draftData ?? {})
    setDraft((prev) => ({
      title: from.title ?? prev.title,
      summary: from.summary ?? prev.summary,
      doc: from.doc ?? prev.doc,
      sections: from.sections ?? prev.sections,
      tags: from.tags ?? prev.tags,
      editSummary: from.editSummary ?? prev.editSummary,
    }))
    if (from.locale) setLocale(from.locale)
    setDocKey(`draft:${d.documentId}`)
    setSubmissionId(d.documentId)
    submissionRef.current = d.documentId
    setLastSavedAt(d.updatedAt ? new Date(d.updatedAt) : new Date())
    setResumable(null)
  }, [])

  // Find an unsent draft to continue: by id for a new article, by target
  // for an existing one.
  useEffect(() => {
    let cancelled = false
    const url =
      mode === "new"
        ? resumeDraftId
          ? "/api/submissions/my"
          : null
        : `/api/submissions/draft/${meta.submissionType}?targetSlug=${encodeURIComponent(article?.slug ?? "")}`
    if (!url) return
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { data?: ServerDraft | ServerDraft[] | null } | null) => {
        if (cancelled || !json?.data) return
        const found = Array.isArray(json.data)
          ? json.data.find(
              (s) => s.documentId === resumeDraftId && s.status === "draft"
            )
          : json.data
        if (!found?.draftData) return
        if (mode === "new") hydrate(found)
        else setResumable(found)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [mode, resumeDraftId, article?.slug, meta.submissionType, hydrate])

  const buildDraftData = useCallback(
    (d: ArticleDraft) => {
      const body = tiptapToDynamicZone(d.doc)
      const direct = mode === "new" || canDirect
      const common = {
        locale: localeRef.current,
        sections: d.sections,
        tags: d.tags,
        editSummary: d.editSummary,
        ...(mode === "edit"
          ? {
              targetSlug: article?.slug,
              isTranslation: localeRef.current !== sourceLocale,
              sourceLocale,
            }
          : {}),
      }
      if (mode === "new")
        return {
          kind: "new_article",
          title: d.title,
          summary: d.summary,
          body,
          ...common,
        }
      if (direct) return { title: d.title, summary: d.summary, body, ...common }

      return {
        proposedTitle: d.title,
        proposedSummary: d.summary,
        proposedBody: body,
        ...common,
      }
    },
    [mode, canDirect, article?.slug, sourceLocale]
  )

  const persist = useCallback(
    async (d: ArticleDraft) => {
      if (submitted) return
      setSaveState("saving")
      try {
        const draftData = buildDraftData(d)
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
          if (!res.ok) throw new Error(await readError(res, "Couldn’t save"))
          const json = (await res.json()) as { data?: { documentId?: string } }
          if (!json.data?.documentId) throw new Error("Couldn’t save")
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
          if (!res.ok) throw new Error(await readError(res, "Couldn’t save"))
        }
        setSaveState("saved")
        setLastSavedAt(new Date())
      } catch {
        setSaveState("error")
      }
    },
    [buildDraftData, meta, mode, article?.slug, submitted]
  )

  // Debounced autosave; one request at a time.
  const scheduleSave = useCallback(
    (d: ArticleDraft) => {
      dirty.current = true
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        const run = async () => {
          if (inFlight.current) await inFlight.current
          dirty.current = false
          inFlight.current = persist(d).finally(() => {
            inFlight.current = null
          })
          await inFlight.current
        }
        void run()
      }, AUTOSAVE_MS)
    },
    [persist]
  )

  const update = useCallback(
    (patch: Partial<ArticleDraft>) => {
      setDraft((prev) => {
        // TipTap reports its normalised document on mount; only a real
        // change should touch the server.
        if (
          patch.doc &&
          Object.keys(patch).length === 1 &&
          JSON.stringify(patch.doc) === JSON.stringify(prev.doc)
        )
          return prev
        const next = { ...prev, ...patch }
        scheduleSave(next)

        return next
      })
    },
    [scheduleSave]
  )

  // Switching language on an existing article loads that translation, or
  // starts an empty one with the original showing as the source.
  const changeLocale = async (code: string) => {
    if (code === locale || mode !== "edit" || !article) {
      setLocale(code)

      return
    }
    setLoadingLocale(true)
    setLocale(code)
    setView("write")
    try {
      if (code === sourceLocale) {
        setDraft((prev) => ({
          ...prev,
          ...initialDraft,
          editSummary: prev.editSummary,
        }))
        setDocKey(`locale:${code}`)
      } else {
        const res = await fetch(
          `/api/contribute/article?kind=${kind}&slug=${encodeURIComponent(article.slug)}&locale=${encodeURIComponent(code)}`
        )
        const json = res.ok
          ? ((await res.json()) as {
              data?: { title?: string; summary?: string; body?: unknown } | null
            })
          : null
        const existing = json?.data
        setDraft((prev) => ({
          ...prev,
          title: existing?.title ?? "",
          summary: existing?.summary ?? "",
          doc: existing?.body
            ? dynamicZoneToTiptap(existing.body, mediaUrl)
            : EMPTY_DOC,
        }))
        setDocKey(`locale:${code}`)
        setView("source")
      }
    } finally {
      setLoadingLocale(false)
    }
  }

  // A link such as "Translate into French" opens that language once, on load.
  const openedInitialLocale = useRef(false)
  useEffect(() => {
    if (openedInitialLocale.current) return
    openedInitialLocale.current = true
    if (initialLocale && initialLocale !== sourceLocale)
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
    ? "Give the article a title."
    : empty && !(mode === "edit" && !translating)
      ? "Write something before sending."
      : draft.sections.length === 0
        ? kind === "knowledge"
          ? "Pick at least one Knowledge section."
          : "Pick a Journal section."
        : mode === "edit" && !draft.editSummary.trim()
          ? "Say what changed."
          : null
  const canSubmit = !validation && !loadingLocale

  const submit = async () => {
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
      if (!submissionRef.current || dirty.current) await persist(draft)
      if (!submissionRef.current) throw new Error("Couldn’t save the draft.")
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
                ? `New ${meta.label.toLowerCase()}: ${draft.title.trim()}`
                : ""),
          }),
        }
      )
      if (!res.ok)
        throw new Error(await readError(res, "Couldn’t send for review."))
      setSubmitState("submitted")
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Couldn’t send for review."
      )
      setSubmitState("error")
    }
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
              All articles
            </Link>
            <div
              role="tablist"
              aria-label="View"
              className="inline-flex gap-1 rounded-full p-1"
              style={{ background: T.bg.muted2 }}
            >
              {segment("write", "Write")}
              {segment("preview", "Preview")}
              {translating && segment("source", "Source")}
            </div>
          </div>

          {resumable && (
            <div
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] px-5 py-3.5"
              style={{ background: T.accent.chip, color: T.ink.base }}
            >
              <p className="m-0 text-[15px]">
                <strong>You have an unsent draft</strong> from{" "}
                {relativeTime(resumable.updatedAt)}. Continue it, or start again
                from the published article.
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
                  Continue draft
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
                  Start again
                </button>
              </span>
            </div>
          )}

          {view === "write" && (
            <div
              className={loadingLocale ? "opacity-60" : undefined}
              aria-busy={loadingLocale}
            >
              <ArticleEditor
                kind={kind}
                title={draft.title}
                summary={draft.summary}
                doc={draft.doc}
                docKey={docKey}
                readOnly={submitted}
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
                aria-label="Source article"
                className="px-6 py-8 sm:px-10"
              >
                <p
                  className="m-0 mb-3 text-[13px] font-semibold tracking-wide uppercase"
                  style={{ color: T.ink.dim }}
                >
                  Source ·{" "}
                  {locales.find((l) => l.code === sourceLocale)?.name ??
                    sourceLocale}
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
            <span>
              {words} word{words === 1 ? "" : "s"}
            </span>
            <span>{Math.max(1, Math.round(words / 200))} min read</span>
            <span>Select text to format it with the toolbar.</span>
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
          {mode === "edit" && (
            <EditSummaryCard
              value={draft.editSummary}
              onChange={(editSummary) => update({ editSummary })}
              disabled={submitted}
            />
          )}
          <SectionsCard
            kind={kind}
            sections={draft.sections}
            onChange={(sections) => update({ sections })}
            disabled={submitted}
          />
          <TagsCard
            tags={draft.tags}
            onChange={(tags) => update({ tags })}
            disabled={submitted}
          />
          <LanguageCard
            mode={mode}
            locale={locale}
            locales={locales}
            sourceLocale={sourceLocale}
            availableLocales={article?.availableLocales ?? []}
            onChange={(code) => void changeLocale(code)}
            disabled={submitted}
          />
          <HowEditingWorks publishesDirectly={canDirect} />
          {submissionId && (
            <p
              className="m-0 px-2 text-[12.5px]"
              style={{ color: T.ink.faint, fontFamily: T.font.mono }}
            >
              draft {submissionId}
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
