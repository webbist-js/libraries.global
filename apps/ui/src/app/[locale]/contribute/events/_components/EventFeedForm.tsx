"use client"

import { Icon } from "@iconify/react"
import { useEffect, useRef, useState } from "react"

import { T } from "@/lib/design-tokens"
import { meiliClient, type LibrarySearchHit } from "@/lib/meilisearch"

import {
  fieldHintStyle,
  fieldInputStyle,
  fieldLabelStyle,
} from "../../add/_components/wizard.constants"
import { RequiredTag } from "../../add/_components/WizardFields"

// ── Provider definitions aligned with event-credential schema enum ─────────────

type Provider =
  | "eventbrite"
  | "ticketsource"
  | "meetup"
  | "ical"
  | "wegottickets"
  | "spydus"
  | "bibliocommons"

type FieldDef = {
  key: string
  label: string
  type: "text" | "password"
  placeholder?: string
  hint?: string
}

const PROVIDER_FIELDS: Record<Provider, FieldDef[]> = {
  eventbrite: [
    {
      key: "apiKey",
      label: "Private API Token",
      type: "password",
      placeholder: "Your Eventbrite private token",
      hint: "Found under Account → Developer links → API keys",
    },
    {
      key: "orgId",
      label: "Organisation ID",
      type: "text",
      placeholder: "e.g. 123456789",
      hint: "Numeric ID from your Eventbrite organiser profile URL",
    },
  ],
  ticketsource: [
    {
      key: "venueId",
      label: "Venue ID",
      type: "text",
      placeholder: "Numeric venue ID from TicketSource",
    },
  ],
  meetup: [
    {
      key: "groupUrlname",
      label: "Group URL slug",
      type: "text",
      placeholder: "e.g. my-library-events",
      hint: "The path segment from meetup.com/your-group-slug",
    },
  ],
  ical: [
    {
      key: "feedUrl",
      label: "iCal Feed URL (.ics)",
      type: "text",
      placeholder: "https://example.com/calendar.ics",
    },
  ],
  wegottickets: [
    {
      key: "venueId",
      label: "Venue ID",
      type: "text",
      placeholder: "Numeric venue ID from WeGotTickets",
    },
  ],
  spydus: [
    {
      key: "baseUrl",
      label: "Spydus Base URL",
      type: "text",
      placeholder: "https://yourlib.spydus.com",
    },
    {
      key: "libraryCode",
      label: "Library Code",
      type: "text",
      placeholder: "e.g. CITYLIB",
    },
  ],
  bibliocommons: [
    {
      key: "subdomain",
      label: "Library subdomain",
      type: "text",
      placeholder: "cityname",
      hint: "From cityname.bibliocommons.com",
    },
  ],
}

const PROVIDERS: { value: Provider; label: string; desc: string }[] = [
  {
    value: "eventbrite",
    label: "Eventbrite",
    desc: "Event ticketing & discovery",
  },
  { value: "ical", label: "iCal / .ics feed", desc: "Standard calendar feed" },
  { value: "meetup", label: "Meetup", desc: "Community events platform" },
  { value: "ticketsource", label: "TicketSource", desc: "UK event ticketing" },
  {
    value: "wegottickets",
    label: "WeGotTickets",
    desc: "UK independent ticketing",
  },
  { value: "spydus", label: "Spydus", desc: "Library management system" },
  {
    value: "bibliocommons",
    label: "BiblioCommons",
    desc: "Library discovery platform",
  },
]

// ── Country list for filtering ─────────────────────────────────────────────────

