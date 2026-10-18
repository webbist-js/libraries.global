"use client"

import { ChevronDown, ImagePlus, Languages, ShieldCheck } from "lucide-react"
import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useId, useState, type ReactNode } from "react"

import { SelectField } from "@/components/ds/SelectField"
import { Textarea } from "@/components/ui/textarea"
import {
  compositionLanguage,
  type CompositionPreferences,
} from "@/lib/composition-language"
import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"
import { cn, primaryCtaSm } from "@/lib/styles"

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
}) {
  const t = useTranslations("discussions")
  const locale = useLocale()
  const formatter = useFormatter()
  const counterId = useId()
  const picturesId = useId()
  const inlineSuggestion = variant === "suggestion"
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
        {footerAction}
      </div>
    )
  if (disabled)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status">{disabledMessage ?? t("locked")}</p>
        {footerAction}
      </div>
    )
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (
      busy ||
      uploading ||
      wrongSubject ||
      !body.trim() ||
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
        threadId || inlineSuggestion
          ? "flex flex-wrap items-center gap-2.5 text-[13px] text-(--t-ink-dim)"
          : "grid gap-1"
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
          threadId || inlineSuggestion
            ? "min-h-[44px] w-auto min-w-[132px] rounded-full border-(--t-border-hi) px-3.5 text-[14px] font-medium shadow-none dark:bg-(--t-bg-deep) dark:hover:bg-(--t-bg-surface)"
            : "mt-1"
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

  return (
    <form
      aria-label={
        heading ?? (threadId ? t("joinConversation") : t("newThread"))
      }
      onSubmit={(event) => submit(event)}
      className={
        inlineSuggestion
          ? "grid gap-3 text-[16px] [--spacing:0.25rem]"
          : "grid gap-4 rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 text-[16px] [--spacing:0.25rem] sm:p-6"
      }
    >
      <div
        className={
          inlineSuggestion && !onCancel
            ? "sr-only"
            : "flex items-center justify-between gap-3"
        }
      >
        <h3
          className={
            inlineSuggestion
              ? "m-0 text-base font-semibold"
              : "m-0 font-serif text-[24px] leading-tight tracking-tight"
          }
        >
          {heading ?? (threadId ? t("joinConversation") : t("newThread"))}
        </h3>
        {onCancel && (
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
        <label>
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
            className="mt-1 w-full rounded-lg border border-(--t-border-line) p-2"
          />
        </label>
      )}
      {!threadId && !inlineSuggestion && languageControl}
      <label>
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
          rows={inlineSuggestion ? 3 : threadId ? 5 : 6}
          className={
            inlineSuggestion
              ? "block field-sizing-fixed min-h-28 w-full rounded-[18px] border-(--t-border-hi) bg-(--t-bg-deep) p-4 text-[16px] leading-relaxed shadow-none placeholder:text-(--t-ink-dim) focus-visible:border-(--t-accent-primary) focus-visible:ring-(--t-accent-primary)/15 md:text-[16px] dark:bg-(--t-bg-deep)"
              : "mt-1 block field-sizing-fixed min-h-[140px] w-full rounded-[16px] border-(--t-border-hi) bg-(--t-bg-deep) p-4 text-[16px] leading-relaxed shadow-none placeholder:text-(--t-ink-dim) focus-visible:border-(--t-accent-primary) focus-visible:ring-(--t-accent-primary)/15 md:text-[16px] dark:bg-(--t-bg-deep)"
          }
        />
      </label>
      {!inlineSuggestion && (
        <p className="m-0 flex items-start gap-1.5 text-[13px] leading-relaxed text-(--t-ink-dim)">
          <ShieldCheck size={15} className="mt-0.5 shrink-0" aria-hidden />
          {t("reviewLead")}
        </p>
      )}
      {(inlineSuggestion || threadId || imageSubject) && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {(inlineSuggestion || threadId) && languageControl}
            {imageSubject && (
              <button
                type="button"
                aria-expanded={picturesOpen}
                aria-controls={picturesId}
                disabled={busy || uploading}
                onClick={() => setPicturesOpen((open) => !open)}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-4 text-[14px] font-medium text-(--t-ink-dim) hover:text-(--t-accent-primary) disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ImagePlus size={16} aria-hidden />
                {t("addPictures")}
                {!!images.length && (
                  <span className="rounded-full bg-(--t-bg-muted) px-1.5 text-xs">
                    {images.length}
                  </span>
                )}
                <ChevronDown
                  size={14}
                  className={picturesOpen ? "rotate-180" : undefined}
                  aria-hidden
                />
              </button>
            )}
          </div>
          <div id={picturesId} hidden={!picturesOpen}>
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
        </>
      )}
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3",
          inlineSuggestion && "mt-1 border-t border-(--t-border-line) pt-4"
        )}
      >
        <div
          className={
            inlineSuggestion
              ? "flex flex-wrap items-center gap-3"
              : "ml-auto flex items-center gap-3"
          }
        >
          <span
            id={counterId}
            className={
              inlineSuggestion ? "sr-only" : "text-xs text-(--t-ink-dim)"
            }
          >
            {formatter.number(body.length)} / {formatter.number(20000)}
          </span>
          <button
            type="submit"
            disabled={
              busy ||
              uploading ||
              wrongSubject ||
              images.some((image) => !image.altText.trim()) ||
              !body.trim() ||
              (!threadId && !title.trim())
            }
            aria-busy={busy}
            className={cn(
              primaryCtaSm,
              "min-h-11 w-fit cursor-pointer justify-center disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {busy
              ? t("sending")
              : t(inlineSuggestion ? "inlinePostReply" : "submit")}
          </button>
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
