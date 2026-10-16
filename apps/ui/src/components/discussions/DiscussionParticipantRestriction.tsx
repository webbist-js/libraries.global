"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  discussionAuthor,
  discussionErrorKey,
  discussionRequest,
  type DiscussionRecord,
} from "./api"

export function DiscussionParticipantRestriction({
  record,
  kind,
  onReload,
}: {
  record: DiscussionRecord
  kind: "thread" | "reply"
  onReload: () => Promise<void>
}) {
  const t = useTranslations("discussions")
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState("mute")
  const [scope, setScope] = useState("subject")
  const [reason, setReason] = useState("")
  const [feedback, setFeedback] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      !event.currentTarget.reportValidity() ||
      !reason.trim() ||
      !feedback.trim()
    )
      return
    // Native date controls may commit their change event only on blur. Capture
    // the displayed field before state updates can restore its previous value.
    const submittedExpiry = new FormData(event.currentTarget).get("expiresAt")
    const expiry =
      typeof submittedExpiry === "string" ? submittedExpiry.trim() : ""
    const deadline = expiry ? new Date(expiry) : null
    if (deadline && !Number.isFinite(deadline.getTime())) {
      setError(t("invalidInput"))

      return
    }
    setExpiresAt(expiry)
    setBusy(true)
    setError("")
    try {
      await discussionRequest(
        `moderation/records/${kind}/${encodeURIComponent(record.id)}/sanctions`,
        "POST",
        {
          mode,
          scope,
          reason: reason.trim(),
          contributorFeedback: feedback.trim(),
          ...(deadline ? { expiresAt: deadline.toISOString() } : {}),
        }
      )
      await onReload()
      setOpen(false)
    } catch (failure) {
      setError(t(discussionErrorKey(failure)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="text-sm underline"
        onClick={() => setOpen(true)}
      >
        {t("restrictParticipant")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl bg-(--t-bg-deep)">
          <DialogTitle>
            {t("restrictParticipant")} ·{" "}
            {discussionAuthor(record.author, t("member")).name}
          </DialogTitle>
          <DialogDescription>{t("restrictionLead")}</DialogDescription>
          <form onSubmit={send} className="grid gap-3">
            <label>
              {t("restrictionMode")}
              <select
                className="mt-1 w-full rounded-xl border bg-transparent p-3"
                value={mode}
                onChange={(event) => setMode(event.target.value)}
              >
                <option value="mute">{t("discussionMute")}</option>
                <option value="ban">{t("discussionBan")}</option>
              </select>
            </label>
            <label>
              {t("restrictionScope")}
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value)}
                className="mt-1 w-full rounded-xl border bg-transparent p-3"
              >
                <option value="subject">{t("thisSubject")}</option>
                <option value="all">{t("allDiscussions")}</option>
              </select>
            </label>
            <label>
              {t("restrictionReason")}
              <textarea
                required
                maxLength={2000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <label>
              {t("authorFeedback")}
              <textarea
                required
                maxLength={2000}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <label>
              {t("restrictionExpiry")}
              <input
                name="expiresAt"
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                className="mt-1 w-full rounded-xl border p-3"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !reason.trim() || !feedback.trim()}
              className="justify-self-start rounded-full bg-(--t-palette-coral-fg) px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {t("confirmRestriction")}
            </button>
            {error && <p role="alert">{error}</p>}
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
