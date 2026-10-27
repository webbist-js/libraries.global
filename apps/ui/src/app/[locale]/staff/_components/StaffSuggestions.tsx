"use client"

import { Icon } from "@iconify/react"
import {
  DECLINE_REASONS,
  DECLINE_REASON_LABELS,
  timetableHash,
  type DeclineReason,
  type MobileTimetable,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations, useLocale } from "next-intl"
import { useEffect, useState } from "react"

import { DiffCard, EmptyState, Sheet } from "@/components/ds"
import { TimetableReviewPanel } from "@/components/moderation/TimetableReviewPanel"
import { Button, buttonVariants } from "@/components/ui/button"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { timeAgo } from "@/lib/staff/format"

type Suggestion = {
  documentId: string
  kind: string
  rows: { field: string; label: string; now: string; suggested: string }[]
  evidence: string | null
  byName: string | null
  createdAt: string
  actions: ("approve" | "done" | "reject")[]
  timetable?: {
    before: MobileTimetable | null
    after: MobileTimetable | null
    stale: boolean
  }
}
type Decided = { action: "approve" | "done" | "reject"; at: Date }

const PAGE_SIZE = 20

/** "Opening hours · Tuesday" style title from the changed rows. */
function titleOf(s: Suggestion): string {
  if (s.kind === "freetext") return "Something else"
  const labels = s.rows
    .filter((row) => row.field !== "mobileTimetable")
    .map((row) => row.label)
  if (s.timetable) labels.unshift("Timetable")
  if (!labels.length) return "Suggested change"
  if (labels.length === 1) return labels[0]!
  if (labels.length === 2) return `${labels[0]} · ${labels[1]}`

  return `${labels[0]} · ${labels.length - 1} more fields`
}

/**
 * The Overview's "Suggested changes" card: every pending suggestion for
 * this library as a DiffCard, decided in place. A decision leaves a
 * status line in the card's place so the staff member sees what happened.
 */
