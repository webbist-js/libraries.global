"use client"

import { useEffect, useRef, useState } from "react"

import { ApiPlaygroundUsageDialog } from "@/components/developers/ApiPlaygroundUsageDialog"
import { SelectField } from "@/components/ds/SelectField"
import { Button } from "@/components/ui/button"
import { LIVE_LOCALES } from "@/lib/live-locales"
import {
  playgroundJob,
  playgroundPlacePath,
  playgroundPlaces,
  playgroundRequest,
  playgroundRecords,
  playgroundScope,
  playgroundServices,
  PLAYGROUND_MAX_RECORDS,
  PLAYGROUND_RESOURCE_OPERATIONS,
  type PlaygroundInput,
  type PlaygroundOperation,
  type PlaygroundReachMode,
  type PlaygroundSummaryOperation,
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
  {
    id: "places",
    label: "Browse places",
    method: "GET",
    path: "/api/v1/places/{country}/{region}",
  },
  {
    id: "placeLibraries",
    label: "Libraries in a place",
    method: "GET",
    path: "/api/v1/places/{country}/{region}/{area}/libraries",
  },
  {
    id: "services",
    label: "List services",
    method: "GET",
    path: "/api/v1/services",
  },
  {
    id: "service",
    label: "Read a service",
    method: "GET",
    path: "/api/v1/services/{ref}",
  },
  {
    id: "serviceLibraries",
    label: "Service members",
    method: "GET",
    path: "/api/v1/services/{ref}/libraries",
  },
  {
    id: "summary",
    label: "Summary analysis",
    method: "POST",
    path: "/api/v1/analysis/summary",
  },
  {
    id: "reach",
    label: "Reach analysis",
    method: "POST",
    path: "/api/v1/analysis/reach",
  },
  {
    id: "job",
    label: "Job status",
    method: "GET",
    path: "/api/v1/analysis/jobs/{id}",
  },
  {
    id: "jobResult",
    label: "Job result",
    method: "GET",
    path: "/api/v1/analysis/jobs/{id}/result",
  },
  {
    id: "proposal",
    label: "Proposal status",
    method: "GET",
    path: "/api/v1/submissions/{id}",
  },
] as const
/** Most status checks one "Poll job" press makes (each is a metered request). */
const POLL_LIMIT = 10
const SUMMARY_OPERATIONS: {
  value: PlaygroundSummaryOperation
  label: string
}[] = [
  { value: "service.profile", label: "Service profile (1 credit)" },
  { value: "service.coverage", label: "Service coverage (5 credits)" },
  { value: "place.profile", label: "Place profile (1 credit)" },
  { value: "place.coverage", label: "Place coverage (5 credits)" },
]
const REACH_MODES: { value: PlaygroundReachMode; label: string }[] = [
  { value: "library", label: "One library (5 credits)" },
  { value: "service", label: "Service reporting area (20 credits)" },
  { value: "network", label: "Whole service (40 credits, when enabled)" },
]
const PLACE_OPERATIONS = new Set<PlaygroundOperation>([
  "places",
  "placeLibraries",
])
const field =
  "mt-2 block h-12 w-full min-w-0 rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) px-4 text-base font-normal text-(--t-ink-base) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
type Result = {
  status: number
  body: unknown
  request: string
  records: ReturnType<typeof playgroundRecords>
}

type PlaceLevel = "country" | "region" | "area"

/** Which level the returned places are, from the slugs that produced them. */
function placeLevelOf(country: string, region: string): PlaceLevel {
  if (region.trim()) return "area"

  return country.trim() ? "region" : "country"
}

const PLACE_LEVEL_LISTS: Record<PlaceLevel, string> = {
  country: "countries",
  region: "the country’s regions",
  area: "the region’s areas",
}

/** The country, region and area slugs a returned place stands for. */
function chosenPlace(
  slug: string,
  placeLevel: PlaceLevel,
  country: string,
  region: string
) {
  if (placeLevel === "country") return { country: slug, region: "", area: "" }
  if (placeLevel === "region") return { country, region: slug, area: "" }

  return { country, region, area: slug }
}

function needsServiceRef(chosen: PlaygroundInput) {
  if (["service", "serviceLibraries"].includes(chosen.operation)) return true
  if (chosen.operation === "summary")
    return Boolean(chosen.summaryOperation?.startsWith("service."))

  return chosen.operation === "reach" && chosen.reachMode !== "library"
}

