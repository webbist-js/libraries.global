import { useFetchClient } from "@strapi/strapi/admin"
import React, { useCallback, useEffect, useRef, useState } from "react"

import { ImportRunDetail } from "./ImportRunDetail"

type RunRecord = {
  runId: string
  triggeredBy?: string
  startedAt?: string
  finishedAt?: string
  status: string
  stats?: {
    fetched?: number
    created?: number
    updated?: number
    unchanged?: number
    expired?: number
    pendingReview?: number
    errors?: number
  }
  providerBreakdown?: Record<string, { fetched: number; created: number }>
  failedCredentials?: {
    credentialDocumentId: string
    label?: string
    error: string
  }[]
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  success: { bg: "#eafbf2", text: "#1b7c3a" },
  partial: { bg: "#fff3e0", text: "#d97706" },
  failed: { bg: "#ffeaea", text: "#d02b20" },
  running: { bg: "#eaf5ff", text: "#0c75af" },
}

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? { bg: "#f0f0ff", text: "#4945ff" }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        borderRadius: "100px",
        fontSize: "11px",
        fontWeight: 600,
        background: colors.bg,
        color: colors.text,
      }}
    >
      {status === "running" && (
        <span
          style={{
            display: "inline-block",
            animation: "spin 1s linear infinite",
          }}
        >
          ⟳
        </span>
      )}
      {status}
    </span>
  )
}

function formatDate(iso?: string) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"

  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function durationStr(startedAt?: string, finishedAt?: string) {
  if (!startedAt || !finishedAt) return "—"
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = Math.floor((ms % 60_000) / 1000)

  return `${mins}m ${secs}s`
}

const thStyle = {
  textAlign: "left" as const,
  padding: "8px 12px",
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  color: "#666687",
  whiteSpace: "nowrap" as const,
  borderBottom: "2px solid #f0f0ff",
}

const tdStyle = {
  padding: "10px 12px",
  fontSize: "12px",
  color: "#32324d",
  verticalAlign: "middle" as const,
  borderBottom: "1px solid #f6f6f9",
}

export function ImportRunList() {
  const { get, post } = useFetchClient()
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null)
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadRuns = useCallback(async () => {
    try {
      setError(null)
      const { data } = await get("/events/admin/runs")
      const items = Array.isArray((data as any)?.data)
        ? (data as any).data
        : Array.isArray(data)
          ? (data as RunRecord[])
          : []
      setRuns(items)

      // Auto-refresh every 30s if any run is still running
      if (pollRef.current) clearTimeout(pollRef.current)
      if (items.some((r: RunRecord) => r.status === "running")) {
        pollRef.current = setTimeout(() => void loadRuns(), 30_000)
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load import runs."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [get])

  useEffect(() => {
    void loadRuns()

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const triggerSync = useCallback(async () => {
    setTriggerLoading(true)
    setTriggerMsg(null)
    try {
      await post("/events/admin/sync", {})
      setTriggerMsg("Sync command queued — worker picks up within 2 minutes.")
      setTimeout(() => void loadRuns(), 2000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to trigger sync"
      setTriggerMsg(`Error: ${msg}`)
    } finally {
      setTriggerLoading(false)
    }
  }, [post, loadRuns])

  const toggleExpand = (runId: string) => {
    setExpandedRunId((prev) => (prev === runId ? null : runId))
  }

  return (
    <div>
      {/* Header actions */}
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
          Import Runs
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {triggerMsg && (
            <span
              style={{
                fontSize: "12px",
                color: triggerMsg.startsWith("Error") ? "#d02b20" : "#1b7c3a",
              }}
            >
              {triggerMsg}
            </span>
          )}
          <button
            onClick={() => void triggerSync()}
            disabled={triggerLoading}
            style={{
              padding: "8px 16px",
              fontSize: "13px",
              fontWeight: 600,
              background: triggerLoading ? "#8e8ea9" : "#4945ff",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: triggerLoading ? "not-allowed" : "pointer",
            }}
          >
            {triggerLoading ? "Queuing…" : "⟳ Trigger Sync"}
          </button>
        </div>
      </div>

      {loading && (
        <p style={{ color: "#8e8ea9", fontSize: "13px" }}>Loading…</p>
      )}

      {error && (
        <div
          style={{
            padding: "12px 16px",
            background: "#ffeaea",
            border: "1px solid #f5c0be",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#d02b20",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && runs.length === 0 && (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "#fff",
            border: "1px solid #dcdce4",
            borderRadius: "8px",
          }}
        >
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>—</div>
          <p style={{ fontSize: "13px", color: "#666687", margin: 0 }}>
            No import runs yet. Trigger a sync above.
          </p>
        </div>
      )}

      {!loading && !error && runs.length > 0 && (
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
                  "Run ID",
                  "Triggered by",
                  "Started",
                  "Duration",
                  "Status",
                  "Created",
                  "Updated",
                  "Errors",
                ].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <React.Fragment key={run.runId}>
                  <tr
                    onClick={() => toggleExpand(run.runId)}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#fafafa")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "")
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "11px",
                          color: "#4945ff",
                        }}
                      >
                        {run.runId.slice(0, 12)}…
                      </span>
                    </td>
                    <td style={tdStyle}>{run.triggeredBy ?? "scheduler"}</td>
                    <td style={tdStyle}>{formatDate(run.startedAt)}</td>
                    <td style={tdStyle}>
                      {durationStr(run.startedAt, run.finishedAt)}
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={run.status} />
                    </td>
                    <td
                      style={{ ...tdStyle, color: "#1b7c3a", fontWeight: 600 }}
                    >
                      +{run.stats?.created ?? 0}
                    </td>
                    <td style={tdStyle}>{run.stats?.updated ?? 0}</td>
                    <td
                      style={{
                        ...tdStyle,
                        color:
                          (run.stats?.errors ?? 0) > 0 ? "#d02b20" : "#32324d",
                      }}
                    >
                      {run.stats?.errors ?? 0}
                    </td>
                  </tr>
                  {expandedRunId === run.runId && (
                    <tr key={`${run.runId}-detail`}>
                      <td colSpan={8} style={{ padding: 0 }}>
                        <ImportRunDetail run={run} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
