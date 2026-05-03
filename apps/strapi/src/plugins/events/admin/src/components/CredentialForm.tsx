// apps/strapi/src/plugins/events/admin/src/components/CredentialForm.tsx
import { useFetchClient } from "@strapi/strapi/admin"
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

type Library = {
  documentId: string
  name: string
  entityRef?: string
}

type Credential = {
  documentId: string
  label: string
  provider: string
  scope: string
  isActive: boolean
  libraries?: Library[]
}

// ── Provider field definitions ────────────────────────────────────────────────

type FieldDef = { key: string; label: string; type: "text" | "password" }

const PROVIDER_FIELDS: Record<string, FieldDef[]> = {
  eventbrite: [
    { key: "apiKey", label: "API Key (private token)", type: "password" },
    { key: "orgId", label: "Organisation ID", type: "text" },
  ],
  ical: [{ key: "feedUrl", label: "Feed URL", type: "text" }],
  custom_ical: [{ key: "feedUrl", label: "Feed URL", type: "text" }],
  meetup: [{ key: "apiKey", label: "API Key", type: "password" }],
  google_events: [
    { key: "apiKey", label: "API Key", type: "password" },
    { key: "calendarId", label: "Calendar ID", type: "text" },
  ],
  facebook_events: [
    { key: "accessToken", label: "Access Token", type: "password" },
    { key: "pageId", label: "Page ID", type: "text" },
  ],
  librarycloud: [{ key: "apiKey", label: "API Key", type: "password" }],
}

const PROVIDERS = [
  { value: "eventbrite", label: "Eventbrite" },
  { value: "ical", label: "iCal" },
  { value: "custom_ical", label: "Custom iCal" },
  { value: "meetup", label: "Meetup" },
  { value: "google_events", label: "Google Events" },
  { value: "facebook_events", label: "Facebook Events" },
  { value: "librarycloud", label: "LibraryCloud" },
]

// ── Shared input styles ───────────────────────────────────────────────────────

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: "13px",
  color: "#32324d",
  background: "#fff",
  border: "1px solid #dcdce4",
  borderRadius: "6px",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
}

const labelStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#666687",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "4px",
  display: "block",
}

const sectionHeadingStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#4945ff",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: "0 0 10px",
  paddingBottom: "6px",
  borderBottom: "1px solid #f0f0ff",
}

// ── Library search multi-select ───────────────────────────────────────────────

