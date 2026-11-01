"use client"

import { useEffect, useRef, useState } from "react"

import { ApiPlaygroundUsageDialog } from "@/components/developers/ApiPlaygroundUsageDialog"
import { SelectField } from "@/components/ds/SelectField"
import { Button } from "@/components/ui/button"
import { LIVE_LOCALES } from "@/lib/live-locales"
import {
  playgroundRequest,
  playgroundRecords,
  PLAYGROUND_MAX_RECORDS,
  type PlaygroundInput,
  type PlaygroundOperation,
} from "@/lib/team-api/playground"

const operations = [
  {
    id: "search",
    label: "Search libraries",
    method: "POST",
    path: "/api/v1/search/libraries",
  },
  {
    id: "list",
    label: "List records",
    method: "GET",
    path: "/api/v1/libraries",
  },
  {
    id: "read",
    label: "Read one record",
    method: "GET",
    path: "/api/v1/libraries/{entityRef}",
  },
] as const
const field =
  "mt-2 block h-12 w-full min-w-0 rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) px-4 text-base font-normal text-(--t-ink-base) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
type Result = {
  status: number
  body: unknown
  request: string
  records: ReturnType<typeof playgroundRecords>
}

export function ApiPlayground({
  teamName,
  showUsageWarning = true,
}: {
  readonly teamName: string
  readonly showUsageWarning?: boolean
}) {
  const [operation, setOperation] = useState<PlaygroundOperation>("search")
  const [query, setQuery] = useState("Central")
  const [entityRef, setEntityRef] = useState("")
  const [limit, setLimit] = useState(10)
  const [locale, setLocale] = useState("en")
  const [token, setToken] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const controller = useRef<AbortController | null>(null)
  const keyInput = useRef<HTMLInputElement>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const selected = operations.find((item) => item.id === operation)!
  const records = result?.records ?? playgroundRecords(result?.body)
  const input: PlaygroundInput = { operation, query, entityRef, limit, locale }
  const clear = () => {
    setResult(null)
    setError("")
  }

  async function run(chosen: PlaygroundInput) {
    if (pending || controller.current) return
    // Keep the returned list available while inspecting individual records.
    if (chosen.operation === "read") setError("")
    else clear()
    if (!token.trim()) {
      setError("Enter your Team API key before running a request.")

      return
    }
    const request = playgroundRequest(chosen)
    const description = `${request.method} ${request.path}`
    const abort = new AbortController()
    controller.current = abort
    const timeout = setTimeout(() => abort.abort(), 30_000)
    setPending(true)
    try {
      const response = await fetch(request.path, {
        method: request.method,
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          ...(request.body ? { "Content-Type": "application/json" } : {}),
        },
        body: request.body,
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: abort.signal,
      })
      const body: unknown = response.headers
        .get("content-type")
        ?.includes("application/json")
        ? await response.json()
        : {
            error: {
              code: "non_json_response",
              message:
                "The server returned a non-JSON response. Check service availability.",
            },
          }
      setResult({
        status: response.status,
        body,
        request: description,
        records:
          chosen.operation === "read" ? records : playgroundRecords(body),
      })
    } catch {
      setError(
        "The request could not be completed. Check your connection and try again. A timed-out request may still count toward your Team’s allowance."
      )
    } finally {
      clearTimeout(timeout)
      controller.current = null
      setPending(false)
    }
  }

  return (
    <div className="grid min-w-0 gap-6">
      {showUsageWarning ? (
        <ApiPlaygroundUsageDialog
          teamName={teamName}
          onDismiss={() => keyInput.current?.focus({ preventScroll: true })}
        />
      ) : null}
      <p className="m-0 rounded-2xl border border-(--t-border-line) bg-(--t-accent-chip) px-5 py-4 text-sm text-(--t-ink-base)">
        <strong>This playground uses your Team’s API allowance.</strong>{" "}
        Successful requests and response data count toward the shared monthly
        usage for {teamName}. This includes requests made with “Read this
        record”.
      </p>
      <fieldset disabled={pending} className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">Request type</legend>
        <div className="flex flex-wrap gap-2 border-b border-(--t-border-line) pb-4">
          {operations.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={operation === item.id ? "primary" : "ghost"}
              size="pill"
              aria-pressed={operation === item.id}
              onClick={() => {
                setOperation(item.id)
                clear()
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </fieldset>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void run(input)
        }}
        className="rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-7"
        aria-label="API request playground"
      >
        <div className="flex min-w-0 items-center gap-4 border-b border-(--t-border-line) pb-5">
          <span className="shrink-0 rounded-lg bg-(--t-bg-surface) px-3 py-2 text-sm font-semibold text-(--t-accent-primary)">
            {selected.method}
          </span>
          <code
            className="min-w-0 font-mono text-sm break-all sm:text-base"
            translate="no"
          >
            {selected.path}
          </code>
          <span className="ml-auto shrink-0 text-sm text-(--t-ink-dim)">
            v1
          </span>
        </div>
        <fieldset
          disabled={pending}
          className="m-0 min-w-0 space-y-5 border-0 p-0 pt-5"
        >
          <legend className="sr-only">Request parameters</legend>
          <label className="block font-semibold">
            Team API key
            <input
              type="password"
              name="api-key"
              ref={keyInput}
              autoComplete="off"
              spellCheck={false}
              required
              className={field}
              value={token}
              onChange={(event) => {
                setToken(event.target.value)
                clear()
              }}
            />
            <span className="mt-2 block text-sm font-normal text-(--t-ink-dim)">
              Use an existing key from your Team with{" "}
              {operation === "search" ? "search:read" : "libraries:read"}{" "}
              access. The key stays in memory while this page is open and is
              never saved.
            </span>
          </label>
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
            {operation === "search" ? (
              <label className="font-semibold">
                Search query
                <input
                  name="query"
                  autoComplete="off"
                  className={field}
                  value={query}
                  maxLength={512}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    clear()
                  }}
                />
              </label>
            ) : operation === "read" ? (
              <label className="min-w-0 font-semibold">
                Entity reference
                <input
                  id="playground-entity-ref"
                  name="entityRef"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Choose a Library from search or list results"
                  className={field}
                  value={entityRef}
                  maxLength={1024}
                  required
                  onChange={(event) => {
                    setEntityRef(event.target.value)
                    clear()
                  }}
                />
                <span className="mt-2 block text-sm font-normal text-(--t-ink-dim)">
                  Run a search or list records, then choose “Read this record”
                  below. You can also paste a complete entityRef returned by the
                  API.
                </span>
              </label>
            ) : (
              <label className="font-semibold">
                Number of records
                <input
                  type="number"
                  name="limit"
                  min={1}
                  max={PLAYGROUND_MAX_RECORDS}
                  required
                  className={field}
                  value={limit}
                  onChange={(event) => {
                    setLimit(Number(event.target.value))
                    clear()
                  }}
                />
              </label>
            )}
            <label className="font-semibold">
              Locale
              <SelectField
                name="locale"
                className={field}
                value={String(locale ?? "")}
                onValueChange={(selectedValue) => {
                  setLocale(selectedValue)
                  clear()
                }}
                options={LIVE_LOCALES.map((value) => ({
                  value: String(value),
                  label: String(value === "en" ? "English" : value),
                }))}
              />
            </label>
          </div>
        </fieldset>
        <RequestSubmit pending={pending} error={error} />
      </form>
      <div
        className={`grid min-w-0 gap-5 ${records.length ? "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : ""}`}
      >
        <PlaygroundResponse result={result} pending={pending} />
        {records.length ? (
          <section
            aria-label="Returned libraries"
            className="flex max-h-72 min-w-0 flex-col overflow-hidden rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) xl:max-h-[36rem]"
          >
            <div className="border-b border-(--t-border-line) p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="type-small-heading m-0">Returned libraries</h2>
                <span className="rounded-full bg-(--t-accent-chip) px-2.5 py-1 text-xs font-semibold tabular-nums">
                  {records.length}
                </span>
              </div>
              <p className="m-0 mt-2 text-sm text-(--t-ink-dim)">
                Each record you read uses your Team’s API allowance.
              </p>
            </div>
            <ul
              aria-label="Choose a returned library"
              tabIndex={0}
              className="m-0 min-h-0 list-none space-y-1 overflow-y-auto overscroll-contain p-2"
            >
              {records.map((record) => (
                <li key={record.entityRef} className="min-w-0">
                  <Button
                    type="button"
                    variant={
                      operation === "read" && entityRef === record.entityRef
                        ? "secondary"
                        : "ghost"
                    }
                    className="h-auto min-h-16 w-full justify-start gap-3 rounded-2xl px-3 py-3 text-left whitespace-normal"
                    disabled={pending}
                    aria-label={`Read this record: ${record.name}`}
                    aria-pressed={
                      operation === "read" && entityRef === record.entityRef
                    }
                    onClick={() => {
                      setOperation("read")
                      setEntityRef(record.entityRef)
                      void run({
                        ...input,
                        operation: "read",
                        entityRef: record.entityRef,
                      })
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium [overflow-wrap:anywhere]">
                        {record.name}
                      </span>
                      <span className="mt-1 block text-xs font-normal text-(--t-accent-primary)">
                        Read record
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className="shrink-0 text-(--t-accent-primary)"
                    >
                      →
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function PlaygroundResponse({
  result,
  pending,
}: {
  readonly result: Result | null
  readonly pending: boolean
}) {
  return (
    <section
      className="flex max-h-[36rem] min-w-0 flex-col overflow-hidden rounded-3xl bg-[#19182c] text-[#eeedf6]"
      aria-label="API response"
      aria-busy={pending}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/15 px-5 py-4 sm:px-7">
        <h2 className="type-small-heading m-0">Response</h2>
        <p className="m-0 text-sm" role="status">
          {pending
            ? "Waiting for response…"
            : result
              ? `Live data · ${result.status}${result.status === 200 ? " OK" : ""} · JSON`
              : "Run a request to see the response"}
        </p>
      </div>
      {result ? (
        <>
          <p
            className="m-0 shrink-0 px-5 pt-5 font-mono text-xs break-all opacity-70 sm:px-7"
            translate="no"
          >
            {result.request}
          </p>
          <pre
            key={result.request}
            tabIndex={0}
            aria-label="JSON response"
            translate="no"
            className="m-0 min-h-0 overflow-auto p-5 font-mono text-sm leading-relaxed sm:p-7"
          >
            <code>{JSON.stringify(result.body, null, 2)}</code>
          </pre>
        </>
      ) : (
        <p className="m-0 p-5 text-sm opacity-75 sm:p-7">
          Run a request to retrieve real published Library data using your
          Team’s API allowance. Search or list records first to find a Library’s
          complete entity reference.
        </p>
      )}
    </section>
  )
}

function RequestSubmit({
  pending,
  error,
}: {
  readonly pending: boolean
  readonly error: string
}) {
  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="m-0 max-w-[65ch] text-sm text-(--t-ink-dim)">
          Successful requests consume your Team’s shared request and
          response-data allowance. Errors do not consume monthly allowance.
        </p>
        <Button
          type="submit"
          variant="primary"
          size="pill"
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? "Running request…" : "Run request"}
          <span aria-hidden>→</span>
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-4 text-(--t-ink-base)">
          {error}
        </p>
      ) : null}
    </>
  )
}
