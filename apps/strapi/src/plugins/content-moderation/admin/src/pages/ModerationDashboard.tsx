import { useEffect, useState } from "react"

const STATUS_COLORS: Record<string, string> = {
  pending: "#ffcf7a",
  approved: "#8ef0b3",
  rejected: "#ff8a8a",
  needs_info: "#a390ff",
}

export function ModerationDashboard() {
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("pending")

  useEffect(() => {
    fetch(`/api/content-moderation/submissions?status=${filter}`, {
      headers: { "Content-Type": "application/json" },
    })
      .then((r) => r.json())
      .then((json) => setSubmissions(json.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filter])

  const updateStatus = async (
    id: string,
    status: string,
    reviewNote?: string
  ) => {
    await fetch(`/api/content-moderation/submissions/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewNote }),
    })
    setSubmissions((prev) => prev.filter((s) => s.documentId !== id))
  }

  return (
    <div style={{ padding: "32px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "24px" }}>
        Moderation Queue
      </h1>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {["pending", "approved", "rejected", "needs_info"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: `1px solid ${filter === s ? STATUS_COLORS[s] : "#ccc"}`,
              background:
                filter === s ? STATUS_COLORS[s] + "22" : "transparent",
              color: filter === s ? STATUS_COLORS[s] : "#666",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading && <p>Loading…</p>}

      {!loading && submissions.length === 0 && (
        <p style={{ color: "#888" }}>No {filter} submissions.</p>
      )}

      {submissions.map((sub) => (
        <div
          key={sub.documentId}
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "16px",
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: STATUS_COLORS[sub.status] ?? "#888",
                  marginRight: "8px",
                }}
              >
                {sub.submissionType}
              </span>
              <span style={{ fontSize: "12px", color: "#888" }}>
                by {sub.submittedByEmail} ·{" "}
                {new Date(sub.createdAt).toLocaleDateString()}
              </span>
            </div>
            {sub.targetSlug && (
              <span style={{ fontSize: "12px", color: "#555" }}>
                Target: {sub.targetEntityType} / {sub.targetSlug}
              </span>
            )}
          </div>

          {sub.note && (
            <p
              style={{ fontSize: "13px", color: "#444", marginBottom: "12px" }}
            >
              {sub.note}
            </p>
          )}

          {sub.fields && (
            <pre
              style={{
                background: "#f8f8f8",
                padding: "12px",
                borderRadius: "6px",
                fontSize: "12px",
                overflowX: "auto",
                marginBottom: "12px",
              }}
            >
              {JSON.stringify(sub.fields, null, 2)}
            </pre>
          )}

          {sub.status === "pending" && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => updateStatus(sub.documentId, "approved")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  background: "#8ef0b3",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                Approve
              </button>
              <button
                onClick={() => {
                  const note = globalThis.prompt("Rejection reason (optional):")
                  updateStatus(sub.documentId, "rejected", note ?? undefined)
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  background: "#ff8a8a",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                Reject
              </button>
              <button
                onClick={() => updateStatus(sub.documentId, "needs_info")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  background: "#a390ff",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "13px",
                  color: "#fff",
                }}
              >
                Needs info
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
