import { useCallback, useEffect, useRef, useState } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

type PointEvent = {
  id: number
  baUserId: string
  action: string
  points: number
  awardedAt: string
  metadata: Record<string, unknown> | null
}

type Stats = {
  totalContributors: number
  pointsThisMonth: number
}

type DailyPoint = { date: string; points: number }

type ActionBreakdown = { action: string; count: number; totalPoints: number }

type ChartData = {
  dailyPoints: DailyPoint[]
  actionBreakdown: ActionBreakdown[]
}

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function adminFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`/rewards${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
    if (!res.ok) return null
    const json = await res.json()

    return (json.data ?? json) as T
  } catch {
    return null
  }
}

function useAdminFetch<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await adminFetch<T>(path)
    setData(result)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, reload: load }
}

// ── Action labels & colors ────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; color: string }> = {
  new_library_approved: { label: "New library", color: "#4945ff" },
  edit_accepted_major: { label: "Major edit", color: "#7b72ff" },
  edit_accepted_minor: { label: "Minor edit", color: "#a39df5" },
  wiki_translated: { label: "Wiki translation", color: "#0c75af" },
  photo_licensed_cc: { label: "CC photo", color: "#1b7c3a" },
  hours_verified: { label: "Hours verified", color: "#2d9d5f" },
  status_verified: { label: "Status verified", color: "#5dbf86" },
  daily_streak: { label: "Streak", color: "#d97706" },
  manual_award: { label: "Manual award", color: "#e8c98a" },
  manual_deduct: { label: "Manual deduct", color: "#d02b20" },
}

function actionLabel(action: string) {
  return ACTION_META[action]?.label ?? action.replaceAll("_", " ")
}

function actionColor(action: string) {
  return ACTION_META[action]?.color ?? "#8e8ea9"
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: "16px 20px",
        background: "#fff",
        border: "1px solid #dcdce4",
        borderRadius: "8px",
        borderTop: accent ? `3px solid ${accent}` : "1px solid #dcdce4",
        boxShadow: "0 1px 4px rgba(33,33,52,0.06)",
      }}
    >
      <p
        style={{
          margin: "0 0 6px",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#666687",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "28px",
          fontWeight: 700,
          color: "#32324d",
          lineHeight: 1,
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#8e8ea9" }}>
          {sub}
        </p>
      )}
    </div>
  )
}

// ── Bar chart (SVG) ───────────────────────────────────────────────────────────

function BarChart({ data }: { data: DailyPoint[] }) {
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    date: string
    points: number
  } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const W = 560
  const H = 90
  const max = Math.max(...data.map((d) => d.points), 1)
  const barW = Math.floor(W / data.length) - 2

  const formatDate = (iso: string) => {
    const d = new Date(iso)

    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  }

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "90px", overflow: "visible" }}
        onMouseLeave={() => setTooltip(null)}
      >
        {data.map((d, i) => {
          const barH = Math.max((d.points / max) * H, d.points > 0 ? 3 : 0)
          const x = i * (W / data.length)
          const y = H - barH
          const isToday = d.date === new Date().toISOString().slice(0, 10)

          return (
            <rect
              key={d.date}
              x={x + 1}
              y={y}
              width={barW}
              height={barH}
              rx={2}
              fill={isToday ? "#4945ff" : "#c0bdf8"}
              opacity={d.points === 0 ? 0.25 : 1}
              style={{ cursor: "default", transition: "opacity 0.1s" }}
              onMouseEnter={(e) => {
                const rect = svgRef.current?.getBoundingClientRect()
                if (!rect) return
                setTooltip({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top - 36,
                  date: d.date,
                  points: d.points,
                })
              }}
            />
          )
        })}
      </svg>

      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: Math.min(tooltip.x, W - 120),
            top: Math.max(tooltip.y, 0),
            background: "#32324d",
            color: "#fff",
            fontSize: "11px",
            padding: "5px 9px",
            borderRadius: "5px",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          }}
        >
          <strong>{formatDate(tooltip.date)}</strong> — {tooltip.points} pts
        </div>
      )}

      {/* X-axis: first, mid, last */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "4px",
        }}
      >
        {[data[0], data[Math.floor(data.length / 2)], data.at(-1)]
          .filter(Boolean)
          .map((d) => (
            <span key={d!.date} style={{ fontSize: "10px", color: "#8e8ea9" }}>
              {formatDate(d!.date)}
            </span>
          ))}
      </div>
    </div>
  )
}

// ── Action breakdown mini-bars ────────────────────────────────────────────────

function ActionBreakdownPanel({ data }: { data: ActionBreakdown[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
      {data.slice(0, 8).map((row) => (
        <div key={row.action}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "2px",
            }}
          >
            <span
              style={{ fontSize: "11px", color: "#32324d", fontWeight: 500 }}
            >
              {actionLabel(row.action)}
            </span>
            <span style={{ fontSize: "11px", color: "#8e8ea9" }}>
              {row.count}× · +{row.totalPoints} pts
            </span>
          </div>
          <div
            style={{
              height: "4px",
              borderRadius: "2px",
              background: "#f0f0ff",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(row.count / maxCount) * 100}%`,
                background: actionColor(row.action),
                borderRadius: "2px",
                transition: "width 500ms",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Event log ─────────────────────────────────────────────────────────────────

