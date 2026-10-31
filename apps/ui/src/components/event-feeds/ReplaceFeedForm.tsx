"use client"

import {
  EVENT_PROVIDERS,
  FEED_TEST_BLOCKING,
  FEED_TEST_COPY,
  validateFeedValues,
} from "@repo/shared-data"
import { useRouter } from "next/navigation"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import { Notice } from "@/components/ds/Notice"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import { staffLibraryHref } from "@/lib/staff/paths"

import { isFeedTestCode } from "./feed-copy"
import {
  PRIMARY_PILL,
  SECONDARY_PILL,
  secondaryPillStyle,
  TOO_MANY_REQUESTS,
} from "./feed-ui"
import { FeedTestFeedback } from "./FeedTestFeedback"
import { FeedValuesFields } from "./FeedValuesFields"
import type { FeedView } from "./types"
import { useFeedTest } from "./useFeedTest"

/** Replace a connected feed's details. The current values keep working. */
export function ReplaceFeedForm({
  feed,
  libraryName,
  libraryDocumentId,
  librarySlug,
}: {
  readonly feed: FeedView
  readonly libraryName: string
  readonly libraryDocumentId: string
  readonly librarySlug: string
}) {
  const tUi = useUiTranslations("ui")

  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>({})
  const [localError, setLocalError] = useState<string | null>(null)
  const [errorField, setErrorField] = useState<string | undefined>(undefined)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const test = useFeedTest()
  const fieldsRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLDivElement>(null)
  const providerDef = EVENT_PROVIDERS[feed.provider]
  // The form goes away on success: move focus to the confirmation.
  useEffect(() => {
    if (sent) doneRef.current?.focus()
  }, [sent])

  function onValuesChange(next: Record<string, string>) {
    setValues(next)
    setLocalError(null)
    setErrorField(undefined)
    test.reset()
  }

  async function runTest() {
    const check = validateFeedValues(feed.provider, values)
    if (!check.ok) {
      setLocalError(check.error)
      setErrorField(check.field)
      fieldsRef.current
        ?.querySelector<HTMLInputElement>(
          check.field ? `[name="${check.field}"]` : "input"
        )
        ?.focus()

      return
    }
    setLocalError(null)
    setErrorField(undefined)
    await test.run("/api/contribute/event-feeds/test", {
      libraryDocumentId,
      provider: feed.provider,
      values,
    })
  }

  async function send() {
    setSendError(null)
    setSending(true)
    try {
      const res = await fetch(
        `/api/contribute/event-feeds/${feed.documentId}/values`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values }),
        }
      )
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setValues({})
        setSent(true)
        router.refresh()

        return
      }
      const result: unknown = json?.error?.result
      if (res.status === 429) setSendError(TOO_MANY_REQUESTS)
      else if (res.status === 422 && isFeedTestCode(result))
        setSendError(FEED_TEST_COPY[result] ?? json.error.message)
      else setSendError(json?.error?.message ?? "That didn’t work. Try again.")
    } catch {
      setSendError("That didn’t work. Check your connection.")
    } finally {
      setSending(false)
    }
  }

  const canSend = test.result !== null && !FEED_TEST_BLOCKING.has(test.result)

  if (sent)
    return (
      <div ref={doneRef} tabIndex={-1} className="outline-none">
        <Notice
          icon="mdi:check-circle-outline"
          tone="ok"
          title={tUi("new_details_sent_for_review")}
        >
          <p className="m-0">
            Your current details keep working until a moderator approves the new
            ones.
          </p>
          <p className="m-0 mt-2">
            <GlobalLink
              href={staffLibraryHref(librarySlug, "/events")}
              className={SECONDARY_PILL}
              style={secondaryPillStyle}
            >
              Back to event feeds
            </GlobalLink>
          </p>
        </Notice>
      </div>
    )

  return (
    <form
      className="flex flex-col gap-5 p-5 sm:p-8"
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "20px",
        background: T.bg.deep,
      }}
      onSubmit={(e) => e.preventDefault()}
    >
      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "var(--type-body-size)",
          color: T.ink.dim,
          margin: 0,
        }}
      >
        Replacing the {providerDef.label} feed for {libraryName}. Your current
        details keep working until a moderator approves the new ones.
      </p>

      <div ref={fieldsRef}>
        <FeedValuesFields
          provider={feed.provider}
          values={values}
          onChange={onValuesChange}
          currentHints={feed.hints}
          errorField={errorField}
        />
      </div>

      {localError && (
        <p role="alert" style={{ color: T.accent.danger, margin: 0 }}>
          {localError}
        </p>
      )}

      <FeedTestFeedback error={test.error} result={test.result} />

      {sendError && (
        <p role="alert" style={{ color: T.accent.danger, margin: 0 }}>
          {sendError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={SECONDARY_PILL}
          style={secondaryPillStyle}
          disabled={test.busy}
          onClick={runTest}
        >
          {test.busy ? "Testing…" : "Test connection"}
        </button>
        <button
          type="button"
          className={PRIMARY_PILL}
          aria-describedby={canSend ? undefined : "replace-feed-hint"}
          disabled={!canSend || sending}
          onClick={send}
        >
          {sending ? tUi("sending") : "Send for review"}
        </button>
        {!canSend ? (
          <span
            id="replace-feed-hint"
            className="text-sm"
            style={{ color: T.ink.dim }}
          >
            Test the connection first.
          </span>
        ) : null}
      </div>
    </form>
  )
}
