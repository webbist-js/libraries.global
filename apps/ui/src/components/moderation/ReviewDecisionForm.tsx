"use client"

import {
  AlertCircle,
  MessageSquareText,
  ShieldCheck,
  ShieldX,
  Upload,
} from "lucide-react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useId, useState } from "react"

import { reviewHref } from "@/components/moderation/queue-navigation"
import { T } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"

import { decisionErrorMessage, statusMeta } from "./submissionMeta"

type Decision = "approved" | "rejected" | "needs_info"

/** The next pending submission in the same Drive, once found. */
type NextInDrive = { documentId: string; href: string } | "none" | null

const OPEN = new Set(["pending", "needs_info"])
const MAX_NOTE = 2000

/** The primary Approve button's label for a type that reads differently. */
const APPROVE_LABEL: Record<string, string> = {
  event_feed: "Approve and activate",
}

const PRIMARY =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#21704d] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
const SECONDARY =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-60"

/**
 * The decision on one submission: a note (required for Needs changes and
 * Reject, shown to the contributor), then Approve, Approve and publish
 * (when Strapi says it applies, after a confirmation), Needs changes or
 * Reject. Strapi re-checks scope, self-review and the note; its refusals
 * appear inline. On success the page reloads its data.
 */
export function ReviewDecisionForm({
  documentId,
  approvedLibraryIds,
  approvedStaffRole,
  requireApprovalNote = false,
  approvalBlockedReason,
  status,
  submissionType,
  canPublish,
  canApprove = true,
  reviewedAt,
  driveDocumentId,
  returnTo,
}: {
  readonly approvedStaffRole?: "editor" | "owner"
  readonly approvedLibraryIds?: string[]
  readonly approvalBlockedReason?: string
  readonly requireApprovalNote?: boolean
  readonly documentId: string
  readonly status: string
  readonly submissionType?: string
  readonly canPublish: boolean
  readonly canApprove?: boolean
  readonly reviewedAt?: string | null
  /** The Drive this submission is tagged with, when there is one. */
  readonly driveDocumentId?: string | null
  readonly returnTo?: string
}) {
  const tUi = useUiTranslations("ui")

  const router = useRouter()
  const noteId = useId()
  const hintId = useId()
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Decision | "publish" | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [nextInDrive, setNextInDrive] = useState<NextInDrive>(null)

  // Once a decision has been made here, look for the next pending
  // submission in the same Drive, so the Moderator can keep moving
  // through it without going back to the queue.
  useEffect(() => {
    if (!done || !driveDocumentId) return
    let cancelled = false
    fetch(
      `/api/moderation/submissions?category=libraries&drive=${encodeURIComponent(driveDocumentId)}&status=pending&pageSize=2`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: { documentId: string }[] } | null) => {
        if (cancelled) return
        const list = Array.isArray(j?.data) ? j.data : []
        const next = list.find((r) => r.documentId !== documentId)
        setNextInDrive(
          next
            ? {
                documentId: next.documentId,
                href: reviewHref(next.documentId, returnTo),
              }
            : "none"
        )
      })
      .catch(() => {
        if (!cancelled) setNextInDrive("none")
      })

    return () => {
      cancelled = true
    }
  }, [done, driveDocumentId, documentId, returnTo])

  const nextInDriveBlock = (
    <NextInDriveStatus show={!!done && !!driveDocumentId} next={nextInDrive} />
  )

  if (!OPEN.has(status)) {
    const meta = statusMeta(status)

    // The live region stays mounted across router.refresh(), so the
    // decision just made ("Approved.") is still announced here.
    return (
      <div className="flex flex-col gap-2">
        <p
          aria-live="polite"
          className="m-0 text-sm"
          style={{ color: T.accent.ok }}
        >
          {done}
        </p>
        <p
          className="m-0 text-base leading-[1.55]"
          style={{ color: T.ink.dim }}
        >
          {`This submission is ${meta.label.toLowerCase()}${reviewedAt ? ` (${new Date(reviewedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })})` : ""}; decisions are final.`}
        </p>
        {nextInDriveBlock}
      </div>
    )
  }

  async function decide(decision: Decision, publish = false) {
    if (!canApprove && decision !== "rejected") {
      setError(
        approvalBlockedReason ??
          "This timetable changed after the suggestion. Decline it so a new suggestion can be made."
      )

      return
    }
    const text = note.trim()
    if ((decision !== "approved" || requireApprovalNote) && !text) {
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
          body: JSON.stringify(
            decisionBody(
              decision,
              text,
              publish,
              approvedLibraryIds,
              approvedStaffRole
            )
          ),
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
      aria-label={tUi("decision")}
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={noteId}
          className="text-base font-semibold"
          style={{ color: T.ink.base }}
        >
          Note to the contributor
        </label>
        <p
          id={hintId}
          className="m-0 text-sm leading-normal"
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
          className="w-full rounded-[16px] border px-3.5 py-3 text-base leading-relaxed focus-visible:outline-2 focus-visible:outline-(--t-accent-primary)"
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
          className="m-0 flex items-start gap-2 rounded-[14px] px-3.5 py-2.5 text-sm leading-normal"
          style={{ background: "#F6E3DA", color: T.accent.danger }}
        >
          <AlertCircle size={18} aria-hidden className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
      <p
        aria-live="polite"
        className="m-0 text-sm"
        style={{ color: T.accent.ok }}
      >
        {done}
      </p>
      {nextInDriveBlock}

      {confirming ? (
        <div
          className="flex flex-col gap-3 rounded-[14px] px-4 py-3"
          style={{
            background: T.accent.chip,
            border: `1px solid ${T.border.line}`,
          }}
        >
          <p
            className="m-0 text-sm leading-[1.55]"
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
              {tUi("cancel")}{" "}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={PRIMARY}
          disabled={disabled || !canApprove}
          onClick={() => void decide("approved")}
        >
          <ShieldCheck size={18} aria-hidden />
          {busy === "approved" ? "Approving…" : approveLabel}
        </button>
        {canPublish && canApprove ? (
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
            <Upload size={18} aria-hidden />
            Approve and publish
          </button>
        ) : null}
        <button
          type="button"
          className={SECONDARY}
          style={{ color: T.ink.base }}
          disabled={disabled || !canApprove}
          onClick={() => void decide("needs_info")}
        >
          <MessageSquareText size={18} aria-hidden />
          {busy === "needs_info" ? tUi("sending") : "Needs changes"}
        </button>
        <button
          type="button"
          className={SECONDARY}
          style={{ color: T.accent.danger }}
          disabled={disabled}
          onClick={() => void decide("rejected")}
        >
          <ShieldX size={18} aria-hidden />
          {busy === "rejected" ? "Rejecting…" : "Reject"}
        </button>
      </div>
    </form>
  )
}

function NextInDriveStatus({
  show,
  next,
}: {
  readonly show: boolean
  readonly next: NextInDrive
}) {
  if (!show) return null

  return (
    <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
      {next === "none" ? (
        "No more in this drive."
      ) : next ? (
        <Link
          href={next.href}
          className="font-semibold underline-offset-2 hover:underline"
          style={{ color: T.accent.primary }}
        >
          Next in this drive →
        </Link>
      ) : (
        "Checking the drive…"
      )}
    </p>
  )
}
function decisionBody(
  status: Decision,
  note: string,
  publish: boolean,
  approvedLibraryIds?: string[],
  approvedStaffRole?: "editor" | "owner"
) {
  return {
    status,
    ...(note ? { note } : {}),
    ...(publish ? { publish: true } : {}),
    ...(approvedLibraryIds ? { approvedLibraryIds } : {}),
    ...(approvedStaffRole ? { approvedStaffRole } : {}),
  }
}
