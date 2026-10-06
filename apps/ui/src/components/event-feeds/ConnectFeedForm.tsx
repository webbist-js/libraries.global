"use client"

import {
  EVENT_PROVIDERS,
  EVENT_PROVIDER_KEYS,
  FEED_TEST_BLOCKING,
  FEED_TEST_COPY,
  type EventProviderKey,
  validateFeedValues,
} from "@repo/shared-data"
import { useRouter } from "next/navigation"
import type React from "react"
import { useRef, useState } from "react"

import {
  fieldInputStyle,
  fieldLabelStyle,
} from "@/app/[locale]/contribute/index/_components/wizard.constants"
import { ChoiceCard } from "@/components/ds/ChoiceCard"
import { Notice } from "@/components/ds/Notice"
import { T } from "@/lib/design-tokens"

import { isFeedTestCode } from "./feed-copy"
import { FeedValuesFields } from "./FeedValuesFields"
import { useFeedTest } from "./useFeedTest"

const PROVIDER_ICON: Record<EventProviderKey, string> = {
  eventbrite: "mdi:ticket-confirmation-outline",
  ical: "mdi:calendar-sync-outline",
  ticketsource: "mdi:ticket-outline",
  wegottickets: "mdi:ticket-percent-outline",
  spydus: "mdi:bookshelf",
  solus: "mdi:application-outline",
  aspen: "mdi:compass-outline",
}

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

/** Connect a new event feed: pick a library, a platform, then its details. */
export function ConnectFeedForm({
  libraries,
  initialLibrary,
  oauth,
}: {
  readonly libraries: { documentId: string; name: string }[]
  readonly initialLibrary?: string
  readonly oauth: { eventbrite: boolean }
}) {
  const router = useRouter()
  const initialLibraryIsClaimed =
    initialLibrary !== undefined &&
    libraries.some((l) => l.documentId === initialLibrary)
  const [libraryDocumentId, setLibraryDocumentId] = useState(
    (initialLibraryIsClaimed ? initialLibrary : undefined) ??
      libraries[0]?.documentId ??
      ""
  )
  const [provider, setProvider] = useState<EventProviderKey | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [manualToken, setManualToken] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [errorField, setErrorField] = useState<string | undefined>(undefined)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const test = useFeedTest()
  const fieldsRef = useRef<HTMLDivElement>(null)

  function selectLibrary(next: string) {
    setLibraryDocumentId(next)
    test.reset()
  }

  function selectProvider(next: EventProviderKey) {
    setProvider(next)
    setValues({})
    setManualToken(false)
    setLocalError(null)
    setErrorField(undefined)
    test.reset()
  }

  function onValuesChange(next: Record<string, string>) {
    setValues(next)
    setLocalError(null)
    setErrorField(undefined)
    test.reset()
  }

  async function runTest() {
    if (!provider) return
    const check = validateFeedValues(provider, values)
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
      provider,
      values,
    })
  }

  async function send() {
    if (!provider) return
    setSendError(null)
    setSending(true)
    try {
      const res = await fetch("/api/contribute/event-feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryDocumentId, provider, values }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setValues({})
        router.push(`/contribute/events?library=${libraryDocumentId}`)

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

  const canSend =
    provider !== null &&
    test.result !== null &&
    !FEED_TEST_BLOCKING.has(test.result)

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
      }}
    >
      <fieldset
        className="m-0 flex flex-col gap-3 p-5 sm:p-8"
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "20px",
          background: T.bg.deep,
        }}
      >
        <legend
          style={{
            fontFamily: T.font.sans,
            fontSize: "15px",
            fontWeight: 600,
            color: T.ink.base,
            padding: 0,
          }}
        >
          Library
        </legend>
        {libraries.length <= 1 ? (
          <p
            style={{
              fontFamily: T.font.serif,
              fontSize: "18px",
              color: T.ink.base,
              margin: 0,
            }}
          >
            {libraries[0]?.name ?? "No claimed library"}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="connect-feed-library" style={fieldLabelStyle}>
              Choose a library
            </label>
            <select
              id="connect-feed-library"
              value={libraryDocumentId}
              onChange={(e) => selectLibrary(e.target.value)}
              style={fieldInputStyle}
            >
              {libraries.map((l) => (
                <option key={l.documentId} value={l.documentId}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      <fieldset
        className="m-0 flex flex-col gap-4 p-5 sm:p-8"
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "20px",
          background: T.bg.deep,
        }}
      >
        <legend
          style={{
            fontFamily: T.font.sans,
            fontSize: "15px",
            fontWeight: 600,
            color: T.ink.base,
            padding: 0,
          }}
        >
          Platform
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {EVENT_PROVIDER_KEYS.map((key) => {
            const def = EVENT_PROVIDERS[key]

            return (
              <ChoiceCard
                key={key}
                name="feed-provider"
                value={key}
                checked={provider === key}
                onChange={() => selectProvider(key)}
                icon={PROVIDER_ICON[key]}
                tint={{ bg: T.bg.muted, fg: T.accent.primary }}
                title={def.label}
                hint={def.description}
              />
            )
          })}
        </div>

        {provider === "eventbrite" && oauth.eventbrite && !manualToken ? (
          <div className="flex flex-col items-start gap-2">
            <a
              href={`/api/contribute/event-feeds/eventbrite/start?library=${libraryDocumentId}`}
              className="inline-flex items-center gap-2 rounded-full bg-(--t-accent-primary) px-6 py-3 text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
              style={primaryPillSx}
            >
              Connect with Eventbrite
            </a>
            <button
              type="button"
              className="underline"
              style={{
                fontFamily: T.font.sans,
                fontSize: "14px",
                color: T.ink.dim,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
              onClick={() => setManualToken(true)}
            >
              Or paste a private token
            </button>
          </div>
        ) : null}
      </fieldset>

      {provider &&
      (provider !== "eventbrite" || !oauth.eventbrite || manualToken) ? (
        <fieldset
          className="m-0 flex flex-col gap-5 p-5 sm:p-8"
          style={{
            border: `1px solid ${T.border.line}`,
            borderRadius: "20px",
            background: T.bg.deep,
          }}
        >
          <legend
            style={{
              fontFamily: T.font.sans,
              fontSize: "15px",
              fontWeight: 600,
              color: T.ink.base,
              padding: 0,
            }}
          >
            Details
          </legend>
          <div ref={fieldsRef}>
            <FeedValuesFields
              provider={provider}
              values={values}
              onChange={onValuesChange}
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
        </fieldset>
      ) : null}
    </form>
  )
}