function reachProblem(chosen: PlaygroundInput) {
  if (chosen.reachMode === "library" && !chosen.entityRef.trim())
    return "Enter a Library entityRef, or search to choose one."
  if (chosen.reachMode === "service" && !chosen.areaCode?.trim())
    return "Enter the service's reporting area code."

  return null
}

/** Send one playground request with the visitor's key; never with cookies. */
async function sendPlaygroundRequest(
  request: ReturnType<typeof playgroundRequest>,
  token: string,
  signal: AbortSignal
) {
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
    signal,
  })

  return { status: response.status, body: await responseBody(response) }
}

/** Why a request cannot be sent yet, or null when it can. */
function requestProblem(chosen: PlaygroundInput, token: string) {
  if (!token.trim()) return "Enter your Team API key before running a request."
  if (chosen.operation === "placeLibraries" && !chosen.country?.trim())
    return "Enter a country slug, or browse places to choose one."
  if (needsServiceRef(chosen) && !chosen.serviceRef?.trim())
    return "Enter a service ref, or list services to choose one."
  if (
    chosen.operation === "summary" &&
    chosen.summaryOperation?.startsWith("place.") &&
    !chosen.country?.trim()
  )
    return "Enter a country slug for a place summary."
  const reach = chosen.operation === "reach" ? reachProblem(chosen) : null
  if (reach) return reach
  if (
    (chosen.operation === "job" || chosen.operation === "jobResult") &&
    !chosen.jobId?.trim()
  )
    return "Run a summary or Reach request first, or paste a job id."
  if (chosen.operation === "proposal" && !chosen.proposalId?.trim())
    return "Paste a proposal id returned by a submissions request."

  return null
}

/** Places from a place browse; a place's library list is shown as records. */
function resultPlaces(result: Result | null) {
  return result?.request.includes("/libraries")
    ? []
    : playgroundPlaces(result?.body)
}

