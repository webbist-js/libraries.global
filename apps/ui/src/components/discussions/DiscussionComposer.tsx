"use client"

import {
  ChevronDown,
  ImagePlus,
  Languages,
  ShieldCheck,
  Reply,
  MessageSquare,
  ArrowUpRight,
} from "lucide-react"
import dynamic from "next/dynamic"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useEffect, useId, useRef, useState, type ReactNode } from "react"

import { SelectField } from "@/components/ds/SelectField"
import { primaryCtaSm } from "@/components/ui/action-styles"
import { Textarea } from "@/components/ui/textarea"
import {
  compositionLanguage,
  type CompositionPreferences,
} from "@/lib/composition-language"
import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"
import { cn } from "@/lib/styles"

import {
  discussionErrorKey,
  discussionRequest,
  type DiscussionImage,
  type DiscussionRecord,
  type DiscussionLanguage,
  type DiscussionTarget,
  type Subject,
} from "./api"
import { DiscussionImageEditor } from "./DiscussionImageEditor"

function WritingEditorLoading() {
  const ui = useTranslations("ui")

  return (
    <p role="status" className="min-h-56 py-6">
      {ui("loading")}
    </p>
  )
}

const DiscussionWritingEditor = dynamic(
  () =>
    import("@/components/discussions/DiscussionWritingEditor").then(
      (module) => module.DiscussionWritingEditor
    ),
  {
    ssr: false,
    loading: WritingEditorLoading,
  }
)

