"use client"

import { Icon } from "@iconify/react"
import { useEffect, useRef, useState } from "react"

import { T } from "@/lib/design-tokens"
import { meiliClient, type LibrarySearchHit } from "@/lib/meilisearch"

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

// ── Shared input style ─────────────────────────────────────────────────────────

const inputSx: React.CSSProperties = {
  fontFamily: T.font.sans,
  fontSize: "13px",
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
  borderRadius: "10px",
  color: T.ink.base,
  padding: "10px 14px",
  width: "100%",
  outline: "none",
  boxSizing: "border-box",
}

const labelSx: React.CSSProperties = {
  fontFamily: T.font.sans,
  fontSize: "13px",
  color: T.ink.faint,
  display: "block",
  marginBottom: "6px",
}

const hintSx: React.CSSProperties = {
  fontFamily: T.font.sans,
  fontSize: "13px",
  color: T.ink.faint,
  marginTop: "5px",
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
        className="flex flex-col items-center gap-4 rounded-2xl border p-12 text-center"
        style={{ borderColor: T.border.line, background: T.bg.deep }}
      >
        <Icon
          icon="mdi:check-circle-outline"
          className="size-12"
          style={{ color: T.accent.ok }}
        />
        <p
          style={{
            fontFamily: T.font.serif,
            fontSize: "1.4rem",
            fontWeight: 400,
            color: T.ink.base,
          }}
        >
          Credential submitted for review.
        </p>
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.ink.faint,
            maxWidth: "400px",
            lineHeight: 1.6,
          }}
        >
          Our team will review and activate your{" "}
          {PROVIDERS.find((p) => p.value === provider)?.label ?? provider}{" "}
          connection for{" "}
          <strong style={{ color: T.ink.dim }}>{selectedLibrary?.name}</strong>{" "}
          within 48 hours. Events will then start appearing automatically.
        </p>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {/* Step 1: Library selection */}
      <div
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          padding: "20px",
          background: T.bg.deep,
        }}
      >
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.accent.aurora,
            marginBottom: "16px",
          }}
        >
          Step 1 · Select your library
        </p>

        {selectedLibrary ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderRadius: "10px",
              border: `1px solid ${T.border.hi}`,
              background: T.bg.surface,
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: T.font.sans,
                  fontSize: "14px",
                  fontWeight: 500,
                  color: T.ink.base,
                  margin: 0,
                }}
              >
                {selectedLibrary.name}
              </p>
              <p
                style={{
                  fontFamily: T.font.sans,
                  fontSize: "13px",
                  color: T.ink.faint,
                  margin: "3px 0 0",
                }}
              >
                {[selectedLibrary.city, selectedLibrary.country_name]
                  .filter(Boolean)
                  .join(", ")}
                {selectedLibrary.entityRef && (
                  <span style={{ marginLeft: "10px", color: T.ink.faint }}>
                    {selectedLibrary.entityRef}
                  </span>
                )}
              </p>
              {!selectedLibrary.entityRef && (
                <p
                  style={{
                    fontFamily: T.font.sans,
                    fontSize: "13px",
                    color: T.accent.warn,
                    marginTop: "4px",
                  }}
                >
                  ⚠ This library has no entity ref — cannot submit
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={clearLibrary}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: T.ink.faint,
                fontFamily: T.font.sans,
                fontSize: "13px",
                padding: "4px 8px",
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Country filter */}
            <div>
              <label style={labelSx}>Filter by country</label>
              <select
                value={countrySlug}
                onChange={(e) => {
                  setCountrySlug(e.target.value)
                  setLibraryResults([])
                }}
                style={inputSx}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Library search */}
            <div ref={containerRef} style={{ position: "relative" }}>
              <label style={labelSx}>Search library name *</label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  value={libraryQuery}
                  onChange={(e) => setLibraryQuery(e.target.value)}
                  placeholder="Start typing your library name…"
                  style={inputSx}
                  autoComplete="off"
                />
                {librarySearching && (
                  <span
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontFamily: T.font.sans,
                      fontSize: "13px",
                      color: T.ink.faint,
                    }}
                  >
                    Searching…
                  </span>
                )}
              </div>

              {dropdownOpen && libraryResults.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "rgba(6,9,22,.97)",
                    backdropFilter: "blur(16px)",
                    border: `1px solid ${T.border.hi}`,
                    borderTop: "none",
                    borderRadius: "0 0 10px 10px",
                    zIndex: 50,
                    overflow: "hidden",
                  }}
                >
                  {libraryResults.map((hit, i) => (
                    <button
                      key={hit.documentId}
                      type="button"
                      onClick={() => selectLibrary(hit)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "11px 14px",
                        background: "none",
                        border: "none",
                        borderTop:
                          i > 0 ? `1px solid ${T.border.line}` : undefined,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                      }}
                      className="hover:bg-(--t-bg-surface)"
                    >
                      <span
                        style={{
                          fontFamily: T.font.sans,
                          fontSize: "13px",
                          color: T.ink.base,
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {hit.name}
                      </span>
                      <span
                        style={{
                          fontFamily: T.font.sans,
                          fontSize: "13px",
                          color: T.ink.faint,
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {[hit.city, hit.country_name]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Provider selection */}
      {selectedLibrary && selectedLibrary.entityRef && (
        <div
          style={{
            border: `1px solid ${T.border.line}`,
            borderRadius: "12px",
            padding: "20px",
            background: T.bg.deep,
          }}
        >
          <p
            style={{
              fontFamily: T.font.sans,
              fontSize: "13px",
              color: T.accent.aurora,
              marginBottom: "16px",
            }}
          >
            Step 2 · Event platform
          </p>
          <div className="flex flex-col gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setProvider(p.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: `1px solid ${provider === p.value ? T.border.hi : T.border.line}`,
                  background:
                    provider === p.value
                      ? "var(--t-aurora-soft)"
                      : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 120ms, background 120ms",
                }}
                className={
                  provider !== p.value
                    ? "hover:border-(--t-border-hi)"
                    : undefined
                }
              >
                <div>
                  <p
                    style={{
                      fontFamily: T.font.sans,
                      fontSize: "12px",
                      color:
                        provider === p.value ? T.accent.aurora : T.ink.base,
                      margin: 0,
                      fontWeight: 500,
                    }}
                  >
                    {p.label}
                  </p>
                  <p
                    style={{
                      fontFamily: T.font.sans,
                      fontSize: "13px",
                      color: T.ink.faint,
                      margin: "2px 0 0",
                    }}
                  >
                    {p.desc}
                  </p>
                </div>
                {provider === p.value && (
                  <Icon
                    icon="mdi:check-circle"
                    style={{ color: T.accent.aurora, flexShrink: 0 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Credential fields */}
      {selectedLibrary && selectedLibrary.entityRef && provider && (
        <div
          style={{
            border: `1px solid ${T.border.line}`,
            borderRadius: "12px",
            padding: "20px",
            background: T.bg.deep,
          }}
        >
          <p
            style={{
              fontFamily: T.font.sans,
              fontSize: "13px",
              color: T.accent.aurora,
              marginBottom: "4px",
            }}
          >
            Step 3 · {PROVIDERS.find((p2) => p2.value === provider)?.label}{" "}
            credentials
          </p>
          <p
            style={{
              fontFamily: T.font.sans,
              fontSize: "13px",
              color: T.ink.faint,
              marginBottom: "16px",
              lineHeight: 1.5,
            }}
          >
            Credentials are encrypted at rest and only used to sync events. They
            are never shared publicly.
          </p>

          <div className="flex flex-col gap-5">
            {providerFields.map((field) => (
              <div key={field.key}>
                <label style={labelSx}>{field.label} *</label>
                <input
                  type={field.type}
                  required
                  placeholder={field.placeholder ?? ""}
                  value={credFields[field.key] ?? ""}
                  onChange={(e) =>
                    setCredFields((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  style={inputSx}
                  autoComplete="off"
                  spellCheck={false}
                />
                {field.hint && <p style={hintSx}>{field.hint}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error message */}
      {status === "error" && errorMsg && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "10px",
            border: `1px solid ${T.accent.danger}30`,
            background: `${T.accent.danger}10`,
          }}
        >
          <p
            style={{
              fontFamily: T.font.sans,
              fontSize: "13px",
              color: T.accent.danger,
              margin: 0,
            }}
          >
            {errorMsg}
          </p>
        </div>
      )}

      {/* Submit */}
      {selectedLibrary && selectedLibrary.entityRef && provider && (
        <button
          type="submit"
          disabled={!canSubmit || status === "submitting"}
          className="inline-flex items-center gap-2 self-start rounded-full px-6 py-3 text-sm transition-all duration-150 hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            fontFamily: T.font.sans,
            background: "var(--t-aurora-soft)",
            border: "1px solid var(--t-aurora-edge)",
            color: T.accent.aurora,
          }}
        >
          <Icon icon="mdi:shield-check-outline" className="size-4" />
          {status === "submitting" ? "Submitting…" : "Submit for review"}
        </button>
      )}
    </form>
  )
}