export function StaffSuggestions({
  libraryDocumentId,
  publicPath,
}: {
  libraryDocumentId: string
  /** The library's public page, linked after a change is published. */
  publicPath?: string
}) {
  const tUi = useUiTranslations("ui")

  const locale = useLocale()
  const [data, setData] = useState<Suggestion[]>([]),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [listError, setListError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [announce, setAnnounce] = useState(""),
    [declining, setDeclining] = useState<string | null>(null),
    [reason, setReason] = useState<DeclineReason>("not_accurate"),
    [note, setNote] = useState(""),
    [decided, setDecided] = useState<Record<string, Decided>>({})
  useEffect(() => {
    const controller = new AbortController()
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    })
    setListError("")
    fetch(`/api/staff/${libraryDocumentId}/suggestions?${query}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const value = await r.json().catch(() => ({}))
        if (!r.ok)
          throw new Error(
            r.status === 429
              ? "Too many requests in a short time. Wait a moment, then try again."
              : (value.error?.message ?? "Suggestions are unavailable.")
          )
        setData(value.data)
        setTotal(value.meta.total)
        setLoaded(true)
      })
      .catch((e) => {
        if (e.name !== "AbortError") setListError(e.message)
      })

    return () => controller.abort()
  }, [libraryDocumentId, page, attempt])
  async function decide(id: string, action: "approve" | "done" | "reject") {
    setBusy(true)
    setError("")
    try {
      const r = await fetch(`/api/staff/submissions/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "reject" ? { reason, note } : {}),
        }),
      })
      const value = await r.json().catch(() => ({}))
      if (!r.ok)
        throw new Error(
          r.status === 429
            ? "Too many decisions in a short time. Wait a moment, then try again."
            : (value.error?.message ?? "This suggestion could not be decided.")
        )
      setDecided((all) => ({ ...all, [id]: { action, at: new Date() } }))
      setTotal((n) => Math.max(0, n - 1))
      setDeclining(null)
      setNote("")
      setAnnounce(
        action === "reject"
          ? "Suggestion declined. The contributor has been told."
          : action === "done"
            ? "Suggestion marked as done."
            : "Suggestion accepted and published."
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.")
    } finally {
      setBusy(false)
    }
  }
  const time = (date: Date) =>
    new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <section
      id="suggestions"
      aria-labelledby="staff-suggestions-heading"
      className="rounded-[28px] border p-5 sm:p-8"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <div className="mb-5">
        <h2 id="staff-suggestions-heading" className="type-h2 m-0">
          Suggested changes
          {total > 0 ? (
            <span
              className="ml-2 inline-flex min-w-7 items-center justify-center rounded-full px-2 align-middle text-sm font-bold tabular-nums"
              style={{ background: T.accent.chip, color: T.accent.primary }}
            >
              {total}
              <span className="sr-only"> waiting</span>
            </span>
          ) : null}
        </h2>
        <p className="m-0 mt-2 text-base" style={{ color: T.ink.dim }}>
          From the community. As staff, your decision publishes straight away.
        </p>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      {error && (
        <p
          role="alert"
          className="mb-4 flex items-start gap-2 text-sm"
          style={{ color: T.accent.danger }}
        >
          <Icon
            aria-hidden="true"
            icon="mdi:alert-circle-outline"
            width={18}
            className="shrink-0"
          />
          {error}
        </p>
      )}
      {listError && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center gap-3 rounded-[16px] px-4 py-3 text-sm"
          style={{ background: T.bg.surface, color: T.ink.base }}
        >
          <Icon
            aria-hidden="true"
            icon="mdi:alert-circle-outline"
            width={18}
            className="shrink-0"
            style={{ color: T.accent.danger }}
          />
          <span className="min-w-0 flex-1">{listError}</span>
          <Button
            type="button"
            variant="surface"
            size="pill"
            style={{ borderColor: T.border.hi, color: T.ink.base }}
            onClick={() => setAttempt((n) => n + 1)}
          >
            {tUi("try_again")}{" "}
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-4">
        {data.map((s) => {
          const outcome = decided[s.documentId]
          const who = s.byName ?? "A contributor"

          return (
            <div key={s.documentId} className="flex flex-col gap-4">
              {s.timetable && !outcome && (
                <TimetableReviewPanel
                  before={s.timetable.before}
                  after={s.timetable.after}
                  previousHash={
                    s.timetable.stale
                      ? "stale"
                      : timetableHash(s.timetable.before)
                  }
                />
              )}
              <DiffCard
                title={titleOf(s)}
                rows={s.rows.filter((row) => row.field !== "mobileTimetable")}
                evidence={s.evidence}
                byline={`${who} · ${timeAgo(s.createdAt)}`}
                footer={
                  outcome ? (
                    <>
                      <Icon
                        aria-hidden="true"
                        icon={
                          outcome.action === "reject"
                            ? "mdi:close-circle-outline"
                            : "mdi:check-circle-outline"
                        }
                        width={18}
                        className="mt-0.5 shrink-0"
                        style={{
                          color:
                            outcome.action === "reject"
                              ? T.ink.dim
                              : T.accent.ok,
                        }}
                      />
                      <span>
                        {outcome.action === "reject"
                          ? `Declined: ${titleOf(s)} · ${time(outcome.at)}. ${who} has been told.`
                          : outcome.action === "done"
                            ? `Marked as done: ${titleOf(s)} · ${time(outcome.at)}. Credited to ${who}.`
                            : `Published: ${titleOf(s)} · ${time(outcome.at)}. Credited to ${who}.`}
                        {outcome.action !== "reject" && publicPath ? (
                          <>
                            {" "}
                            <Link
                              href={publicPath}
                              className="inline-flex items-center gap-0.5 font-semibold underline underline-offset-[3px]"
                              style={{ color: T.accent.primary }}
                            >
                              View on the public page
                              <Icon
                                aria-hidden="true"
                                icon="mdi:arrow-top-right"
                                width={14}
                              />
                            </Link>
                          </>
                        ) : null}
                      </span>
                    </>
                  ) : undefined
                }
                actions={s.actions.map((action) => (
                  <Button
                    key={action}
                    type="button"
                    disabled={busy}
                    variant={action === "reject" ? "surface" : "primary"}
                    size="pill"
                    style={
                      action === "reject"
                        ? { borderColor: T.border.hi, color: T.ink.base }
                        : undefined
                    }
                    onClick={() =>
                      action === "reject"
                        ? setDeclining(s.documentId)
                        : decide(s.documentId, action)
                    }
                  >
                    {action === "approve"
                      ? "Accept and publish"
                      : action === "done"
                        ? "Mark as done"
                        : "Decline"}
                  </Button>
                ))}
              />
            </div>
          )
        })}
        {loaded && !data.length && !listError && (
          <EmptyState
            icon="mdi:check-decagram-outline"
            lead={tUi("nothing_waiting_for_review")}
            detail="Suggestions from visitors land here. You decide, and it publishes."
            action={
              publicPath ? (
                <Link
                  href={publicPath}
                  className={buttonVariants({
                    variant: "surface",
                    size: "pill",
                  })}
                  style={{ borderColor: T.border.hi, color: T.ink.base }}
                >
                  {tUi("view_public_page")}{" "}
                  <Icon
                    aria-hidden="true"
                    icon="mdi:arrow-top-right"
                    width={15}
                  />
                </Link>
              ) : undefined
            }
          />
        )}
        {!loaded && !listError && (
          <p
            role="status"
            className="m-0 text-base"
            style={{ color: T.ink.dim }}
          >
            Loading suggestions…
          </p>
        )}
      </div>
      {total > PAGE_SIZE && (
        <nav
          className="mt-5 flex items-center gap-4"
          aria-label={tUi("suggestions_pages")}
        >
          <Button
            type="button"
            variant="surface"
            size="pill"
            style={{ borderColor: T.border.hi, color: T.ink.base }}
            disabled={page === 1}
            onClick={() => setPage((n) => n - 1)}
          >
            {tUi("previous")}{" "}
          </Button>
          <span className="text-sm" style={{ color: T.ink.dim }}>
            Page {page} of {pages}
          </span>
          <Button
            type="button"
            variant="surface"
            size="pill"
            style={{ borderColor: T.border.hi, color: T.ink.base }}
            disabled={page * PAGE_SIZE >= total}
            onClick={() => setPage((n) => n + 1)}
          >
            {tUi("next")}{" "}
          </Button>
        </nav>
      )}
      <Sheet
        open={!!declining}
        onClose={() => !busy && setDeclining(null)}
        side="right"
        title={tUi("decline_this_suggestion")}
        footer={
          <Button
            type="button"
            variant="primary"
            size="pill"
            disabled={busy || (reason === "other" && !note.trim())}
            onClick={() => declining && decide(declining, "reject")}
          >
            Decline suggestion
          </Button>
        }
      >
        <label className="block text-base font-semibold">
          Reason
          <select
            className="my-2 block min-h-11 w-full rounded-[14px] border px-3 py-2 font-normal"
            style={{ borderColor: T.border.hi, background: T.bg.deep }}
            value={reason}
            onChange={(e) => setReason(e.target.value as DeclineReason)}
          >
            {DECLINE_REASONS.map((r) => (
              <option key={r} value={r}>
                {DECLINE_REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-base font-semibold">
          Note {reason === "other" ? "(required)" : tUi("optional")}
          <textarea
            className="mt-2 w-full rounded-[14px] border p-3 font-normal"
            style={{ borderColor: T.border.hi, background: T.bg.deep }}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" style={{ color: T.accent.danger }}>
            {error}
          </p>
        )}
      </Sheet>
    </section>
  )
}