const COUNTRIES: { name: string; slug: string }[] = [
  { name: "All countries", slug: "" },
  { name: "Argentina", slug: "argentina" },
  { name: "Australia", slug: "australia" },
  { name: "Austria", slug: "austria" },
  { name: "Belgium", slug: "belgium" },
  { name: "Brazil", slug: "brazil" },
  { name: "Canada", slug: "canada" },
  { name: "Chile", slug: "chile" },
  { name: "China", slug: "china" },
  { name: "Colombia", slug: "colombia" },
  { name: "Czech Republic", slug: "czech-republic" },
  { name: "Denmark", slug: "denmark" },
  { name: "Egypt", slug: "egypt" },
  { name: "Finland", slug: "finland" },
  { name: "France", slug: "france" },
  { name: "Germany", slug: "germany" },
  { name: "Greece", slug: "greece" },
  { name: "Hungary", slug: "hungary" },
  { name: "India", slug: "india" },
  { name: "Indonesia", slug: "indonesia" },
  { name: "Ireland", slug: "ireland" },
  { name: "Israel", slug: "israel" },
  { name: "Italy", slug: "italy" },
  { name: "Japan", slug: "japan" },
  { name: "Kenya", slug: "kenya" },
  { name: "Malaysia", slug: "malaysia" },
  { name: "Mexico", slug: "mexico" },
  { name: "Netherlands", slug: "netherlands" },
  { name: "New Zealand", slug: "new-zealand" },
  { name: "Nigeria", slug: "nigeria" },
  { name: "Norway", slug: "norway" },
  { name: "Pakistan", slug: "pakistan" },
  { name: "Peru", slug: "peru" },
  { name: "Philippines", slug: "philippines" },
  { name: "Poland", slug: "poland" },
  { name: "Portugal", slug: "portugal" },
  { name: "Romania", slug: "romania" },
  { name: "Russia", slug: "russia" },
  { name: "Saudi Arabia", slug: "saudi-arabia" },
  { name: "Singapore", slug: "singapore" },
  { name: "South Africa", slug: "south-africa" },
  { name: "South Korea", slug: "south-korea" },
  { name: "Spain", slug: "spain" },
  { name: "Sweden", slug: "sweden" },
  { name: "Switzerland", slug: "switzerland" },
  { name: "Taiwan", slug: "taiwan" },
  { name: "Thailand", slug: "thailand" },
  { name: "Turkey", slug: "turkey" },
  { name: "Ukraine", slug: "ukraine" },
  { name: "United Arab Emirates", slug: "united-arab-emirates" },
  { name: "United Kingdom", slug: "united-kingdom" },
  { name: "United States", slug: "united-states" },
  { name: "Vietnam", slug: "vietnam" },
]

// ── Shared styles (field styles shared with the add-library wizard) ─────────

const cardSx: React.CSSProperties = {
  border: `1px solid ${T.border.line}`,
  borderRadius: "20px",
  background: T.bg.deep,
}

const stepEyebrowSx: React.CSSProperties = {
  fontFamily: T.font.sans,
  fontSize: "15px",
  fontWeight: 600,
  color: T.accent.primary,
  margin: "0 0 6px",
}

const stepTitleSx: React.CSSProperties = {
  fontFamily: T.font.serif,
  fontSize: "clamp(24px, 3vw, 28px)",
  fontWeight: 500,
  lineHeight: 1.2,
  letterSpacing: "-0.01em",
  color: T.ink.base,
}

const bodySx: React.CSSProperties = {
  fontFamily: T.font.sans,
  fontSize: "15px",
  lineHeight: 1.55,
  color: T.ink.dim,
  margin: 0,
}

