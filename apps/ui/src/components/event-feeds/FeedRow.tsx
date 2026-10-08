"use client"

import { Icon } from "@iconify/react"
import {
  EVENT_PROVIDERS,
  FEED_TEST_COPY,
  type FeedTestCode,
} from "@repo/shared-data"
import { useRouter } from "next/navigation"
import type React from "react"
import { useRef, useState } from "react"

import { Notice, StatusBadge } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import { staffLibraryHref } from "@/lib/staff/paths"

import { feedStatusOf, syncLine } from "./feed-copy"
import {
  SECONDARY_PILL,
  secondaryPillStyle,
  TOO_MANY_REQUESTS,
} from "./feed-ui"
import type { FeedView } from "./types"

const PROVIDER_ICON: Record<string, string> = {
  eventbrite: "mdi:ticket-confirmation-outline",
  ical: "mdi:calendar-sync-outline",
  ticketsource: "mdi:ticket-outline",
  wegottickets: "mdi:ticket-percent-outline",
  spydus: "mdi:bookshelf",
  solus: "mdi:application-outline",
  aspen: "mdi:compass-outline",
}

const labelSx: React.CSSProperties = {
  fontFamily: T.font.sans,
  fontSize: "12.5px",
  fontWeight: 600,
  color: T.ink.dim,
  margin: 0,
}

const valueSx: React.CSSProperties = {
  fontFamily: T.font.sans,
  fontSize: "14px",
  color: T.ink.base,
  margin: "2px 0 0",
  overflowWrap: "anywhere",
}

/** The one-line error for a failed feed action. */
const failed = (res: Response) =>
  res.status === 429 ? TOO_MANY_REQUESTS : "That didn’t work. Try again."

