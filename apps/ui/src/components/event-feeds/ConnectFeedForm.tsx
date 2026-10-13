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
import { useTranslations as useUiTranslations } from "next-intl"
import { useRef, useState } from "react"

import { ChoiceCard } from "@/components/ds/ChoiceCard"
import { Notice } from "@/components/ds/Notice"
import {
  fieldInputStyle,
  fieldLabelStyle,
} from "@/components/library-editor/wizard.constants"
import { T } from "@/lib/design-tokens"
import { staffLibraryHref } from "@/lib/staff/paths"

import { isFeedTestCode } from "./feed-copy"
import {
  PRIMARY_PILL,
  SECONDARY_PILL,
  secondaryPillStyle,
  TOO_MANY_REQUESTS,
} from "./feed-ui"
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

/** Connect a new event feed: pick a library, a platform, then its details. */
export function ConnectFeedForm({
  libraries,
  initialLibrary,
  oauth,
}: {
  readonly libraries: { documentId: string; name: string; slug: string }[]
  readonly initialLibrary?: string
  readonly oauth: { eventbrite: boolean }
}) {
  const tUi = useUiTranslations("ui")

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
        router.push(
          staffLibraryHref(
            libraries.find((l) => l.documentId === libraryDocumentId)?.slug,
            "/events"
          )
        )

        return
      }
      const result: unknown = json?.error?.result
      if (res.status === 429) setSendError(TOO_MANY_REQUESTS)
      else if (res.status === 422 && isFeedTestCode(result))
        setSendError(FEED_TEST_COPY[result] ?? json.error.message)
      else setSendError(json?.error?.message ?? "That didn’t work. Try again.")
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
      <section
        aria-labelledby="connect-library-heading"
        className="flex flex-col gap-3 rounded-[20px] border p-5 sm:p-8"
        style={{ borderColor: T.border.line, background: T.bg.deep }}
      >
        <h2
          id="connect-library-heading"
          className="m-0 text-[20px]"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            color: T.ink.base,
          }}
        >
          {tUi("library")}{" "}
        </h2>
        {libraries.length <= 1 ? (
          <p
            className="m-0 text-[16px] font-semibold"
            style={{ color: T.ink.base }}
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
      </section>

      <section
        aria-labelledby="connect-platform-heading"
        className="flex flex-col gap-3 rounded-[20px] border p-5 sm:p-8"
        style={{ borderColor: T.border.line, background: T.bg.deep }}
      >
        <h2
          id="connect-platform-heading"
          className="m-0 text-[20px]"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            color: T.ink.base,
          }}
        >
          Platform
        </h2>
        <fieldset className="m-0 border-0 p-0">
          <legend className="sr-only">Platform</legend>
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
        </fieldset>

        {provider === "eventbrite" && oauth.eventbrite && !manualToken ? (
          <div className="flex flex-col items-start gap-2">
            <a
              href={`/api/contribute/event-feeds/eventbrite/start?library=${encodeURIComponent(libraryDocumentId)}`}
              className={PRIMARY_PILL}
            >
              Connect with Eventbrite
            </a>
            <button
              type="button"
              className="inline-flex min-h-11 items-center text-[14px] font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
              onClick={() => setManualToken(true)}
            >
              Or paste a private token
            </button>
          </div>
        ) : null}
      </section>

      {provider &&
      (provider !== "eventbrite" || !oauth.eventbrite || manualToken) ? (
        <section
          aria-labelledby="connect-details-heading"
          className="flex flex-col gap-5 rounded-[20px] border p-5 sm:p-8"
          style={{ borderColor: T.border.line, background: T.bg.deep }}
        >
          <h2
            id="connect-details-heading"
            className="m-0 text-[20px]"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              color: T.ink.base,
            }}
          >
            Details
          </h2>
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
                title={tUi("test_result")}
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
              aria-describedby={canSend ? undefined : "connect-feed-hint"}
              disabled={!canSend || sending}
              onClick={send}
            >
              {sending ? "Connecting…" : "Connect"}
            </button>
            {!canSend ? (
              <span
                id="connect-feed-hint"
                className="text-[13.5px]"
                style={{ color: T.ink.dim }}
              >
                Test the connection first.
              </span>
            ) : null}
          </div>
          <p
            className="m-0"
            style={{
              fontFamily: T.font.sans,
              fontSize: "13.5px",
              color: T.ink.dim,
            }}
          >
            A moderator checks the connection before it syncs. They see whether
            the test passed, never the details themselves.
          </p>
        </section>
      ) : null}
    </form>
  )
}