function EventLog({ onAward }: { onAward: (baUserId: string) => void }) {
  const [page, setPage] = useState(1)
  const [filterUser, setFilterUser] = useState("")
  const [filterAction, setFilterAction] = useState("")
  const [pendingUser, setPendingUser] = useState("")
  const [pendingAction, setPendingAction] = useState("")
  const [queryKey, setQueryKey] = useState(0)

  const path = `/events?page=${page}${filterUser ? `&baUserId=${filterUser}` : ""}${filterAction ? `&action=${filterAction}` : ""}&_k=${queryKey}`
  const { data, loading } = useAdminFetch<{
    data: PointEvent[]
    meta: { total: number; page: number; limit: number }
  }>(path, [queryKey, page])

  const events: PointEvent[] = Array.isArray(data)
    ? (data as unknown as PointEvent[])
    : (data?.data ?? [])
  const total = (data as any)?.meta?.total ?? 0
  const limit = 50

  const applyFilter = () => {
    setFilterUser(pendingUser)
    setFilterAction(pendingAction)
    setPage(1)
    setQueryKey((k) => k + 1)
  }

  const clearFilter = () => {
    setPendingUser("")
    setPendingAction("")
    setFilterUser("")
    setFilterAction("")
    setPage(1)
    setQueryKey((k) => k + 1)
  }

  const isFiltered = !!(filterUser || filterAction)

  return (
    <div>
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "16px",
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 160px", minWidth: "140px" }}>
          <p style={filterLabelStyle}>User ID</p>
          <input
            value={pendingUser}
            onChange={(e) => setPendingUser(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilter()}
            placeholder="baUserId"
            style={filterInputStyle}
          />
        </div>
        <div style={{ flex: "1 1 180px", minWidth: "150px" }}>
          <p style={filterLabelStyle}>Action</p>
          <input
            value={pendingAction}
            onChange={(e) => setPendingAction(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilter()}
            placeholder="e.g. new_library_approved"
            style={filterInputStyle}
          />
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={applyFilter} style={filterBtnStyle}>
            Filter
          </button>
          {isFiltered && (
            <button onClick={clearFilter} style={filterBtnClearStyle}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Result count */}
      {!loading && (
        <p
          style={{
            fontSize: "11px",
            color: "#8e8ea9",
            margin: "0 0 10px",
          }}
        >
          {isFiltered
            ? `${total} result${total !== 1 ? "s" : ""}`
            : `${total} total event${total !== 1 ? "s" : ""}`}
        </p>
      )}

      {/* Table */}
      {loading ? (
        <div
          style={{ padding: "32px 0", textAlign: "center", color: "#8e8ea9" }}
        >
          Loading…
        </div>
      ) : events.length === 0 ? (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "#fafafa",
            border: "1px solid #dcdce4",
            borderRadius: "8px",
          }}
        >
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>✦</div>
          <p style={{ fontSize: "14px", color: "#666687", margin: 0 }}>
            No point events yet.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f0f0ff" }}>
                {["User ID", "Action", "Points", "Awarded at", "Metadata"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "8px 12px",
                        fontSize: "11px",
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#666687",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr
                  key={ev.id}
                  style={{ borderBottom: "1px solid #f6f6f9" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#fafafa")
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontFamily: "monospace",
                        fontSize: "11px",
                        color: "#4945ff",
                        cursor: "pointer",
                        textDecoration: "underline",
                        textDecorationStyle: "dotted",
                      }}
                      title="Click to pre-fill manual award"
                      onClick={() => onAward(ev.baUserId)}
                    >
                      {ev.baUserId.slice(0, 12)}…
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "2px 8px",
                        borderRadius: "100px",
                        fontSize: "11px",
                        fontWeight: 600,
                        background: actionColor(ev.action) + "18",
                        color: actionColor(ev.action),
                        border: `1px solid ${actionColor(ev.action)}30`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {actionLabel(ev.action)}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: "13px",
                        color: ev.points < 0 ? "#d02b20" : "#1b7c3a",
                      }}
                    >
                      {ev.points > 0 ? "+" : ""}
                      {ev.points}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: "12px", color: "#666687" }}>
                      {new Date(ev.awardedAt).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: "240px" }}>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#8e8ea9",
                        fontFamily: "monospace",
                      }}
                    >
                      {ev.metadata
                        ? JSON.stringify(ev.metadata).slice(0, 80)
                        : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginTop: "16px",
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page <= 1}
            style={{ ...paginBtnStyle, opacity: page <= 1 ? 0.4 : 1 }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: "12px", color: "#666687" }}>
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page * limit >= total}
            style={{
              ...paginBtnStyle,
              opacity: page * limit >= total ? 0.4 : 1,
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

// ── Manual award sidebar widget ───────────────────────────────────────────────

function ManualAwardWidget({
  prefillUserId,
  onSuccess,
}: {
  prefillUserId: string
  onSuccess: () => void
}) {
  const [baUserId, setBaUserId] = useState(prefillUserId)
  const [mode, setMode] = useState<"award" | "deduct">("award")
  const [points, setPoints] = useState<number>(10)
  const [reason, setReason] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">(
    "idle"
  )

  useEffect(() => {
    setBaUserId(prefillUserId)
  }, [prefillUserId])

  const submit = async () => {
    if (!baUserId || !reason || !points) return
    setStatus("loading")
    try {
      const res = await fetch("/rewards/award", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baUserId,
          action: mode === "award" ? "manual_award" : "manual_deduct",
          points,
          reason,
        }),
      })
      if (res.ok) {
        setStatus("ok")
        setBaUserId("")
        setReason("")
        setPoints(10)
        setTimeout(() => {
          setStatus("idle")
          onSuccess()
        }, 1800)
      } else {
        setStatus("err")
      }
    } catch {
      setStatus("err")
    }
  }

  const canSubmit = !!(baUserId && reason && points && status !== "loading")

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <p style={sidebarLabelStyle}>User ID (baUserId)</p>
      <input
        value={baUserId}
        onChange={(e) => setBaUserId(e.target.value)}
        placeholder="better-auth user ID"
        style={filterInputStyle}
      />

      {/* Award / Deduct toggle */}
      <div>
        <p style={sidebarLabelStyle}>Action</p>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={() => setMode("award")}
            style={{
              ...modeToggleStyle,
              background: mode === "award" ? "#4945ff" : "#fff",
              color: mode === "award" ? "#fff" : "#666687",
              borderColor: mode === "award" ? "#4945ff" : "#dcdce4",
            }}
          >
            + Award
          </button>
          <button
            onClick={() => setMode("deduct")}
            style={{
              ...modeToggleStyle,
              background: mode === "deduct" ? "#d02b20" : "#fff",
              color: mode === "deduct" ? "#fff" : "#666687",
              borderColor: mode === "deduct" ? "#d02b20" : "#dcdce4",
            }}
          >
            − Deduct
          </button>
        </div>
      </div>

      <div>
        <p style={sidebarLabelStyle}>Points</p>
        <input
          type="number"
          min={1}
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          style={{ ...filterInputStyle, width: "100px" }}
        />
      </div>

      <div>
        <p style={sidebarLabelStyle}>Reason (required)</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this being applied?"
          rows={3}
          style={{
            ...filterInputStyle,
            resize: "vertical",
            width: "100%",
            fontFamily: "inherit",
          }}
        />
      </div>

      <button
        onClick={submit}
        disabled={!canSubmit}
        style={{
          padding: "9px 16px",
          borderRadius: "6px",
          border: "none",
          fontSize: "13px",
          fontWeight: 600,
          cursor: canSubmit ? "pointer" : "not-allowed",
          background:
            status === "loading"
              ? "#8e8ea9"
              : mode === "deduct"
                ? "#d02b20"
                : "#4945ff",
          color: "#fff",
          opacity: canSubmit ? 1 : 0.5,
          transition: "background 0.15s",
        }}
      >
        {status === "loading"
          ? "Saving…"
          : mode === "award"
            ? "Award Points"
            : "Deduct Points"}
      </button>

      {status === "ok" && (
        <p style={{ fontSize: "12px", color: "#1b7c3a", margin: 0 }}>
          ✓ Points updated successfully.
        </p>
      )}
      {status === "err" && (
        <p style={{ fontSize: "12px", color: "#d02b20", margin: 0 }}>
          Something went wrong. Check server logs.
        </p>
      )}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const filterLabelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#666687",
  margin: "0 0 4px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
}