function StepHeading({
  n,
  title,
  as = "h2",
  id,
}: {
  readonly n: number
  readonly title: string
  readonly as?: "h2" | "legend"
  readonly id?: string
}) {
  const Tag = as

  return (
    <Tag
      id={id}
      className="block w-full"
      style={{ padding: 0, margin: "0 0 20px" }}
    >
      <span className="block" style={stepEyebrowSx}>
        Step {n} of 3
      </span>
      <span className="block" style={stepTitleSx}>
        {title}
      </span>
    </Tag>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

type SelectedLibrary = {
  documentId: string
  entityRef: string | null
  name: string
  city: string | null
  country_name: string | null
}

// ── Component ──────────────────────────────────────────────────────────────────

export function EventFeedForm({
  sessionUser,
}: {
  sessionUser: { id: string; name: string | null; email: string }
}) {
  const [countrySlug, setCountrySlug] = useState("")
  const [libraryQuery, setLibraryQuery] = useState("")
  const [libraryResults, setLibraryResults] = useState<LibrarySearchHit[]>([])
  const [librarySearching, setLibrarySearching] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedLibrary, setSelectedLibrary] =
    useState<SelectedLibrary | null>(null)
  const [provider, setProvider] = useState<Provider | "">("")
  const [credFields, setCredFields] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Library search
  useEffect(() => {
    if (!libraryQuery.trim() || selectedLibrary) {
      setLibraryResults([])
      setDropdownOpen(false)

      return
    }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    setLibrarySearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const filterParts: string[] = []
        if (countrySlug)
          filterParts.push(`country_slug = ${JSON.stringify(countrySlug)}`)
        const res = await meiliClient
          .index("library")
          .search<LibrarySearchHit>(libraryQuery, {
            filter:
              filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
            hitsPerPage: 8,
            attributesToRetrieve: [
              "documentId",
              "name",
              "entityRef",
              "city",
              "country_name",
              "country_slug",
            ],
          })
        setLibraryResults(res.hits)
        setDropdownOpen(res.hits.length > 0)
      } catch {
        setLibraryResults([])
        setDropdownOpen(false)
      } finally {
        setLibrarySearching(false)
      }
    }, 250)
  }, [libraryQuery, countrySlug, selectedLibrary])

  // Close dropdown on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("pointerdown", onPointerDown)

    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [])

  // Reset cred fields when provider changes
  useEffect(() => {
    setCredFields({})
  }, [provider])

  const providerFields = provider ? (PROVIDER_FIELDS[provider] ?? []) : []
  const allCredsFilled = providerFields.every((f) => credFields[f.key]?.trim())
  const canSubmit =
    !!selectedLibrary &&
    !!selectedLibrary.entityRef &&
    !!provider &&
    allCredsFilled

  function selectLibrary(hit: LibrarySearchHit) {
    setSelectedLibrary({
      documentId: hit.documentId,
      entityRef: hit.entityRef ?? null,
      name: hit.name,
      city: hit.city ?? null,
      country_name: hit.country_name ?? null,
    })
    setLibraryQuery("")
    setLibraryResults([])
    setDropdownOpen(false)
  }

  function clearLibrary() {
    setSelectedLibrary(null)
    setLibraryQuery("")
    setCredFields({})
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !selectedLibrary?.entityRef) return

    setStatus("submitting")
    setErrorMsg(null)

    try {
      const res = await fetch("/api/contribute/event-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          libraryDocumentId: selectedLibrary.documentId,
          libraryEntityRef: selectedLibrary.entityRef,
          libraryName: selectedLibrary.name,
          credentials: credFields,
        }),
      })

      if (res.status === 401) {
        setErrorMsg("Your session has expired. Please sign in again.")
        setStatus("error")

        return
      }
      if (res.status === 403) {
        const text = await res.text()
        setErrorMsg(
          text.includes("affiliated")
            ? "You are not affiliated with this library. Please claim it first."
            : "Verified librarian role required."
        )
        setStatus("error")

        return
      }
      if (!res.ok) {
        setErrorMsg("Submission failed — please try again or contact support.")
        setStatus("error")

        return
      }

      setStatus("success")
    } catch {
      setErrorMsg("Network error — please check your connection and try again.")
      setStatus("error")
    }
  }

  // ── Success state ────────────────────────────────────────────────────────────

  if (status === "success") {
    return (
      <div
        role="status"
        className="flex flex-col items-start gap-4 px-6 py-10 sm:px-10"
        style={cardSx}
      >
        <p
          className="inline-flex items-center gap-2"
          style={{
            fontFamily: T.font.sans,
            fontSize: "14px",
            fontWeight: 600,
            color: T.accent.ok,
            background: "#E6EFE6",
            borderRadius: "999px",
            padding: "6px 12px",
            margin: 0,
          }}
        >
          <Icon
            icon="mdi:check-circle-outline"
            className="size-4"
            aria-hidden="true"
          />
          Submitted
        </p>
        <h2
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(26px, 3vw, 32px)",
            fontWeight: 500,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            color: T.ink.base,
            margin: 0,
          }}
        >
          Credential submitted for review.
        </h2>
        <p style={{ ...bodySx, fontSize: "16px", maxWidth: "56ch" }}>
          Our team will review and activate your{" "}
          {PROVIDERS.find((p) => p.value === provider)?.label ?? provider}{" "}
          connection for{" "}
          <strong style={{ color: T.ink.base, fontWeight: 600 }}>
            {selectedLibrary?.name}
          </strong>{" "}
          within 48 hours. Events will then start appearing automatically.
        </p>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────

  const hasRef = !!selectedLibrary?.entityRef

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Step 1: Library selection */}
      <section
        aria-labelledby="event-feed-step-1"
        className="p-5 sm:p-8"
        style={cardSx}
      >
        <StepHeading n={1} title="Select your library" id="event-feed-step-1" />

        {selectedLibrary ? (
          <div
            className="flex flex-wrap items-center justify-between gap-3"
            style={{
              padding: "14px 16px",
              borderRadius: "14px",
              border: `1px solid ${T.border.hi}`,
              background: T.bg.surface,
            }}
          >
            <div className="min-w-0">
              <p
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "20px",
                  fontWeight: 500,
                  lineHeight: 1.25,
                  color: T.ink.base,
                  margin: 0,
                }}
              >
                {selectedLibrary.name}
              </p>
              <p style={{ ...bodySx, fontSize: "14px", marginTop: "4px" }}>
                {[selectedLibrary.city, selectedLibrary.country_name]
                  .filter(Boolean)
                  .join(", ")}
                {selectedLibrary.entityRef && (
                  <span
                    style={{
                      marginLeft: "10px",
                      fontFamily: T.font.mono,
                      fontSize: "13px",
                      color: T.ink.dim,
                    }}
                  >
                    {selectedLibrary.entityRef}
                  </span>
                )}
              </p>
              {!selectedLibrary.entityRef && (
                <p
                  role="alert"
                  className="inline-flex items-center gap-2"
                  style={{
                    fontFamily: T.font.sans,
                    fontSize: "14px",
                    fontWeight: 500,
                    color: T.accent.danger,
                    background: "#F6E3DA",
                    borderRadius: "10px",
                    padding: "6px 10px",
                    margin: "10px 0 0",
                  }}
                >
                  <Icon
                    icon="mdi:alert-circle-outline"
                    className="size-4 shrink-0"
                    aria-hidden="true"
                  />
                  This library has no entity ref, so a feed can&apos;t be
                  connected yet.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={clearLibrary}
              className="rounded-full px-4 py-2 font-semibold transition-colors hover:bg-(--t-bg-muted)"
              style={{
                fontFamily: T.font.sans,
                fontSize: "14px",
                color: T.ink.base,
                background: T.bg.deep,
                border: `1px solid ${T.border.hi}`,
                cursor: "pointer",
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Country filter */}
            <div className="flex flex-col gap-2">
              <label htmlFor="event-feed-country" style={fieldLabelStyle}>
                Filter by country
              </label>
              <select
                id="event-feed-country"
                value={countrySlug}
                onChange={(e) => {
                  setCountrySlug(e.target.value)
                  setLibraryResults([])
                }}
                style={fieldInputStyle}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Library search */}
            <div ref={containerRef} className="relative flex flex-col gap-2">
              <label htmlFor="event-feed-library" style={fieldLabelStyle}>
                Search library name
                <RequiredTag />
              </label>
              <div className="relative">
                <Icon
                  icon="mdi:magnify"
                  className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
                  style={{ color: T.ink.dim }}
                  aria-hidden="true"
                />
                <input
                  id="event-feed-library"
                  type="text"
                  value={libraryQuery}
                  onChange={(e) => setLibraryQuery(e.target.value)}
                  placeholder="Start typing your library name…"
                  style={{
                    ...fieldInputStyle,
                    paddingLeft: "44px",
                    paddingRight: "110px",
                  }}
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-expanded={dropdownOpen && libraryResults.length > 0}
                  aria-controls="event-feed-library-results"
                />
                <span
                  aria-live="polite"
                  className="absolute top-1/2 right-4 -translate-y-1/2"
                  style={{
                    fontFamily: T.font.sans,
                    fontSize: "14px",
                    color: T.ink.dim,
                  }}
                >
                  {librarySearching ? "Searching…" : ""}
                </span>
              </div>

              {dropdownOpen && libraryResults.length > 0 && (
                <ul
                  id="event-feed-library-results"
                  className="absolute right-0 left-0 m-0 list-none p-1"
                  style={{
                    top: "calc(100% + 6px)",
                    background: T.bg.deep,
                    border: `1px solid ${T.border.hi}`,
                    borderRadius: "14px",
                    zIndex: 50,
                  }}
                >
                  {libraryResults.map((hit) => (
                    <li key={hit.documentId}>
                      <button
                        type="button"
                        onClick={() => selectLibrary(hit)}
                        className="flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-3 text-left transition-colors hover:bg-(--t-bg-surface)"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        <span
                          className="min-w-0 truncate"
                          style={{
                            fontFamily: T.font.sans,
                            fontSize: "15px",
                            fontWeight: 600,
                            color: T.ink.base,
                          }}
                        >
                          {hit.name}
                        </span>
                        <span
                          className="shrink-0 whitespace-nowrap"
                          style={{
                            fontFamily: T.font.sans,
                            fontSize: "14px",
                            color: T.ink.dim,
                          }}
                        >
                          {[hit.city, hit.country_name]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Step 2: Provider selection */}
      {selectedLibrary && hasRef && (
        <fieldset className="m-0 min-w-0 p-5 sm:p-8" style={cardSx}>
          <StepHeading n={2} title="Event platform" as="legend" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PROVIDERS.map((p) => {
              const active = provider === p.value

              return (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setProvider(p.value)}
                  className={`flex items-center justify-between gap-3 text-left transition-colors ${
                    active
                      ? ""
                      : "hover:border-(--t-border-hi) hover:bg-(--t-bg-surface)"
                  }`}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "14px",
                    border: `1px solid ${active ? T.accent.primary : T.border.line}`,
                    background: active ? T.accent.chip : T.bg.deep,
                    cursor: "pointer",
                  }}
                >
                  <span className="min-w-0">
                    <span
                      className="block"
                      style={{
                        fontFamily: T.font.sans,
                        fontSize: "15px",
                        fontWeight: 600,
                        color: active ? T.accent.primary : T.ink.base,
                      }}
                    >
                      {p.label}
                    </span>
                    <span
                      className="mt-0.5 block"
                      style={{
                        fontFamily: T.font.sans,
                        fontSize: "14px",
                        color: T.ink.dim,
                      }}
                    >
                      {p.desc}
                    </span>
                  </span>
                  <Icon
                    icon={
                      active
                        ? "mdi:check-circle"
                        : "mdi:checkbox-blank-circle-outline"
                    }
                    className="size-5 shrink-0"
                    style={{ color: active ? T.accent.primary : T.border.hi }}
                    aria-hidden="true"
                  />
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      {/* Step 3: Credential fields */}
      {selectedLibrary && hasRef && provider && (
        <section
          aria-labelledby="event-feed-step-3"
          className="p-5 sm:p-8"
          style={cardSx}
        >
          <StepHeading
            n={3}
            id="event-feed-step-3"
            title={`${PROVIDERS.find((p2) => p2.value === provider)?.label ?? ""} credentials`}
          />
          <p className="-mt-2 mb-6 flex items-start gap-2" style={bodySx}>
            <Icon
              icon="mdi:lock-outline"
              className="mt-0.5 size-4 shrink-0"
              style={{ color: T.ink.dim }}
              aria-hidden="true"
            />
            Credentials are encrypted at rest and only used to sync events. They
            are never shared publicly.
          </p>

          <div className="flex flex-col gap-5">
            {providerFields.map((field) => {
              const inputId = `event-feed-cred-${field.key}`
              const hintId = field.hint ? `${inputId}-hint` : undefined

              return (
                <div key={field.key} className="flex flex-col gap-2">
                  <label htmlFor={inputId} style={fieldLabelStyle}>
                    {field.label}
                    <RequiredTag />
                  </label>
                  <input
                    id={inputId}
                    type={field.type}
                    required
                    aria-required
                    aria-describedby={hintId}
                    placeholder={field.placeholder ?? ""}
                    value={credFields[field.key] ?? ""}
                    onChange={(e) =>
                      setCredFields((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    style={fieldInputStyle}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {field.hint && (
                    <p id={hintId} style={fieldHintStyle}>
                      {field.hint}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Error message */}
      {status === "error" && errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2"
          style={{
            padding: "12px 16px",
            borderRadius: "14px",
            background: "#F6E3DA",
            color: T.accent.danger,
          }}
        >
          <Icon
            icon="mdi:alert-circle-outline"
            className="mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <p
            style={{
              fontFamily: T.font.sans,
              fontSize: "15px",
              fontWeight: 500,
              color: T.accent.danger,
              margin: 0,
            }}
          >
            {errorMsg}
          </p>
        </div>
      )}

      {/* Submit */}
      {selectedLibrary && hasRef && provider && (
        <button
          type="submit"
          disabled={!canSubmit || status === "submitting"}
          className="inline-flex items-center justify-center gap-2 self-stretch rounded-full bg-(--t-accent-primary) px-6 py-3 font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-50 sm:self-start"
          style={{ fontFamily: T.font.sans, fontSize: "15px" }}
        >
          <Icon
            icon="mdi:shield-check-outline"
            className="size-5"
            aria-hidden="true"
          />
          {status === "submitting" ? "Submitting…" : "Submit for review"}
        </button>
      )}
    </form>
  )
}
