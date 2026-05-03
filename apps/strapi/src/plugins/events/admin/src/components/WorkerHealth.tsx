import { useFetchClient } from "@strapi/strapi/admin"
import { useCallback, useEffect, useState } from "react"

type WorkerStatus = "idle" | "running" | "offline"

type HealthData = {
  ok: boolean
  status?: WorkerStatus | "unreachable"
  lastSync?: {
    runId: string
    startedAt: string
    outcome: string
  }
  nextSync?: string
  version?: string
  cronExpression?: string
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#666687",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: "0 0 3px",
}

const valueStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#32324d",
  fontWeight: 500,
  margin: 0,
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid #f0f0ff" }}>
      <p style={labelStyle}>{label}</p>
      <p style={valueStyle}>{value}</p>
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function WorkerHealth({
  onStatusChange,
}: {
  onStatusChange?: (status: "idle" | "running" | "offline") => void
}) {
  const { get } = useFetchClient()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await get("/events/admin/worker-health")
      const h = (data as HealthData) ?? {}
      setHealth(h)
      if (onStatusChange) {
        const s: WorkerStatus =
          h.ok === false || h.status === "unreachable"
            ? "offline"
            : h.status === "running"
              ? "running"
              : "idle"
        onStatusChange(s)
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to fetch worker health.")
    } finally {
      setLoading(false)
    }
  }, [get, onStatusChange])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isOffline =
    !health || health.ok === false || health.status === "unreachable"

  const statusLabel = isOffline
    ? "Offline"
    : health?.status === "running"
      ? "Running"
      : "Idle"

  const statusColor = isOffline
    ? "#d02b20"
    : health?.status === "running"
      ? "#0c75af"
      : "#1b7c3a"
  const dotColor = isOffline ? "#d02b20" : "#1b7c3a"

  return (
    <div style={{ maxWidth: "600px" }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #dcdce4",
          borderRadius: "8px",
          padding: "24px",
          boxShadow: "0 1px 4px rgba(33,33,52,0.06)",
        }}
      >
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

        {!loading && !error && (
          <>
            {/* Status row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "24px",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: dotColor,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: statusColor,
                }}
              >
                {statusLabel}
              </span>
            </div>

            {isOffline && (
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
                Worker offline — check <code>WORKER_URL</code> environment
                variable.
              </div>
            )}

            {!isOffline && (
              <div>
                {health?.lastSync && (
                  <>
                    <MetaRow
                      label="Last sync run ID"
                      value={health.lastSync.runId}
                    />
                    <MetaRow
                      label="Last sync started"
                      value={formatDate(health.lastSync.startedAt)}
                    />
                    <MetaRow
                      label="Last sync outcome"
                      value={health.lastSync.outcome}
                    />
                  </>
                )}
                {health?.nextSync && (
                  <MetaRow
                    label="Next scheduled sync"
                    value={formatDate(health.nextSync)}
                  />
                )}
                {health?.cronExpression && (
                  <MetaRow
                    label="Cron expression"
                    value={health.cronExpression}
                  />
                )}
                {health?.version && (
                  <MetaRow label="Worker version" value={health.version} />
                )}
              </div>
            )}

            <div style={{ marginTop: "16px" }}>
              <button
                onClick={() => void load()}
                style={{
                  padding: "7px 14px",
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
          </>
        )}
      </div>
    </div>
  )
}