const sidebarLabelStyle: React.CSSProperties = {
  ...filterLabelStyle,
  margin: 0,
}

const filterInputStyle: React.CSSProperties = {
  padding: "7px 10px",
  fontSize: "13px",
  color: "#32324d",
  background: "#fff",
  border: "1px solid #dcdce4",
  borderRadius: "6px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
}

const filterBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: "13px",
  fontWeight: 600,
  background: "#4945ff",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
}

const filterBtnClearStyle: React.CSSProperties = {
  ...filterBtnStyle,
  background: "#fff",
  color: "#666687",
  border: "1px solid #dcdce4",
}

const tdStyle: React.CSSProperties = {
  padding: "9px 12px",
  verticalAlign: "middle",
}

const paginBtnStyle: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 500,
  background: "#fff",
  border: "1px solid #dcdce4",
  borderRadius: "6px",
  cursor: "pointer",
  color: "#32324d",
}

const modeToggleStyle: React.CSSProperties = {
  padding: "6px 14px",
  fontSize: "12px",
  fontWeight: 600,
  borderRadius: "6px",
  border: "1px solid",
  cursor: "pointer",
  transition: "all 0.12s",
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export function RewardsDashboard() {
  const [awardRefresh, setAwardRefresh] = useState(0)
  const [prefillUserId, setPrefillUserId] = useState("")

  const { data: stats, loading: statsLoading } = useAdminFetch<Stats>(
    "/stats",
    [awardRefresh]
  )
  const { data: chartData, loading: chartLoading } = useAdminFetch<ChartData>(
    "/chart-data",
    [awardRefresh]
  )

  const dailyPoints: DailyPoint[] = chartData?.dailyPoints ?? []
  const actionBreakdown: ActionBreakdown[] = chartData?.actionBreakdown ?? []

  const totalEvents = actionBreakdown.reduce((s, r) => s + r.count, 0)
  const topAction = actionBreakdown[0]

  const handleAwardSuccess = () => setAwardRefresh((n) => n + 1)

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f6f9",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #dcdce4",
          padding: "20px 32px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "24px",
                fontWeight: 700,
                color: "#32324d",
                lineHeight: 1.1,
              }}
            >
              Rewards
            </h1>
            <p
              style={{ margin: "3px 0 0", fontSize: "13px", color: "#8e8ea9" }}
            >
              Points, tiers, badges and leaderboard management
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 32px", maxWidth: "1400px" }}>
        {/* Two-column layout: main + sidebar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 300px",
            gap: "24px",
            alignItems: "start",
          }}
        >
          {/* ── Main column ── */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            {/* Stat cards row */}
            <div style={{ display: "flex", gap: "12px" }}>
              <StatCard
                label="Contributors"
                value={statsLoading ? "—" : (stats?.totalContributors ?? 0)}
                sub="unique users with points"
                accent="#4945ff"
              />
              <StatCard
                label="Points this month"
                value={statsLoading ? "—" : (stats?.pointsThisMonth ?? 0)}
                sub={new Date().toLocaleString("en-GB", {
                  month: "long",
                  year: "numeric",
                })}
                accent="#7b72ff"
              />
              <StatCard
                label="Total events"
                value={chartLoading ? "—" : totalEvents}
                sub="all-time point events"
                accent="#0c75af"
              />
              <StatCard
                label="Top action"
                value={chartLoading || !topAction ? "—" : topAction.count}
                sub={
                  topAction
                    ? `${actionLabel(topAction.action)} events`
                    : "no data yet"
                }
                accent="#1b7c3a"
              />
            </div>

            {/* Daily points chart */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #dcdce4",
                borderRadius: "8px",
                padding: "20px 24px",
                boxShadow: "0 1px 4px rgba(33,33,52,0.06)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#32324d",
                    }}
                  >
                    Points awarded — last 30 days
                  </p>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "10px",
                      height: "10px",
                      borderRadius: "2px",
                      background: "#4945ff",
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "#8e8ea9" }}>
                    Today
                  </span>
                  <span
                    style={{
                      display: "inline-block",
                      width: "10px",
                      height: "10px",
                      borderRadius: "2px",
                      background: "#c0bdf8",
                      marginLeft: "8px",
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "#8e8ea9" }}>
                    Prior days
                  </span>
                </div>
              </div>

              {chartLoading ? (
                <div
                  style={{
                    height: "110px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#8e8ea9",
                    fontSize: "13px",
                  }}
                >
                  Loading chart…
                </div>
              ) : dailyPoints.length > 0 ? (
                <BarChart data={dailyPoints} />
              ) : (
                <div
                  style={{
                    height: "90px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#8e8ea9",
                    fontSize: "13px",
                  }}
                >
                  No data yet
                </div>
              )}
            </div>

            {/* Event log */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #dcdce4",
                borderRadius: "8px",
                padding: "20px 24px",
                boxShadow: "0 1px 4px rgba(33,33,52,0.06)",
              }}
            >
              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#32324d",
                }}
              >
                Event log
              </p>
              <EventLog
                onAward={(uid) => {
                  setPrefillUserId(uid)
                  // Scroll to sidebar
                  document
                    .getElementById("reward-sidebar")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }}
              />
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div
            id="reward-sidebar"
            style={{ display: "flex", flexDirection: "column", gap: "16px" }}
          >
            {/* Action breakdown */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #dcdce4",
                borderRadius: "8px",
                padding: "18px 20px",
                boxShadow: "0 1px 4px rgba(33,33,52,0.06)",
              }}
            >
              <p
                style={{
                  margin: "0 0 14px",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#666687",
                }}
              >
                Action breakdown
              </p>
              {chartLoading ? (
                <p style={{ fontSize: "12px", color: "#8e8ea9", margin: 0 }}>
                  Loading…
                </p>
              ) : actionBreakdown.length === 0 ? (
                <p style={{ fontSize: "12px", color: "#8e8ea9", margin: 0 }}>
                  No events yet.
                </p>
              ) : (
                <ActionBreakdownPanel data={actionBreakdown} />
              )}
            </div>

            {/* Manual award */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #dcdce4",
                borderRadius: "8px",
                padding: "18px 20px",
                boxShadow: "0 1px 4px rgba(33,33,52,0.06)",
              }}
            >
              <p
                style={{
                  margin: "0 0 14px",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#666687",
                }}
              >
                Manual award / deduct
              </p>
              <ManualAwardWidget
                prefillUserId={prefillUserId}
                onSuccess={handleAwardSuccess}
              />
            </div>

            {/* Points legend */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #dcdce4",
                borderRadius: "8px",
                padding: "18px 20px",
                boxShadow: "0 1px 4px rgba(33,33,52,0.06)",
              }}
            >
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#666687",
                }}
              >
                Point values
              </p>
              {[
                { label: "New library approved", pts: 50 },
                { label: "Major edit (4+ fields)", pts: 15 },
                { label: "Wiki translation", pts: 15 },
                { label: "Minor edit (1–3 fields)", pts: 5 },
                { label: "Hours/status verified", pts: 5 },
                { label: "CC-licensed photo", pts: 8 },
                { label: "Daily streak", pts: 1 },
              ].map(({ label, pts }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "5px 0",
                    borderBottom: "1px solid #f6f6f9",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "#32324d" }}>
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#4945ff",
                    }}
                  >
                    +{pts}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