function LibrarySearch({
  selected,
  onChange,
  maxOne,
}: {
  selected: Library[]
  onChange: (libs: Library[]) => void
  maxOne: boolean
}) {
  const { get } = useFetchClient()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Library[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const search = useCallback(
    async (q: string) => {
      if (!q || q.length < 2) {
        setResults([])

        return
      }
      setSearching(true)
      try {
        const { data } = await get(
          `/api/libraries?filters[name][$containsi]=${encodeURIComponent(q)}&pagination[pageSize]=10&fields[0]=name&fields[1]=entityRef`
        )
        const items = (data as any)?.data ?? []
        setResults(
          items.map((item: any) => ({
            documentId: item.documentId,
            name: item.name,
            entityRef: item.entityRef,
          }))
        )
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    },
    [get]
  )

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void search(val), 300)
  }

  const addLibrary = (lib: Library) => {
    if (selected.some((s) => s.documentId === lib.documentId)) return
    if (maxOne) {
      onChange([lib])
    } else {
      onChange([...selected, lib])
    }
    setQuery("")
    setResults([])
  }

  const removeLibrary = (documentId: string) => {
    onChange(selected.filter((s) => s.documentId !== documentId))
  }

  return (
    <div>
      {/* Selected tags */}
      {selected.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            marginBottom: "8px",
          }}
        >
          {selected.map((lib) => (
            <span
              key={lib.documentId}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "3px 8px",
                borderRadius: "100px",
                background: "#f0f0ff",
                border: "1px solid #c4c4ff",
                fontSize: "12px",
                color: "#4945ff",
                fontWeight: 500,
              }}
            >
              {lib.name}
              {lib.entityRef && (
                <span style={{ color: "#8e8ea9", fontSize: "10px" }}>
                  {lib.entityRef}
                </span>
              )}
              <button
                onClick={() => removeLibrary(lib.documentId)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#8e8ea9",
                  fontSize: "14px",
                  lineHeight: 1,
                  padding: "0 2px",
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      {(!maxOne || selected.length === 0) && (
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={query}
            onChange={handleInput}
            placeholder="Search libraries by name…"
            style={inputStyle}
          />
          {searching && (
            <span
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "11px",
                color: "#8e8ea9",
              }}
            >
              Searching…
            </span>
          )}
          {results.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "#fff",
                border: "1px solid #dcdce4",
                borderRadius: "6px",
                boxShadow: "0 4px 12px rgba(33,33,52,0.12)",
                zIndex: 100,
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {results.map((lib) => (
                <div
                  key={lib.documentId}
                  onClick={() => addLibrary(lib)}
                  style={{
                    padding: "9px 12px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid #f6f6f9",
                    fontSize: "13px",
                    color: "#32324d",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#f0f0ff")
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <span>{lib.name}</span>
                  {lib.entityRef && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontFamily: "monospace",
                        color: "#8e8ea9",
                      }}
                    >
                      {lib.entityRef}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function CredentialForm({
  credential,
  onSaved,
  onCancel,
}: {
  credential: Credential | null
  onSaved: () => void
  onCancel: () => void
}) {
  const { post, put } = useFetchClient()
  const isEdit = !!credential

  // Form state
  const [label, setLabel] = useState(credential?.label ?? "")
  const [provider, setProvider] = useState(credential?.provider ?? "eventbrite")
  const [scope, setScope] = useState(credential?.scope ?? "library")
  const [isActive, setIsActive] = useState(credential?.isActive ?? true)
  const [credFields, setCredFields] = useState<Record<string, string>>({})
  const [selectedLibraries, setSelectedLibraries] = useState<Library[]>(
    credential?.libraries ?? []
  )

  // UI state
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{
    ok: boolean
    message?: string
    error?: string
  } | null>(null)

  // Reset cred fields when provider changes
  useEffect(() => {
    setCredFields({})
    setTestResult(null)
  }, [provider])

  const providerFields = PROVIDER_FIELDS[provider] ?? []

  const setField = (key: string, value: string) => {
    setCredFields((prev) => ({ ...prev, [key]: value }))
  }

  const allCredsPresent = providerFields.every((f) => credFields[f.key]?.trim())

  const handleSave = async () => {
    if (!label.trim()) {
      setSaveError("Label is required.")

      return
    }
    setSaving(true)
    setSaveError(null)
    setTestResult(null)
    try {
      const hasCredentials = Object.keys(credFields).length > 0
      const payload = {
        label: label.trim(),
        provider,
        scope,
        isActive,
        libraryDocumentIds: selectedLibraries.map((l) => l.documentId),
        ...(hasCredentials ? { credentials: credFields } : {}),
      }

      await (isEdit
        ? put(`/events/admin/credentials/${credential!.documentId}`, payload)
        : post("/events/admin/credentials", payload))
      onSaved()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Save failed — check server logs."
      setSaveError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTestLoading(true)
    setSaveError(null)
    setTestResult(null)
    try {
      let data: { ok: boolean; message?: string; error?: string }
      if (isEdit) {
        const res = await post(
          `/events/admin/credentials/${credential!.documentId}/test`,
          {}
        )
        data = res.data as typeof data
      } else {
        const res = await post("/events/admin/credentials/test-raw", {
          provider,
          credentials: credFields,
        })
        data = res.data as typeof data
      }
      setTestResult(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Test failed"
      setTestResult({ ok: false, error: message })
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(33,33,52,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving && !testLoading) onCancel()
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          width: "520px",
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 8px 32px rgba(33,33,52,0.20)",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid #f0f0ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 700,
              color: "#32324d",
            }}
          >
            {isEdit ? "Edit Credential" : "Add Credential"}
          </p>
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#8e8ea9",
              fontSize: "20px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Modal body — scrollable */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Label */}
          <div>
            <label style={labelStyle}>Label *</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. British Library — Eventbrite"
              style={inputStyle}
            />
          </div>

          {/* Provider */}
          <div>
            <label style={labelStyle}>Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              style={inputStyle}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Scope */}
          <div>
            <label style={labelStyle}>Scope</label>
            <div style={{ display: "flex", gap: "16px" }}>
              {[
                { value: "library", label: "Library (single)" },
                { value: "group", label: "Group (venue match)" },
              ].map(({ value, label: optLabel }) => (
                <label
                  key={value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "13px",
                    color: "#32324d",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                  />
                  {optLabel}
                </label>
              ))}
            </div>
          </div>

          {/* Libraries */}
          <div>
            <label style={labelStyle}>
              {scope === "library" ? "Library" : "Libraries"}
            </label>
            <LibrarySearch
              selected={selectedLibraries}
              onChange={setSelectedLibraries}
              maxOne={scope === "library"}
            />
          </div>

          {/* Dynamic credential fields */}
          {providerFields.length > 0 && (
            <div>
              <p style={sectionHeadingStyle}>
                {PROVIDERS.find((p) => p.value === provider)?.label ?? provider}{" "}
                Credentials
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {providerFields.map((field) => (
                  <div key={field.key}>
                    <label style={labelStyle}>{field.label}</label>
                    <input
                      type={field.type}
                      value={credFields[field.key] ?? ""}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={
                        field.type === "password" ? "••••••••••••••••" : ""
                      }
                      style={inputStyle}
                      autoComplete="off"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              color: "#32324d",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active (include in sync runs)
          </label>
        </div>

        {/* Modal footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #f0f0ff",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <button
            onClick={onCancel}
            disabled={saving || testLoading}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              background: "#fff",
              color: "#666687",
              border: "1px solid #dcdce4",
              borderRadius: "6px",
              cursor: saving || testLoading ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>

          <button
            onClick={() => void handleTest()}
            disabled={testLoading || (!isEdit && !allCredsPresent)}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              background: "#fff",
              color: "#4945ff",
              border: "1px solid #c4c4ff",
              borderRadius: "6px",
              cursor:
                testLoading || (!isEdit && !allCredsPresent)
                  ? "not-allowed"
                  : "pointer",
              opacity: testLoading || (!isEdit && !allCredsPresent) ? 0.5 : 1,
            }}
          >
            {testLoading ? "Testing…" : "Test Connection"}
          </button>

          <button
            onClick={() => void handleSave()}
            disabled={saving || !label.trim()}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              background: saving || !label.trim() ? "#8e8ea9" : "#4945ff",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: saving || !label.trim() ? "not-allowed" : "pointer",
              marginLeft: "auto",
            }}
          >
            {saving ? "Saving…" : "Save Credential"}
          </button>
        </div>

        {/* Test + save error feedback */}
        {(testResult || saveError) && (
          <div style={{ padding: "0 24px 16px" }}>
            {testResult && (
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: "12px",
                  color: testResult.ok ? "#1b7c3a" : "#d02b20",
                }}
              >
                {testResult.ok
                  ? `✓ ${testResult.message ?? "Connection OK"}`
                  : `✗ ${testResult.error ?? "Test failed"}`}
              </p>
            )}
            {saveError && (
              <p style={{ margin: 0, fontSize: "12px", color: "#d02b20" }}>
                {saveError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