/** The JSON body, or a stand-in error when the server did not send JSON. */
async function responseBody(response: Response): Promise<unknown> {
  if (response.headers.get("content-type")?.includes("application/json"))
    return response.json()

  return {
    error: {
      code: "non_json_response",
      message:
        "The server returned a non-JSON response. Check service availability.",
    },
  }
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
  const [country, setCountry] = useState("")
  const [region, setRegion] = useState("")
  const [area, setArea] = useState("")
  const [serviceRef, setServiceRef] = useState("")
  const [summaryOperation, setSummaryOperation] =
    useState<PlaygroundSummaryOperation>("service.profile")
  const [reachMode, setReachMode] = useState<PlaygroundReachMode>("library")
  const [travelMode, setTravelMode] = useState<"walking" | "cycling">("walking")
  const [minutes, setMinutes] = useState(0)
  const [areaCode, setAreaCode] = useState("")
  const [jobId, setJobId] = useState("")
  const [proposalId, setProposalId] = useState("")
  const [polling, setPolling] = useState(false)
  const [token, setToken] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const controller = useRef<AbortController | null>(null)
  const keyInput = useRef<HTMLInputElement>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const selected = operations.find((item) => item.id === operation)!
  const records = result?.records ?? playgroundRecords(result?.body)
  const input: PlaygroundInput = {
    operation,
    query,
    entityRef,
    limit,
    locale,
    country,
    region,
    area,
    serviceRef,
    summaryOperation,
    reachMode,
    travelMode,
    minutes: minutes || undefined,
    areaCode,
    jobId,
    proposalId,
  }
  const resourceOperation = PLAYGROUND_RESOURCE_OPERATIONS.includes(operation)
  const services =
    operation === "services" ? playgroundServices(result?.body) : []
  const job = playgroundJob(result?.body)
  const placeOperation = PLACE_OPERATIONS.has(operation)
  const places = resultPlaces(result)
  const placeLevel = placeLevelOf(country, region)
  const clear = () => {
    setResult(null)
    setError("")
  }

  async function run(chosen: PlaygroundInput): Promise<unknown> {
    if (pending || controller.current) return null
    // Keep the returned list available while inspecting individual records.
    if (chosen.operation === "read") setError("")
    else clear()
    const invalid = requestProblem(chosen, token)
    if (invalid) {
      setError(invalid)

      return null
    }
    const request = playgroundRequest(chosen)
    const description = `${request.method} ${request.path}`
    const abort = new AbortController()
    controller.current = abort
    const timeout = setTimeout(() => abort.abort(), 30_000)
    setPending(true)
    try {
      const { status, body } = await sendPlaygroundRequest(
        request,
        token,
        abort.signal
      )
      setResult({
        status,
        body,
        request: description,
        records:
          chosen.operation === "read" ? records : playgroundRecords(body),
      })
      const returned = playgroundJob(body)
      if (returned) setJobId(returned.id)

      return body
    } catch {
      setError(
        "The request could not be completed. Check your connection and try again. A timed-out request may still count toward your Team’s allowance."
      )
    } finally {
      clearTimeout(timeout)
      controller.current = null
      setPending(false)
    }

    return null
  }

  /** Poll a pending job a bounded number of times; each check is metered. */
  async function poll(id: string, firstDelay: number) {
    if (polling) return
    setPolling(true)
    setOperation("job")
    let delay = firstDelay
    try {
      for (let n = 0; n < POLL_LIMIT; n++) {
        await new Promise((resolve) => setTimeout(resolve, delay * 1000))
        const body = await run({ ...input, operation: "job", jobId: id })
        const state = playgroundJob(body)
        if (!state || state.state !== "pending") break
        delay = state.retryAfter
      }
    } finally {
      setPolling(false)
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
            {placeOperation ? playgroundPlacePath(input) : selected.path}
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
              {playgroundScope(operation)} access. The key stays in memory while
              this page is open and is never saved.
            </span>
          </label>
          {resourceOperation ? (
            <ResourceFields
              operation={operation}
              values={{
                serviceRef,
                summaryOperation,
                reachMode,
                travelMode,
                minutes,
                areaCode,
                jobId,
                proposalId,
                entityRef,
                country,
                region,
                area,
              }}
              onChange={(key, value) => {
                const setters: Record<string, (v: never) => void> = {
                  serviceRef: setServiceRef,
                  summaryOperation: setSummaryOperation,
                  reachMode: setReachMode,
                  travelMode: setTravelMode,
                  minutes: setMinutes,
                  areaCode: setAreaCode,
                  jobId: setJobId,
                  proposalId: setProposalId,
                  entityRef: setEntityRef,
                  country: setCountry,
                  region: setRegion,
                  area: setArea,
                }
                setters[key]?.(value as never)
                clear()
              }}
            />
          ) : null}
          {placeOperation ? (
            <div className="grid gap-5 sm:grid-cols-3">
              {(
                [
                  ["Country", country, setCountry, "united-states"],
                  ["Region", region, setRegion, "optional"],
                  ...(operation === "placeLibraries"
                    ? ([["Area", area, setArea, "optional"]] as const)
                    : []),
                ] as const
              ).map(([label, value, set, placeholder]) => (
                <label key={label} className="min-w-0 font-semibold">
                  {label}
                  <input
                    name={label.toLowerCase()}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={placeholder}
                    className={field}
                    value={value}
                    maxLength={100}
                    onChange={(event) => {
                      set(event.target.value.toLowerCase().trim())
                      clear()
                    }}
                  />
                </label>
              ))}
              <p className="m-0 text-sm font-normal text-(--t-ink-dim) sm:col-span-3">
                Use slugs from “Browse places”. A region needs its country and
                an area needs its region. Leave them empty to start from every
                country.
              </p>
            </div>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <OperationField
              operation={operation}
              placeLevel={placeLevel}
              query={query}
              entityRef={entityRef}
              limit={limit}
              onQuery={(value) => {
                setQuery(value)
                clear()
              }}
              onEntityRef={(value) => {
                setEntityRef(value)
                clear()
              }}
              onLimit={(value) => {
                setLimit(value)
                clear()
              }}
            />
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
        className={`grid min-w-0 gap-5 ${records.length || places.length ? "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : ""}`}
      >
        <PlaygroundResponse result={result} pending={pending} />
        {job?.state === "pending" ? (
          <section
            aria-label="Pending job"
            className="min-w-0 rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5"
          >
            <h2 className="type-small-heading m-0">Job {job.state}</h2>
            <p className="m-0 mt-2 font-mono text-xs break-all" translate="no">
              {job.id}
            </p>
            <p className="m-0 mt-2 text-sm text-(--t-ink-dim)">
              Polling checks the job up to {POLL_LIMIT} times, waiting as the
              API asks between checks. Each check is a metered request; the
              job&apos;s credits are only spent once it completes.
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="mt-4"
              disabled={pending || polling}
              aria-busy={polling}
              onClick={() => void poll(job.id, job.retryAfter)}
            >
              {polling ? "Polling…" : "Poll job status"}
            </Button>
          </section>
        ) : null}
        {services.length ? (
          <section
            aria-label="Returned services"
            className="flex max-h-72 min-w-0 flex-col overflow-hidden rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) xl:max-h-[36rem]"
          >
            <h2 className="type-small-heading m-0 border-b border-(--t-border-line) p-5">
              Returned services
            </h2>
            <ul className="m-0 min-h-0 list-none space-y-1 overflow-y-auto overscroll-contain p-2">
              {services.map((service) => (
                <li
                  key={service.ref}
                  className="flex min-w-0 flex-wrap items-center gap-2 rounded-2xl px-3 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium [overflow-wrap:anywhere]">
                      {service.name}
                    </span>
                    <span className="block font-mono text-xs text-(--t-ink-dim)">
                      {service.serviceType} · {service.ref}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    aria-label={`Use ${service.name}`}
                    onClick={() => {
                      setServiceRef(service.ref)
                      setOperation("service")
                    }}
                  >
                    Use
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {places.length && operation === "places" ? (
          <section
            aria-label="Returned places"
            className="flex max-h-72 min-w-0 flex-col overflow-hidden rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) xl:max-h-[36rem]"
          >
            <div className="border-b border-(--t-border-line) p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="type-small-heading m-0">Returned places</h2>
                <span className="rounded-full bg-(--t-accent-chip) px-2.5 py-1 text-xs font-semibold tabular-nums">
                  {places.length}
                </span>
              </div>
              <p className="m-0 mt-2 text-sm text-(--t-ink-dim)">
                Each request you make from here uses your Team’s API allowance.
              </p>
            </div>
            <ul className="m-0 min-h-0 list-none space-y-1 overflow-y-auto overscroll-contain p-2">
              {places.map((place) => {
                const chosen = chosenPlace(
                  place.slug,
                  placeLevel,
                  country,
                  region
                )

                return (
                  <li
                    key={place.slug}
                    className="flex min-w-0 flex-wrap items-center gap-2 rounded-2xl px-3 py-2 hover:bg-(--t-bg-surface)"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium [overflow-wrap:anywhere]">
                        {place.name}
                      </span>
                      <span className="block font-mono text-xs text-(--t-ink-dim)">
                        {place.slug} ·{" "}
                        {place.libraryCount.toLocaleString("en-GB")}
                      </span>
                    </span>
                    {placeLevel !== "area" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        aria-label={`Browse ${place.name}`}
                        onClick={() => {
                          setCountry(chosen.country)
                          setRegion(chosen.region)
                          setArea("")
                          void run({
                            ...input,
                            operation: "places",
                            ...chosen,
                            area: "",
                          })
                        }}
                      >
                        Browse
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      aria-label={`List libraries in ${place.name}`}
                      onClick={() => {
                        setOperation("placeLibraries")
                        setCountry(chosen.country)
                        setRegion(chosen.region)
                        setArea(chosen.area)
                        void run({
                          ...input,
                          operation: "placeLibraries",
                          ...chosen,
                        })
                      }}
                    >
                      Libraries
                    </Button>
                  </li>
                )
              })}
            </ul>
          </section>
        ) : null}
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

/** The operation's own parameter: a query, a reference, a limit or a note. */
function OperationField({
  operation,
  placeLevel,
  query,
  entityRef,
  limit,
  onQuery,
  onEntityRef,
  onLimit,
}: {
  readonly operation: PlaygroundOperation
  readonly placeLevel: PlaceLevel
  readonly query: string
  readonly entityRef: string
  readonly limit: number
  readonly onQuery: (value: string) => void
  readonly onEntityRef: (value: string) => void
  readonly onLimit: (value: number) => void
}) {
  if (
    PLAYGROUND_RESOURCE_OPERATIONS.includes(operation) &&
    operation !== "services" &&
    operation !== "serviceLibraries"
  )
    return (
      <p className="m-0 self-end text-sm text-(--t-ink-dim)">
        {operation === "summary" || operation === "reach"
          ? "Analysis spends credits from your account’s allowance once a result completes. Cached identical results spend none."
          : "Reading a job, its result or a proposal’s status is a metered request and never spends analysis credits."}
      </p>
    )
  if (operation === "places")
    return (
      <p className="m-0 self-end text-sm text-(--t-ink-dim)">
        Lists {PLACE_LEVEL_LISTS[placeLevel]} with published libraries, and how
        many each has.
      </p>
    )
  if (operation === "search")
    return (
      <label className="font-semibold">
        Search query
        <input
          name="query"
          autoComplete="off"
          className={field}
          value={query}
          maxLength={512}
          onChange={(event) => onQuery(event.target.value)}
        />
      </label>
    )
  if (operation === "read")
    return (
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
          onChange={(event) => onEntityRef(event.target.value)}
        />
        <span className="mt-2 block text-sm font-normal text-(--t-ink-dim)">
          Run a search or list records, then choose “Read this record” below.
          You can also paste a complete entityRef returned by the API.
        </span>
      </label>
    )

  return (
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
        onChange={(event) => onLimit(Number(event.target.value))}
      />
    </label>
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

type ResourceValues = {
  serviceRef: string
  summaryOperation: PlaygroundSummaryOperation
  reachMode: PlaygroundReachMode
  travelMode: "walking" | "cycling"
  minutes: number
  areaCode: string
  jobId: string
  proposalId: string
  entityRef: string
  country: string
  region: string
  area: string
}

/** Parameters for the service, analysis, job and proposal operations. */
function ResourceFields({
  operation,
  values,
  onChange,
}: {
  readonly operation: PlaygroundOperation
  readonly values: ResourceValues
  readonly onChange: (key: keyof ResourceValues, value: string | number) => void
}) {
  const text = (
    key: keyof ResourceValues,
    label: string,
    hint: string,
    placeholder = ""
  ) => (
    <label key={key} className="block min-w-0 font-semibold">
      {label}
      <input
        name={key}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        className={field}
        value={String(values[key])}
        maxLength={255}
        onChange={(event) => onChange(key, event.target.value.trim())}
      />
      <span className="mt-2 block text-sm font-normal text-(--t-ink-dim)">
        {hint}
      </span>
    </label>
  )
  const choose = (
    key: keyof ResourceValues,
    label: string,
    options: { value: string; label: string }[]
  ) => (
    <label key={key} className="block min-w-0 font-semibold">
      {label}
      <SelectField
        name={key}
        className={field}
        value={String(values[key])}
        onValueChange={(value) =>
          onChange(key, key === "minutes" ? Number(value) : value)
        }
        options={options}
      />
    </label>
  )
  const serviceRef = text(
    "serviceRef",
    "Service ref",
    "A service’s stable ref from “List services”. Slugs can change; refs do not."
  )
  const place = (
    <div key="place" className="grid gap-5 sm:grid-cols-3">
      {text("country", "Country", "Place slug.", "united-kingdom")}
      {text("region", "Region", "Optional.", "optional")}
      {text("area", "Area", "Optional; needs a region.", "optional")}
    </div>
  )
  if (operation === "service" || operation === "serviceLibraries")
    return serviceRef
  if (operation === "summary")
    return (
      <div className="grid gap-5">
        {choose("summaryOperation", "Operation", SUMMARY_OPERATIONS)}
        {values.summaryOperation.startsWith("service.") ? serviceRef : place}
      </div>
    )
  if (operation === "reach")
    return (
      <div className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-3">
          {choose("reachMode", "Mode", REACH_MODES)}
          {choose("travelMode", "Travel", [
            { value: "walking", label: "Walking" },
            { value: "cycling", label: "Cycling" },
          ])}
          {choose("minutes", "Minutes", [
            { value: "0", label: "All bands" },
            ...[5, 10, 15, 30].map((m) => ({
              value: String(m),
              label: `${m} minutes`,
            })),
          ])}
        </div>
        {values.reachMode === "library"
          ? text(
              "entityRef",
              "Library entityRef",
              "A published Library’s complete entityRef from search or list results."
            )
          : serviceRef}
        {values.reachMode === "service"
          ? text(
              "areaCode",
              "Reporting area code",
              "One reporting area the service covers, for example E06000023."
            )
          : null}
      </div>
    )
  if (operation === "job" || operation === "jobResult")
    return text(
      "jobId",
      "Job id",
      "Filled in from the last summary or Reach response."
    )
  if (operation === "proposal")
    return text(
      "proposalId",
      "Proposal id",
      "Returned when your software files a proposal. Proposals are not created from the playground, so nothing enters the moderation queue by accident."
    )

  return null
}
