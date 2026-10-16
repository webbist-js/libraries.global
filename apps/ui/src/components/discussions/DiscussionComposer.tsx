"use client"

import { useLocale, useTranslations } from "next-intl"
import { useId, useState } from "react"

import { Link } from "@/lib/navigation"

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
}: {
  subject?: Subject
  threadId?: string
  target?: DiscussionTarget
  language?: string
  initialTitle?: string
  parentId?: string | null
  signedIn: boolean
  disabled?: boolean
  disabledMessage?: string
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
}) {
  const t = useTranslations("discussions")
  const locale = useLocale()
  const languageListId = useId()
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  const [language, setLanguage] = useState(initialLanguage ?? locale)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [images, setImages] = useState<
    (DiscussionImage & { subjectId?: string })[]
  >([...initialAttachments])
  const [uploading, setUploading] = useState(false)
  const imageSubject = subject?.id ?? subjectId
  const wrongSubject = images.some(
    (image) => image.subjectId && image.subjectId !== imageSubject
  )
  if (!signedIn)
    return (
      <p>
        <Link
          href={`/auth/signin?callbackUrl=${encodeURIComponent(returnTo ?? (threadId ? `/community/discussions/${encodeURIComponent(threadId)}` : "/community/discussions"))}`}
        >
          {t("signIn")}
        </Link>
      </p>
    )
  if (disabled) return <p role="status">{disabledMessage ?? t("locked")}</p>
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

  return (
    <form
      onSubmit={(event) => submit(event)}
      className="grid gap-4 rounded-3xl border-2 border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-6"
    >
      <h3 className="m-0 text-lg font-semibold">
        {threadId ? t("reply") : t("newThread")}
      </h3>
      {!threadId && (
        <label>
          {t("threadTitle")}
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              onDraftChange?.({ title: event.target.value, body, language })
            }}
            maxLength={250}
            required
            className="mt-1 w-full rounded-lg border border-(--t-border-line) p-2"
          />
        </label>
      )}
      <label>
        {t("language")}
        <input
          value={language}
          onChange={(event) => {
            setLanguage(event.target.value)
            onDraftChange?.({ title, body, language: event.target.value })
          }}
          maxLength={35}
          readOnly={Boolean(target)}
          required
          list={languageListId}
          className="mt-1 w-full rounded-lg border border-(--t-border-line) p-2"
        />
      </label>
      <datalist id={languageListId}>
        {(subject?.languages?.length
          ? subject.languages
          : [...new Set([...languages.map((item) => item.code), language])]
        ).map((code) => (
          <option
            key={code}
            value={code}
            label={languages.find((item) => item.code === code)?.name ?? code}
          />
        ))}
      </datalist>
      <label>
        {t("body")}
        <textarea
          value={body}
          onChange={(event) => {
            setBody(event.target.value)
            onDraftChange?.({ title, body: event.target.value, language })
          }}
          maxLength={20000}
          required
          rows={6}
          className="mt-1 w-full rounded-lg border border-(--t-border-line) p-3"
        />
      </label>
      <p className="m-0 text-sm text-(--t-ink-dim)">{t("reviewLead")}</p>
      <DiscussionImageEditor
        subjectId={imageSubject}
        images={images}
        disabled={busy}
        onBusyChange={setUploading}
        onChange={(next) => {
          setImages(next)
          onAttachmentsChange?.(next)
        }}
      />
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
        className="w-fit rounded-full bg-(--t-accent-primary) px-5 py-2 font-semibold text-white disabled:opacity-50"
      >
        {busy ? t("sending") : t("submit")}
      </button>
      {error && (
        <p role="alert" className="m-0">
          {error}
        </p>
      )}
      {sent && (
        <p role="status" className="m-0">
          {t("pendingFeedback")}
        </p>
      )}
    </form>
  )
}
