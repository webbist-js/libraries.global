import { useEffect, useState } from "react"

const STATUS_COLORS: Record<string, string> = {
  approved: "#8ef0b3",
  pending: "#ffcf7a",
  rejected: "#ff8a8a",
}

export function TopicsDashboard() {
  const [topics, setTopics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("pending")

  const load = () => {
    setLoading(true)
    fetch("/api/topics", { headers: { "Content-Type": "application/json" } })
      .then((r) => r.json())
      .then((json) => setTopics(json.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetch("/api/topics", { headers: { "Content-Type": "application/json" } })
      .then((r) => r.json())
      .then((json) => setTopics(json.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = topics.filter((t) => t.status === filter)

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/topics/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    load()
  }

  return (
    <div style={{ padding: "32px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "24px" }}>
        Topics
      </h1>

      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {["pending", "approved", "rejected"].map((s) => (
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
            {s}
          </button>
        ))}
      </div>

      {loading && <p>Loading…</p>}

      {!loading && filtered.length === 0 && (
        <p style={{ color: "#888" }}>No {filter} topics.</p>
      )}

      {filtered.map((topic) => (
        <div
          key={topic.documentId}
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "16px 20px",
            marginBottom: "12px",
            background: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>
              {topic.name}
            </span>
            {topic.suggestedByEmail && (
              <span
                style={{ fontSize: "12px", color: "#888", marginLeft: "12px" }}
              >
                suggested by {topic.suggestedByEmail}
              </span>
            )}
          </div>
          {topic.status === "pending" && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => updateStatus(topic.documentId, "approved")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "#8ef0b3",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Approve
              </button>
              <button
                onClick={() => updateStatus(topic.documentId, "rejected")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "#ff8a8a",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