export function DiscussionComposer({
  subject,
  threadId,
  target,
  language: initialLanguage,
  defaultLanguage,
  compositionPreferences,
  initialTitle = "",
  parentId,
  signedIn,
  disabled,
  onSubmitted,
  languages = [],
  returnTo,
  quote,
  initialBody = "",
  onDraftChange,
  subjectId,
  initialAttachments = [],
  onAttachmentsChange,
  disabledMessage,
  heading,
  onCancel,
  showSubmittedNotice = true,
  lockLanguage = Boolean(target),
  variant = "default",
  footerAction,
  embedded = false,
  collapsed = false,
  onExpand,
  layout = "default",
  subjectControl,
  onBusyChange,
}: {
  subject?: Subject
  threadId?: string
  target?: DiscussionTarget
  language?: string
  defaultLanguage?: string
  compositionPreferences?: CompositionPreferences
  initialTitle?: string
  parentId?: string | null
  signedIn: boolean
  disabled?: boolean
  disabledMessage?: string
  heading?: string
  onCancel?: () => void
  showSubmittedNotice?: boolean
  lockLanguage?: boolean
  onSubmitted: (record?: DiscussionRecord) => void
  languages?: readonly DiscussionLanguage[]
  returnTo?: string
  quote?: { kind: "thread" | "reply"; id: string; version: number } | null
  initialBody?: string
  onDraftChange?: (draft: {
    title: string
    body: string
    language: string
  }) => void
  subjectId?: string
  initialAttachments?: readonly (DiscussionImage & { subjectId?: string })[]
  onAttachmentsChange?: (
    images: (DiscussionImage & { subjectId?: string })[]
  ) => void
  variant?: "default" | "suggestion"
  footerAction?: ReactNode
  embedded?: boolean
  collapsed?: boolean
  onExpand?: () => void
  layout?: "default" | "drawer"
  subjectControl?: ReactNode
  onBusyChange?: (busy: boolean) => void
}) {
  const t = useTranslations("discussions")
  const locale = useLocale()
  const formatter = useFormatter()
  const counterId = useId()
  const picturesId = useId()
  const inlineSuggestion = variant === "suggestion"
  const drawer = layout === "drawer"
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage)
  const languageCodes = subject?.languages?.length
    ? subject.languages
    : languages.map((item) => item.code)
  const language = compositionLanguage({
    selected: selectedLanguage,
    preferences: compositionPreferences,
    available: languageCodes,
    fallback: defaultLanguage ?? locale,
  })
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [images, setImages] = useState<
    (DiscussionImage & { subjectId?: string })[]
  >([...initialAttachments])
  const [uploading, setUploading] = useState(false)
  const [picturesOpen, setPicturesOpen] = useState(false)
  const picturesPanel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (drawer && picturesOpen)
      picturesPanel.current?.scrollIntoView({
        block: "nearest",
        behavior: "instant",
      })
  }, [drawer, picturesOpen])
  useEffect(() => {
    onBusyChange?.(busy || uploading)
  }, [busy, uploading, onBusyChange])
  const imageSubject = subject?.id ?? subjectId
  const wrongSubject = images.some(
    (image) => image.subjectId && image.subjectId !== imageSubject
  )
  if (!signedIn)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/auth/signin?callbackUrl=${encodeURIComponent(returnTo ?? (threadId ? `/community/discussions/${encodeURIComponent(threadId)}` : "/community/discussions"))}`}
          className={cn(
            primaryCtaSm,
            "min-h-[44px] w-fit justify-center no-underline"
          )}
        >
          {t(threadId || inlineSuggestion ? "signInToReply" : "signIn")}
        </Link>
        {embedded && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-full border border-(--t-border-hi) px-4 text-sm font-semibold"
          >
            {t("cancel")}
          </button>
        )}
        {footerAction}
      </div>
    )
  if (disabled)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status">{disabledMessage ?? t("locked")}</p>
        {embedded && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-full border border-(--t-border-hi) px-4 text-sm font-semibold"
          >
            {t("cancel")}
          </button>
        )}
        {footerAction}
      </div>
    )
  if (collapsed && onExpand)
    return (
      <form
        aria-label={heading ?? t("joinConversation")}
        onSubmit={(event) => event.preventDefault()}
      >
        <button
          type="button"
          onClick={onExpand}
          className="discussion-composer-prompt"
          aria-label={heading ?? t("joinConversation")}
          aria-expanded={false}
        >
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-(--t-accent-chip) text-(--t-accent-primary)">
            <Reply size={20} aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block font-semibold">
              {heading ?? t("joinConversation")}
            </span>
            <span className="mt-1 block text-sm text-(--t-ink-dim)">
              {t("inlineReplyPlaceholder")}
            </span>
          </span>
          <ArrowUpRight
            size={20}
            className="shrink-0 text-(--t-accent-primary)"
            aria-hidden
          />
        </button>
        {footerAction}
      </form>
    )
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (
      busy ||
      uploading ||
      wrongSubject ||
      !body.trim() ||
      body.length > 20000 ||
      images.some((image) => !image.altText.trim()) ||
      (!threadId && (!subject || !title.trim()))
    )
      return
    setBusy(true)
    setError("")
    try {
      const result = await discussionRequest<{
        thread?: DiscussionRecord
        reply?: DiscussionRecord
      }>(
        threadId
          ? `threads/${encodeURIComponent(threadId)}/replies`
          : "threads",
        "POST",
        {
          body: body.trim(),
          language,
          ...(quote ? { quote } : {}),
          ...(images.length
            ? {
                attachments: images.map(({ id, altText, caption }) => ({
                  id,
                  altText,
                  ...(caption ? { caption } : {}),
                })),
              }
            : {}),
          ...(threadId
            ? { ...(parentId ? { parentId } : {}) }
            : {
                subjectId: subject!.id,
                title: title.trim(),
                ...(target ? { target } : {}),
              }),
        }
      )
      setBody("")
      onDraftChange?.({ title, body: "", language })
      setImages([])
      onAttachmentsChange?.([])
      setSent(true)
      onSubmitted(result.thread ?? result.reply)
    } catch (failure) {
      setError(t(discussionErrorKey(failure)))
    } finally {
      setBusy(false)
    }
  }

  const languageControl = (
    <div
      className={
        drawer
          ? "grid gap-1 text-xs font-semibold text-(--t-ink-dim)"
          : threadId || inlineSuggestion
            ? "flex flex-wrap items-center gap-2.5 text-sm text-(--t-ink-dim)"
            : "grid gap-1 text-sm font-semibold"
      }
    >
      <span className="inline-flex items-center gap-1.5">
        {(threadId || inlineSuggestion) && <Languages size={15} aria-hidden />}
        {threadId || inlineSuggestion ? t("writingIn") : t("language")}
      </span>
      <SelectField
        label={t("language")}
        value={language}
        disabled={busy || lockLanguage}
        required
        className={
          drawer
            ? "min-h-11 w-auto min-w-[132px] rounded-xl text-sm font-normal shadow-none"
            : threadId || inlineSuggestion
              ? "min-h-[44px] w-auto min-w-[132px] rounded-full border-(--t-border-hi) px-3.5 text-sm font-medium shadow-none dark:bg-(--t-bg-deep) dark:hover:bg-(--t-bg-surface)"
              : "mt-1 min-h-12 px-4 text-base font-normal shadow-none"
        }
        onValueChange={(value) => {
          setSelectedLanguage(value)
          onDraftChange?.({ title, body, language: value })
        }}
        options={[...new Set([...languageCodes, language])]
          .filter(Boolean)
          .map((code) => ({
            value: code,
            label: languageName(code, languages, locale),
          }))}
      />
    </div>
  )

  const pictureToggle = imageSubject && (
    <button
      type="button"
      aria-label={t("addPictures")}
      title={t("addPictures")}
      aria-expanded={picturesOpen}
      aria-controls={picturesId}
      disabled={busy || uploading}
      onClick={() => setPicturesOpen((open) => !open)}
      className={cn(
        "inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) text-sm font-medium text-(--t-ink-dim) hover:text-(--t-accent-primary) disabled:cursor-not-allowed disabled:opacity-50",
        drawer ? "size-11 justify-center" : "px-4"
      )}
    >
      <ImagePlus size={16} aria-hidden />
      <span className={drawer ? "sr-only" : undefined}>{t("addPictures")}</span>
      {!!images.length && (
        <span className="rounded-full bg-(--t-bg-muted) px-1.5 text-xs">
          {images.length}
        </span>
      )}
      {!drawer && (
        <ChevronDown
          size={14}
          className={picturesOpen ? "rotate-180" : undefined}
          aria-hidden
        />
      )}
    </button>
  )
  const pictureEditor = (
    <div
      ref={picturesPanel}
      id={picturesId}
      hidden={!picturesOpen}
      className={drawer ? "mt-6" : undefined}
    >
      <DiscussionImageEditor
        disclosure={false}
        subjectId={imageSubject}
        images={images}
        disabled={busy}
        onBusyChange={setUploading}
        onChange={(next) => {
          setImages(next)
          onAttachmentsChange?.(next)
        }}
      />
    </div>
  )
  const submitButton = (
    <button
      type="submit"
      disabled={
        busy ||
        uploading ||
        wrongSubject ||
        images.some((image) => !image.altText.trim()) ||
        !body.trim() ||
        body.length > 20000 ||
        (!threadId && !title.trim())
      }
      aria-busy={busy}
      className={cn(
        primaryCtaSm,
        "min-h-11 w-fit cursor-pointer justify-center disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      {busy ? t("sending") : t(inlineSuggestion ? "inlinePostReply" : "submit")}
      <ArrowUpRight size={16} aria-hidden />
    </button>
  )

  if (drawer)
    return (
      <form
        aria-label={heading ?? t("newThread")}
        onSubmit={submit}
        className="flex h-full min-h-0 flex-col text-base [--spacing:0.25rem]"
      >
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-4 border-b border-(--t-border-line) bg-(--t-bg-deep) px-5 py-3 sm:px-6">
          <fieldset
            disabled={busy || uploading}
            className="m-0 min-w-0 border-0 p-0"
          >
            {subjectControl}
          </fieldset>
          {languageControl}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-(--t-bg-deep)">
          <div className="mx-auto w-full max-w-[820px] px-5 py-6 sm:px-8 sm:py-8">
            <label className="block">
              <span className="mb-3 block text-sm font-semibold text-(--t-ink-dim)">
                {t("threadTitle")}
              </span>
              <Textarea
                value={title}
                lang={language}
                disabled={busy}
                maxLength={250}
                required
                rows={1}
                placeholder={t("titlePlaceholder")}
                onChange={(event) => {
                  setTitle(event.target.value)
                  setSelectedLanguage(language)
                  onDraftChange?.({ title: event.target.value, body, language })
                }}
                className="mb-5 min-h-12 resize-none rounded-none border-0 bg-transparent p-0 shadow-none"
                style={{ font: "var(--type-h2)" }}
              />
            </label>
            <DiscussionWritingEditor
              value={body}
              language={language}
              disabled={busy}
              describedBy={counterId}
              onChange={(value) => {
                setBody(value)
                setSelectedLanguage(language)
                setSent(false)
                onDraftChange?.({ title, body: value, language })
              }}
            />
            {pictureEditor}
          </div>
        </div>
        <div className="shrink-0 border-t border-(--t-border-line) bg-(--t-bg-deep) px-5 py-4 sm:px-6">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2 text-xs leading-relaxed text-(--t-ink-dim)">
            <p className="m-0 flex max-w-[60ch] items-start gap-2">
              <ShieldCheck size={15} className="shrink-0" aria-hidden />
              {t("reviewLead")}
            </p>
            <span id={counterId}>
              {formatter.number(body.length)} / {formatter.number(20000)}
            </span>
          </div>
          {error && (
            <p role="alert" className="mb-3 text-sm text-(--t-accent-danger)">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {pictureToggle}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {onCancel && (
                <button
                  type="button"
                  disabled={busy || uploading}
                  onClick={onCancel}
                  className="hidden min-h-11 rounded-full border border-(--t-border-hi) px-4 text-sm font-semibold min-[360px]:inline-flex"
                >
                  {t("cancel")}
                </button>
              )}
              {submitButton}
            </div>
          </div>
        </div>
      </form>
    )

  return (
    <form
      aria-label={
        heading ?? (threadId ? t("joinConversation") : t("newThread"))
      }
      onSubmit={(event) => submit(event)}
      className={
        embedded
          ? "grid gap-5 border-t border-(--t-divider) pt-5 text-base [--spacing:0.25rem]"
          : inlineSuggestion
            ? "grid gap-3 text-base [--spacing:0.25rem]"
            : "grid gap-4 rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 text-base [--spacing:0.25rem] sm:p-6"
      }
    >
      <div
        className={
          embedded || (inlineSuggestion && !onCancel)
            ? "sr-only"
            : "flex items-center justify-between gap-3"
        }
      >
        <h3
          className={cn(
            threadId ? "type-small-heading" : "type-h3",
            "m-0 flex items-center gap-2"
          )}
        >
          {threadId ? (
            <Reply
              size={20}
              className="shrink-0 text-(--t-accent-primary)"
              aria-hidden
            />
          ) : (
            <MessageSquare
              size={20}
              className="shrink-0 text-(--t-accent-primary)"
              aria-hidden
            />
          )}
          {heading ?? (threadId ? t("joinConversation") : t("newThread"))}
        </h3>
        {onCancel && !embedded && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-semibold text-(--t-ink-dim) underline underline-offset-4"
          >
            {t("cancel")}
          </button>
        )}
      </div>
      {!threadId && !inlineSuggestion && (
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold">
            {t("threadTitle")}
            <input
              disabled={busy}
              value={title}
              onChange={(event) => {
                setSelectedLanguage(language)
                setTitle(event.target.value)
                onDraftChange?.({ title: event.target.value, body, language })
              }}
              maxLength={250}
              required
              className="mt-1 min-h-12 w-full min-w-0 rounded-xl border border-(--t-border-hi) bg-(--t-bg-deep) px-4 py-3 text-base font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
            />
          </label>
          {languageControl}
        </div>
      )}
      <label className="grid gap-1 text-sm font-semibold">
        <span className={threadId || inlineSuggestion ? "sr-only" : undefined}>
          {t("body")}
        </span>
        <Textarea
          aria-describedby={counterId}
          disabled={busy}
          placeholder={
            inlineSuggestion
              ? t("inlineReplyPlaceholder")
              : threadId
                ? t("replyPlaceholder")
                : embedded
                  ? t("storyMessagePlaceholder")
                  : undefined
          }
          value={body}
          onChange={(event) => {
            setSelectedLanguage(language)
            setBody(event.target.value)
            setSent(false)
            onDraftChange?.({ title, body: event.target.value, language })
          }}
          maxLength={20000}
          required
          rows={inlineSuggestion || threadId ? 3 : 6}
          className={
            inlineSuggestion
              ? "block field-sizing-fixed min-h-28 w-full rounded-[18px] border-(--t-border-hi) bg-(--t-bg-deep) p-4 text-base leading-relaxed font-normal shadow-none placeholder:text-(--t-ink-dim) focus-visible:border-(--t-accent-primary) focus-visible:ring-(--t-accent-primary)/15 md:text-base dark:bg-(--t-bg-deep)"
              : cn(
                  "mt-1 block field-sizing-fixed w-full rounded-[16px] border-(--t-border-hi) bg-(--t-bg-deep) p-4 text-base leading-relaxed font-normal shadow-none placeholder:text-(--t-ink-dim) focus-visible:border-(--t-accent-primary) focus-visible:ring-(--t-accent-primary)/15 md:text-base dark:bg-(--t-bg-deep)",
                  threadId ? "min-h-28" : "min-h-[140px]"
                )
          }
        />
      </label>
      {!inlineSuggestion && !embedded && (
        <p className="m-0 flex items-start gap-1.5 text-sm leading-relaxed text-(--t-ink-dim)">
          <ShieldCheck size={15} className="mt-0.5 shrink-0" aria-hidden />
          {t("reviewLead")}
        </p>
      )}
      {(inlineSuggestion || threadId || imageSubject) && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {(inlineSuggestion || threadId) && languageControl}
            {pictureToggle}
          </div>
          {pictureEditor}
        </>
      )}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3",
          inlineSuggestion && "mt-1 border-t border-(--t-border-line) pt-4"
        )}
      >
        {embedded && (
          <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-relaxed text-(--t-ink-dim)">
            <ShieldCheck size={15} aria-hidden />
            {t("reviewLead")}
            <span id={counterId}>
              · {formatter.number(body.length)} / {formatter.number(20000)}
            </span>
          </p>
        )}
        <div
          className={
            inlineSuggestion
              ? "flex flex-wrap items-center gap-3"
              : "ml-auto flex items-center gap-3"
          }
        >
          {!embedded && (
            <span
              id={counterId}
              className={
                inlineSuggestion ? "sr-only" : "text-xs text-(--t-ink-dim)"
              }
            >
              {formatter.number(body.length)} / {formatter.number(20000)}
            </span>
          )}
          {embedded && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-(--t-border-hi) px-4 text-sm font-semibold hover:bg-(--t-bg-muted)"
            >
              {t("cancel")}
            </button>
          )}
          {submitButton}
          {inlineSuggestion && (
            <p className="m-0 flex max-w-[38ch] items-start gap-1.5 text-xs leading-relaxed text-(--t-ink-dim)">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden />
              {t("inlineReviewLead")}
            </p>
          )}
        </div>
        {footerAction}
      </div>
      {error && (
        <p role="alert" className="m-0">
          {error}
        </p>
      )}
      {sent && showSubmittedNotice && (
        <p role="status" className="m-0">
          {t("pendingFeedback")}
        </p>
      )}
    </form>
  )
}
