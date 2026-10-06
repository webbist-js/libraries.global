"use client"

import {
  EVENT_PROVIDERS,
  FEED_TEST_BLOCKING,
  FEED_TEST_COPY,
  validateFeedValues,
} from "@repo/shared-data"
import { useRouter } from "next/navigation"
import type React from "react"
import { useRef, useState } from "react"

import { Notice } from "@/components/ds/Notice"
import { T } from "@/lib/design-tokens"

import { isFeedTestCode } from "./feed-copy"
import { FeedValuesFields } from "./FeedValuesFields"
import type { FeedView } from "./types"
import { useFeedTest } from "./useFeedTest"

const primaryPillSx: React.CSSProperties = {
  fontFamily: T.font.sans,
  fontSize: "14px",
  fontWeight: 600,
}

const secondaryPillSx: React.CSSProperties = {
  fontFamily: T.font.sans,
  fontSize: "14px",
  fontWeight: 600,
  color: T.ink.base,
  background: T.bg.deep,
  border: `1px solid ${T.border.hi}`,
  borderRadius: "999px",
  padding: "10px 20px",
  cursor: "pointer",
}

/** Replace a connected feed's details. The current values keep working. */
export function ReplaceFeedForm({
  feed,
  libraryName,
}: {
  readonly feed: FeedView
  readonly libraryName: string
}) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>({})
  const [localError, setLocalError] = useState<string | null>(null)
  const [errorField, setErrorField] = useState<string | undefined>(undefined)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const test = useFeedTest()
  const fieldsRef = useRef<HTMLDivElement>(null)
  const providerDef = EVENT_PROVIDERS[feed.provider]

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
      libraryDocumentId: feed.documentId,
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
        setSent(true)
        router.refresh()

        return
      }
      const result: unknown = json?.error?.result
      if (res.status === 422 && isFeedTestCode(result))
        setSendError(FEED_TEST_COPY[result] ?? json.error.message)
      else setSendError(json?.error?.message ?? "That didn't work. Try again.")
    } catch {
      setSendError("That didn't work. Check your connection.")
    } finally {
      setSending(false)
    }
  }

  const canSend = test.result !== null && !FEED_TEST_BLOCKING.has(test.result)

  if (sent)
    return (
      <Notice
        icon="mdi:check-circle-outline"
        tone="ok"
        title="New details sent for review"
      >
        <p className="m-0">
          Your current details keep working until a moderator approves the new
          ones.
        </p>
      </Notice>
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
          fontSize: "15px",
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

      <div aria-live="polite">
        {test.error && (
          <p role="alert" style={{ color: T.accent.danger, margin: 0 }}>
            {test.error}
          </p>
        )}
        {test.result && (
          <Notice
            icon={
              test.result === "ok"
                ? "mdi:check-circle-outline"
                : "mdi:alert-circle-outline"
            }
            tone={test.result === "ok" ? "ok" : "warn"}
            title="Test result"
          >
            <p className="m-0">{FEED_TEST_COPY[test.result]}</p>
          </Notice>
        )}
      </div>

      {sendError && (
        <p role="alert" style={{ color: T.accent.danger, margin: 0 }}>
          {sendError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          style={secondaryPillSx}
          disabled={test.busy}
          onClick={runTest}
        >
          {test.busy ? "Testing…" : "Test connection"}
        </button>
        <button
          type="button"
          className="rounded-full bg-(--t-accent-primary) px-6 py-2.5 text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-50"
          style={primaryPillSx}
          disabled={!canSend || sending}
          onClick={send}
        >
          {sending ? "Sending…" : "Send for review"}
        </button>
      </div>
    </form>
  )
}
