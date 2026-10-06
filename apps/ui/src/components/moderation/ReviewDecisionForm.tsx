"use client"

import { Icon } from "@iconify/react"
import { useId, useState } from "react"

import { T } from "@/lib/design-tokens"
import { useRouter } from "@/lib/navigation"

import { decisionErrorMessage, statusMeta } from "./submissionMeta"

type Decision = "approved" | "rejected" | "needs_info"

const OPEN = new Set(["pending", "needs_info"])
const MAX_NOTE = 2000

/** The primary Approve button's label for a type that reads differently. */
const APPROVE_LABEL: Record<string, string> = {
  event_feed: "Approve and activate",
}

const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-full bg-(--t-accent-primary) px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
const SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-5 py-2.5 text-[15px] font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-60"

/**
 * The decision on one submission: a note (required for Needs changes and
 * Reject, shown to the contributor), then Approve, Approve and publish
 * (when Strapi says it applies, after a confirmation), Needs changes or
 * Reject. Strapi re-checks scope, self-review and the note; its refusals
 * appear inline. On success the page reloads its data.
 */
export function ReviewDecisionForm({
  documentId,
  status,
  submissionType,
  canPublish,
  reviewedAt,
}: {
  readonly documentId: string
  readonly status: string
  readonly submissionType?: string
  readonly canPublish: boolean
  readonly reviewedAt?: string | null
}) {
  const router = useRouter()
  const noteId = useId()
  const hintId = useId()
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Decision | "publish" | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  if (!OPEN.has(status)) {
    const meta = statusMeta(status)

    // The live region stays mounted across router.refresh(), so the
    // decision just made ("Approved.") is still announced here.
    return (
      <div className="flex flex-col gap-2">
        <p
          aria-live="polite"
          className="m-0 text-[14px]"
          style={{ color: T.accent.ok }}
        >
          {done}
        </p>
        <p
          className="m-0 text-[15px] leading-[1.55]"
          style={{ color: T.ink.dim }}
        >
          {`This submission is ${meta.label.toLowerCase()}${reviewedAt ? ` (${new Date(reviewedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })})` : ""}; decisions are final.`}
        </p>
      </div>
    )
  }

  async function decide(decision: Decision, publish = false) {
    const text = note.trim()
    if (decision !== "approved" && !text) {
      setError(
        "Write a note first: the contributor sees it and needs to know what to change."
      )

      return
    }
    setError(null)
    setBusy(publish ? "publish" : decision)
    try {
      const res = await fetch(
        `/api/moderation/submissions/${encodeURIComponent(documentId)}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: decision,
            ...(text ? { note: text } : {}),
            ...(publish ? { publish: true } : {}),
          }),
        }
      )
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        setError(decisionErrorMessage(res.status, body))

        return
      }
      setConfirming(false)
      setNote("")
      setDone(
        decision === "approved"
          ? publish
            ? "Approved and published."
            : "Approved."
          : decision === "rejected"
            ? "Rejected. The contributor will see your note."
            : "Sent back for changes. The contributor will see your note."
      )
      router.refresh()
    } catch {
      setError("Something went wrong. Check your connection and try again.")
    } finally {
      setBusy(null)
    }
  }

  const disabled = busy !== null
  const approveLabel = APPROVE_LABEL[submissionType ?? ""] ?? "Approve"

  return (
    <form
      className="flex flex-col gap-4"
      aria-label="Decision"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={noteId}
          className="text-[15px] font-semibold"
          style={{ color: T.ink.base }}
        >
          Note to the contributor
        </label>
        <p
          id={hintId}
          className="m-0 text-[14px] leading-normal"
          style={{ color: T.ink.dim }}
        >
          Required for Needs changes and Reject. Say what was wrong and what
          would be accepted.
        </p>
        <textarea
          id={noteId}
          aria-describedby={hintId}
          value={note}
          maxLength={MAX_NOTE}
          rows={5}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-[14px] border px-3.5 py-2.5 text-[15px] leading-normal"
          style={{
            borderColor: T.border.hi,
            background: T.bg.deep,
            color: T.ink.base,
            fontFamily: T.font.sans,
            resize: "vertical",
          }}
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="m-0 flex items-start gap-2 rounded-[14px] px-3.5 py-2.5 text-[14px] leading-normal"
          style={{ background: "#F6E3DA", color: T.accent.danger }}
        >
          <Icon
            aria-hidden="true"
            icon="mdi:alert-circle-outline"
            width={18}
            height={18}
            className="mt-0.5 shrink-0"
          />
          {error}
        </p>
      ) : null}
      <p
        aria-live="polite"
        className="m-0 text-[14px]"
        style={{ color: T.accent.ok }}
      >
        {done}
      </p>

      {confirming ? (
        <div
          className="flex flex-col gap-3 rounded-[14px] px-4 py-3"
          style={{
            background: T.accent.chip,
            border: `1px solid ${T.border.line}`,
          }}
        >
          <p
            className="m-0 text-[14px] leading-[1.55]"
            style={{ color: T.ink.base }}
          >
            Approving and publishing puts this live: readers see it straight
            away. Check it reads well before you confirm.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={PRIMARY}
              disabled={disabled}
              onClick={() => void decide("approved", true)}
            >
              {busy === "publish" ? "Publishing…" : "Confirm and publish"}
            </button>
            <button
              type="button"
              className={SECONDARY}
              style={{ color: T.ink.base }}
              disabled={disabled}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={PRIMARY}
          disabled={disabled}
          onClick={() => void decide("approved")}
        >
          <Icon aria-hidden="true" icon="mdi:check" width={18} height={18} />
          {busy === "approved" ? "Approving…" : approveLabel}
        </button>
        {canPublish ? (
          <button
            type="button"
            className={SECONDARY}
            style={{ color: T.accent.primary }}
            disabled={disabled}
            aria-expanded={confirming}
            onClick={() => {
              setError(null)
              setConfirming(true)
            }}
          >
            <Icon
              aria-hidden="true"
              icon="mdi:publish"
              width={18}
              height={18}
            />
            Approve and publish
          </button>
        ) : null}
        <button
          type="button"
          className={SECONDARY}
          style={{ color: T.ink.base }}
          disabled={disabled}
          onClick={() => void decide("needs_info")}
        >
          <Icon
            aria-hidden="true"
            icon="mdi:message-alert-outline"
            width={18}
            height={18}
          />
          {busy === "needs_info" ? "Sending…" : "Needs changes"}
        </button>
        <button
          type="button"
          className={SECONDARY}
          style={{ color: T.accent.danger }}
          disabled={disabled}
          onClick={() => void decide("rejected")}
        >
          <Icon aria-hidden="true" icon="mdi:close" width={18} height={18} />
          {busy === "rejected" ? "Rejecting…" : "Reject"}
        </button>
      </div>
    </form>
  )
}
