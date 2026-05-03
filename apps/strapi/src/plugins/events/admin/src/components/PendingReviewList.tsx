// apps/strapi/src/plugins/events/admin/src/components/PendingReviewList.tsx
import { useFetchClient } from "@strapi/strapi/admin"
import { type CSSProperties, useCallback, useEffect, useState } from "react"

type PendingEvent = {
  documentId: string
  title: string
  startTime?: string
  libraryEntityRef?: string
  sourceProvider?: string
  url?: string
  venueMatchConfidence?: number
  venueName?: string
  matchedLibraryName?: string
}

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "8px 12px",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#666687",
  whiteSpace: "nowrap",
  borderBottom: "2px solid #f0f0ff",
}

const tdStyle: CSSProperties = {
  padding: "10px 12px",
  fontSize: "12px",
  color: "#32324d",
  verticalAlign: "middle",
  borderBottom: "1px solid #f6f6f9",
}

const PROVIDER_COLORS: Record<string, string> = {
  eventbrite: "#ff6060",
  ical: "#1b7c3a",
  custom_ical: "#1b7c3a",
  meetup: "#e8174b",
  google_events: "#4285f4",
  facebook_events: "#1877f2",
  librarycloud: "#0c75af",
}

function ProviderBadge({ provider }: { provider: string }) {
  const color = PROVIDER_COLORS[provider] ?? "#8e8ea9"

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: "4px",
        fontSize: "10px",
        fontWeight: 700,
        background: color + "18",
        color,
        border: `1px solid ${color}40`,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {provider.replace("_", " ")}
    </span>
  )
}

function ConfidenceBadge({ confidence }: { confidence?: number }) {
  if (confidence === undefined)
    return <span style={{ color: "#c0c0cf" }}>—</span>
  const pct = Math.round(confidence * 100)
  const color = pct >= 80 ? "#1b7c3a" : pct >= 50 ? "#d97706" : "#d02b20"

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: "100px",
        fontSize: "11px",
        fontWeight: 600,
        background: color + "15",
        color,
        border: `1px solid ${color}30`,
      }}
    >
      {pct}%
    </span>
  )
}

function formatDate(iso?: string) {
  if (!iso) return "—"

  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function PendingReviewList({
  onCountChange,
}: {
  onCountChange?: (count: number) => void
}) {
  const { get, patch } = useFetchClient()
  const [events, setEvents] = useState<PendingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>(
    {}
  )
  const [fadingOut, setFadingOut] = useState<Set<string>>(new Set())

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await get("/events/admin/pending-review")
      const items = Array.isArray((data as any)?.data)
        ? (data as any).data
        : Array.isArray(data)
          ? data
          : []
      setEvents(items as PendingEvent[])
      onCountChange?.(items.length)
    } catch (err: any) {
      setError(err?.message ?? "Failed to load pending review queue.")
    } finally {
      setLoading(false)
    }
  }, [get, onCountChange])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  const handleAction = async (
    documentId: string,
    action: "approve" | "discard"
  ) => {
    setActionLoading((prev) => ({ ...prev, [documentId]: true }))
    try {
      await patch(`/events/admin/pending-review/${documentId}`, { action })
      // Fade out row, then remove
      setFadingOut((prev) => new Set(prev).add(documentId))
      setTimeout(() => {
        setEvents((prev) => {
          const updated = prev.filter((e) => e.documentId !== documentId)
          onCountChange?.(updated.length)

          return updated
        })
        setFadingOut((prev) => {
          const next = new Set(prev)
          next.delete(documentId)

          return next
        })
      }, 350)
    } catch (err: any) {
      setError(`Action failed: ${err?.message ?? "unknown error"}`)
    } finally {
      setActionLoading((prev) => ({ ...prev, [documentId]: false }))
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 600,
            color: "#32324d",
          }}
        >
          Pending Review Queue
        </p>
        <button
          onClick={() => {
            void loadEvents()
          }}
          style={{
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 500,
            background: "#fff",
            border: "1px solid #dcdce4",
            borderRadius: "6px",
            cursor: "pointer",
            color: "#32324d",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "#ffeaea",
            border: "1px solid #f5c0be",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#d02b20",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {loading && (
        <p style={{ color: "#8e8ea9", fontSize: "13px" }}>Loading…</p>
      )}

      {!loading && events.length === 0 && (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "#fff",
            border: "1px solid #dcdce4",
            borderRadius: "8px",
          }}
        >
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>✓</div>
          <p style={{ fontSize: "14px", color: "#666687", margin: 0 }}>
            Queue is clear — no events pending review.
          </p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #dcdce4",
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 1px 4px rgba(33,33,52,0.06)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[
                  "Event",
                  "Venue",
                  "Matched Library",
                  "Confidence",
                  "Date",
                  "Actions",
                ].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr
                  key={ev.documentId}
                  style={{
                    opacity: fadingOut.has(ev.documentId) ? 0 : 1,
                    transition: "opacity 0.35s",
                  }}
                >
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, marginBottom: "3px" }}>
                      {ev.title}
                    </div>
                    <ProviderBadge provider={ev.sourceProvider ?? "unknown"} />
                  </td>
                  <td style={tdStyle}>{ev.venueName ?? "—"}</td>
                  <td style={tdStyle}>
                    {ev.matchedLibraryName ? (
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          {ev.matchedLibraryName}
                        </div>
                        {ev.libraryEntityRef && (
                          <div
                            style={{
                              fontSize: "11px",
                              fontFamily: "monospace",
                              color: "#8e8ea9",
                            }}
                          >
                            {ev.libraryEntityRef}
                          </div>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={tdStyle}>
                    <ConfidenceBadge confidence={ev.venueMatchConfidence} />
                  </td>
                  <td style={tdStyle}>{formatDate(ev.startTime)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() =>
                          void handleAction(ev.documentId, "approve")
                        }
                        disabled={actionLoading[ev.documentId]}
                        style={{
                          padding: "5px 10px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: "#eafbf2",
                          color: "#1b7c3a",
                          border: "1px solid #a5dfc0",
                          borderRadius: "5px",
                          cursor: actionLoading[ev.documentId]
                            ? "not-allowed"
                            : "pointer",
                          opacity: actionLoading[ev.documentId] ? 0.5 : 1,
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          void handleAction(ev.documentId, "discard")
                        }
                        disabled={actionLoading[ev.documentId]}
                        style={{
                          padding: "5px 10px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: "#ffeaea",
                          color: "#d02b20",
                          border: "1px solid #f5c0be",
                          borderRadius: "5px",
                          cursor: actionLoading[ev.documentId]
                            ? "not-allowed"
                            : "pointer",
                          opacity: actionLoading[ev.documentId] ? 0.5 : 1,
                        }}
                      >
                        Discard
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