/** One connected or pending feed, for a library the signed-in user claims. */
export function FeedRow({
  feed,
  libraryDocumentId,
  librarySlug,
  libraryName,
}: {
  readonly feed: FeedView
  readonly libraryDocumentId: string
  /** For the staff page links; the API calls keep the id. */
  readonly librarySlug: string | null
  readonly libraryName: string
}) {
  const router = useRouter()
  const providerDef = EVENT_PROVIDERS[feed.provider]
  const [busy, setBusy] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<FeedTestCode | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  async function post(path: string) {
    setActionError(null)
    setBusy(path)
    try {
      const res = await fetch(
        `/api/contribute/event-feeds/${feed.documentId}${path}`,
        { method: "POST" }
      )
      if (!res.ok) {
        setActionError(failed(res))

        return
      }
      router.refresh()
    } catch {
      setActionError("That didn’t work. Check your connection.")
    } finally {
      setBusy(null)
    }
  }

  async function runTest() {
    setActionError(null)
    setTestResult(null)
    setBusy("test")
    try {
      const res = await fetch(
        `/api/contribute/event-feeds/${feed.documentId}/test`,
        { method: "POST" }
      )
      const json = await res.json().catch(() => null)
      if (res.ok && json?.data?.result) setTestResult(json.data.result)
      else if (res.status === 429) setActionError(TOO_MANY_REQUESTS)
      else setActionError("The test couldn’t run. Try again.")
      router.refresh()
    } catch {
      setActionError("The test couldn’t run. Check your connection.")
    } finally {
      setBusy(null)
    }
  }

  async function withdraw() {
    setActionError(null)
    setBusy("withdraw")
    try {
      const res = await fetch(
        `/api/contribute/event-feeds/${feed.documentId}/pending`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        setActionError(failed(res))

        return
      }
      router.refresh()
    } catch {
      setActionError("That didn’t work. Check your connection.")
    } finally {
      setBusy(null)
    }
  }

  async function disconnect() {
    dialogRef.current?.close()
    setActionError(null)
    setBusy("disconnect")
    try {
      const res = await fetch(
        `/api/contribute/event-feeds/${feed.documentId}`,
        {
          method: "DELETE",
        }
      )
      if (!res.ok) {
        setActionError(failed(res))

        return
      }
      router.refresh()
    } catch {
      setActionError("That didn’t work. Check your connection.")
    } finally {
      setBusy(null)
    }
  }

  // A draft feed awaiting an Eventbrite organisation choice carries a
  // non-string `organizations` hint (see feed-oauth.exchangeEventbrite);
  // that one isn't a provider field and never belongs in this list.
  const hintEntries = Object.entries(feed.hints).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  )

  const status = feedStatusOf(feed)
  const tone =
    status.key === "stopped"
      ? "danger"
      : status.tone === "ok"
        ? "ok"
        : status.tone === "warn"
          ? "warn"
          : "info"

  return (
    <li
      className="flex flex-col gap-3 rounded-[16px] border p-4 sm:p-5"
      style={{ borderColor: T.border.line, background: T.bg.deep }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: T.accent.chip, color: T.accent.primary }}
          >
            <Icon
              icon={PROVIDER_ICON[feed.provider] ?? "mdi:calendar-sync-outline"}
              width={18}
              height={18}
            />
          </span>
          <span className="flex min-w-0 flex-col">
            <span
              style={{
                fontFamily: T.font.sans,
                fontSize: "15.5px",
                fontWeight: 600,
                color: T.ink.base,
              }}
            >
              {providerDef.label}
            </span>
            {feed.managedBy === "admin_group" ? null : (
              <span
                style={{
                  fontFamily: T.font.sans,
                  fontSize: "13.5px",
                  color: T.ink.dim,
                }}
              >
                {syncLine(feed)}
              </span>
            )}
          </span>
          <StatusBadge tone={tone} icon={status.icon}>
            {status.label}
          </StatusBadge>
        </div>
        {feed.managedBy === "admin_group" ? null : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={SECONDARY_PILL}
              style={secondaryPillStyle}
              disabled={busy !== null}
              onClick={runTest}
            >
              {busy === "test" ? "Testing…" : "Test"}
            </button>
            {(feed.status === "active" || feed.status === "paused") &&
              !feed.review && (
                <GlobalLink
                  href={staffLibraryHref(
                    librarySlug,
                    `/events/${feed.documentId}/replace`
                  )}
                  className={SECONDARY_PILL}
                  style={secondaryPillStyle}
                >
                  Replace details
                </GlobalLink>
              )}
            {feed.status === "active" && (
              <button
                type="button"
                className={SECONDARY_PILL}
                style={secondaryPillStyle}
                disabled={busy !== null}
                onClick={() => post("/pause")}
              >
                {busy === "/pause" ? "Pausing…" : "Pause"}
              </button>
            )}
            {feed.status === "paused" && feed.pausedReason === "library" && (
              <button
                type="button"
                className={SECONDARY_PILL}
                style={secondaryPillStyle}
                disabled={busy !== null}
                onClick={() => post("/resume")}
              >
                {busy === "/resume" ? "Resuming…" : "Resume"}
              </button>
            )}
            <button
              type="button"
              className={SECONDARY_PILL}
              style={{ ...secondaryPillStyle, color: T.accent.danger }}
              disabled={busy !== null}
              onClick={() => dialogRef.current?.showModal()}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>

      {feed.managedBy === "admin_group" ? (
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "14px",
            color: T.ink.dim,
            margin: 0,
          }}
        >
          Managed by Libraries Global.
        </p>
      ) : (
        <>
          {hintEntries.length > 0 && (
            <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {hintEntries.map(([key, value]) => {
                const field = providerDef.fields.find((f) => f.key === key)

                return (
                  <div key={key}>
                    <dt style={labelSx}>{field?.label ?? key}</dt>
                    <dd style={valueSx}>{value}</dd>
                  </div>
                )
              })}
            </dl>
          )}

          {feed.lastErrorCode && feed.lastErrorCode !== "ok" && (
            <Notice
              icon="mdi:alert-circle-outline"
              tone="warn"
              title="Sync issue"
            >
              <p className="m-0">{FEED_TEST_COPY[feed.lastErrorCode]}</p>
            </Notice>
          )}

          {feed.review?.status === "needs_info" && feed.review.note && (
            <Notice
              icon="mdi:message-alert-outline"
              tone="warn"
              title="A moderator asked for changes"
            >
              <p className="m-0">{feed.review.note}</p>
            </Notice>
          )}

          {feed.pendingHints && (
            <Notice
              icon="mdi:clock-outline"
              tone="info"
              title="New details waiting for review"
            >
              <button
                type="button"
                className={`${SECONDARY_PILL} mt-2 self-start`}
                style={secondaryPillStyle}
                disabled={busy !== null}
                onClick={withdraw}
              >
                {busy === "withdraw" ? "Withdrawing…" : "Withdraw"}
              </button>
            </Notice>
          )}

          <div aria-live="polite" className="sr-only" role="status">
            {testResult ? FEED_TEST_COPY[testResult] : ""}
          </div>
          {testResult && (
            <Notice
              icon={
                testResult === "ok"
                  ? "mdi:check-circle-outline"
                  : "mdi:alert-circle-outline"
              }
              tone={testResult === "ok" ? "ok" : "warn"}
              title="Test result"
            >
              <p className="m-0">{FEED_TEST_COPY[testResult]}</p>
            </Notice>
          )}

          {actionError && (
            <p role="alert" style={{ color: T.accent.danger, margin: 0 }}>
              {actionError}
            </p>
          )}

          <dialog
            ref={dialogRef}
            aria-labelledby={`disconnect-${feed.documentId}-title`}
            className="m-auto rounded-[20px] p-0 backdrop:bg-(--t-scrim)"
            style={{ border: `1px solid ${T.border.line}`, maxWidth: "440px" }}
          >
            <div className="flex flex-col gap-4 p-6">
              <p
                id={`disconnect-${feed.documentId}-title`}
                style={{
                  fontFamily: T.font.sans,
                  fontSize: "15.5px",
                  color: T.ink.base,
                  margin: 0,
                }}
              >
                <Icon
                  icon="mdi:alert-circle-outline"
                  className="mr-1.5 inline size-5 align-text-bottom"
                  style={{ color: T.accent.danger }}
                  aria-hidden="true"
                />
                Disconnect the {providerDef.label} feed for {libraryName}? Its
                events will be removed from Libraries Global.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className={SECONDARY_PILL}
                  style={secondaryPillStyle}
                  onClick={() => dialogRef.current?.close()}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-full bg-(--t-accent-danger) px-5 text-[14px] font-semibold text-white"
                  onClick={disconnect}
                >
                  Disconnect
                </button>
              </div>
            </div>
          </dialog>
        </>
      )}
    </li>
  )
}
