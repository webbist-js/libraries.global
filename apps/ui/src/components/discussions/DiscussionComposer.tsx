"use client"

import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import { Link } from "@/lib/navigation"

import {
  discussionErrorKey,
  discussionRequest,
  type DiscussionRecord,
  type DiscussionTarget,
  type Subject,
} from "./api"

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
}: {
  subject?: Subject
  threadId?: string
  target?: DiscussionTarget
  language?: string
  initialTitle?: string
  parentId?: string | null
  signedIn: boolean
  disabled?: boolean
  onSubmitted: (record?: DiscussionRecord) => void
}) {
  const t = useTranslations("discussions")
  const locale = useLocale()
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState("")
  const [language, setLanguage] = useState(initialLanguage ?? locale)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  if (!signedIn)
    return (
      <p>
        <Link
          href={`/auth/signin?callbackUrl=${encodeURIComponent("/community/discussions")}`}
        >
          {t("signIn")}
        </Link>
      </p>
    )
  if (disabled) return <p role="status">{t("locked")}</p>
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy || !body.trim() || (!threadId && (!subject || !title.trim())))
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
      className="grid gap-3 rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) p-5"
    >
      <h3 className="m-0 text-lg font-semibold">
        {threadId ? t("reply") : t("newThread")}
      </h3>
      {!threadId && (
        <label>
          {t("threadTitle")}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
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
          onChange={(event) => setLanguage(event.target.value)}
          maxLength={35}
          readOnly={Boolean(target)}
          required
          list="discussion-languages"
          className="mt-1 w-full rounded-lg border border-(--t-border-line) p-2"
        />
      </label>
      <datalist id="discussion-languages">
        {(subject?.languages?.length
          ? subject.languages
          : ["en", "fr", "cs"]
        ).map((code) => (
          <option key={code} value={code} />
        ))}
      </datalist>
      <label>
        {t("body")}
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={20000}
          required
          rows={6}
          className="mt-1 w-full rounded-lg border border-(--t-border-line) p-3"
        />
      </label>
      <p className="m-0 text-sm text-(--t-ink-dim)">{t("reviewLead")}</p>
      <button
        type="submit"
        disabled={busy || !body.trim() || (!threadId && !title.trim())}
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
