import { useCallback, useEffect, useMemo, useState } from "react"

const STATUS_COLORS: Record<string, string> = {
  pending: "#ffcf7a",
  approved: "#8ef0b3",
  rejected: "#ff8a8a",
  needs_info: "#a390ff",
}

const TYPE_LABELS: Record<string, string> = {
  correction: "Correction",
  new_library: "New Library",
  library_claim: "Library Claim",
  wiki_edit: "Wiki Edit",
  blog_submission: "Blog Submission",
  topic_suggestion: "Topic Suggestion",
}

type Submission = {
  documentId: string
  submissionType: string
  status: string
  targetEntityType?: string
  targetSlug?: string
  targetDocumentId?: string
  fields?: Record<string, unknown>
  note?: string
  reviewNote?: string
  verificationMethod?: string
  submittedByEmail: string
  submittedByName?: string
  submittedByUserId: string
  reviewedAt?: string
  createdAt: string
}

function LibraryClaimPanel({ sub }: { sub: Submission }) {
  const fields = sub.fields ?? {}
  const methodColor =
    fields.verificationMethod === "email_domain"
      ? "#8ef0b3"
      : fields.verificationMethod === "vouching"
        ? "#ffcf7a"
        : "#a390ff"

  return (
    <div
      style={{
        marginTop: "12px",
        padding: "12px 16px",
        background: "#f8fafc",
        borderRadius: "8px",
        border: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px 16px",
          fontSize: "12px",
        }}
      >
        <div>
          <span style={{ color: "#888" }}>Library: </span>
          <strong>{String(fields.name ?? "—")}</strong>
        </div>
        <div>
          <span style={{ color: "#888" }}>Entity ref: </span>
          <code style={{ fontSize: "11px" }}>
            {String(fields.entityRef ?? "—")}
          </code>
        </div>
        <div>
          <span style={{ color: "#888" }}>Role: </span>
          {String(fields.role ?? "—")}
        </div>
        <div>
          <span style={{ color: "#888" }}>Department: </span>
          {String(fields.department ?? "—")}
        </div>
        <div>
          <span style={{ color: "#888" }}>Verification: </span>
          <span style={{ color: methodColor, fontWeight: 600 }}>
            {String(fields.verificationMethod ?? "—")}
          </span>
        </div>
        <div>
          <span style={{ color: "#888" }}>Submitter: </span>
          {sub.submittedByEmail}
        </div>
        {fields.userEmailDomain && (
          <div>
            <span style={{ color: "#888" }}>Email domain: </span>
            <code style={{ fontSize: "11px" }}>
              {String(fields.userEmailDomain)}
            </code>
          </div>
        )}
        {fields.libraryWebsiteDomain && (
          <div>
            <span style={{ color: "#888" }}>Library domain: </span>
            <code style={{ fontSize: "11px" }}>
              {String(fields.libraryWebsiteDomain)}
            </code>
          </div>
        )}
      </div>
      {fields.userEmailDomain && fields.libraryWebsiteDomain && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "11px",
            color:
              fields.userEmailDomain === fields.libraryWebsiteDomain
                ? "#22c55e"
                : "#f97316",
            fontWeight: 600,
          }}
        >
          {fields.userEmailDomain === fields.libraryWebsiteDomain
            ? "Domain match — auto-verification eligible"
            : "Domain mismatch — manual review required"}
        </p>
      )}
    </div>
  )
}

function TopicSuggestionPanel({ sub }: { sub: Submission }) {
  const fields = sub.fields ?? {}

  return (
    <div
      style={{
        marginTop: "12px",
        padding: "12px 16px",
        background: "#f8fafc",
        borderRadius: "8px",
        border: "1px solid #e2e8f0",
      }}
    >
      <div style={{ fontSize: "12px" }}>
        <span style={{ color: "#888" }}>Suggested topic: </span>
        <strong style={{ fontSize: "14px" }}>
          {String(fields.name ?? "—")}
        </strong>
      </div>
      <div style={{ fontSize: "12px", marginTop: "4px" }}>
        <span style={{ color: "#888" }}>Suggested by: </span>
        {sub.submittedByEmail}
      </div>
    </div>
  )
}

export function ModerationDashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("pending")
  const [typeFilter, setTypeFilter] = useState("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback((status: string) => {
    setLoading(true)
    fetch(
      `/api/content-moderation/submissions?status=${encodeURIComponent(status)}`,
      {
        headers: { "Content-Type": "application/json" },
      }
    )
      .then((r) => r.json())
      .then((json: unknown) => {
        const data = Array.isArray((json as { data?: unknown })?.data)
          ? (json as { data: Submission[] }).data
          : []
        setSubmissions(data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load(statusFilter)
  }, [statusFilter, load])

  const filtered =
    typeFilter === "all"
      ? submissions
      : submissions.filter((s) => s.submissionType === typeFilter)

  const updateStatus = async (
    id: string,
    status: string,
    reviewNote?: string
  ) => {
    try {
      const res = await fetch(
        `/api/content-moderation/submissions/${id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, reviewNote }),
        }
      )
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      load(statusFilter)
    } catch (err) {
      console.error(err)
      globalThis.alert("Failed to update submission status. Please try again.")
    }
  }

  const allTypes = useMemo(
    () => Array.from(new Set(submissions.map((s) => s.submissionType))),
    [submissions]
  )

  return (
    <div
      style={{
        padding: "32px",
        fontFamily: "system-ui, sans-serif",
        maxWidth: "900px",
      }}
    >
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>
        Moderation Queue
      </h1>
      <p style={{ fontSize: "13px", color: "#888", marginBottom: "24px" }}>
        Review and action user submissions. Library claim approvals also update
        the user&apos;s profile verification status.
      </p>

      {/* Status filter tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        {["pending", "approved", "rejected", "needs_info"].map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s)
              setTypeFilter("all")
            }}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: `1px solid ${statusFilter === s ? STATUS_COLORS[s] : "#ccc"}`,
              background:
                statusFilter === s ? STATUS_COLORS[s] + "22" : "transparent",
              color: statusFilter === s ? STATUS_COLORS[s] : "#666",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            {s.replaceAll("_", " ")}
          </button>
        ))}
      </div>

      {/* Type filter */}
      {allTypes.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: "6px",
            marginBottom: "20px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setTypeFilter("all")}
            style={{
              padding: "4px 10px",
              borderRadius: "4px",
              fontSize: "11px",
              border: `1px solid ${typeFilter === "all" ? "#6366f1" : "#e2e8f0"}`,
              background: typeFilter === "all" ? "#6366f122" : "transparent",
              color: typeFilter === "all" ? "#6366f1" : "#555",
              cursor: "pointer",
            }}
          >
            All types
          </button>
          {allTypes.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              style={{
                padding: "4px 10px",
                borderRadius: "4px",
                fontSize: "11px",
                border: `1px solid ${typeFilter === t ? "#6366f1" : "#e2e8f0"}`,
                background: typeFilter === t ? "#6366f122" : "transparent",
                color: typeFilter === t ? "#6366f1" : "#555",
                cursor: "pointer",
              }}
            >
              {TYPE_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      )}

      {loading && <p style={{ color: "#888" }}>Loading…</p>}

      {!loading && filtered.length === 0 && (
        <p style={{ color: "#888" }}>
          No {statusFilter}{" "}
          {typeFilter !== "all" ? (TYPE_LABELS[typeFilter] ?? typeFilter) : ""}{" "}
          submissions.
        </p>
      )}

      {filtered.map((sub) => {
        const expanded = expandedId === sub.documentId

        return (
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
            {/* Header row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    background: STATUS_COLORS[sub.status] + "22",
                    color: STATUS_COLORS[sub.status],
                    padding: "2px 8px",
                    borderRadius: "4px",
                  }}
                >
                  {TYPE_LABELS[sub.submissionType] ?? sub.submissionType}
                </span>
                <span style={{ fontSize: "12px", color: "#888" }}>
                  by {sub.submittedByEmail} ·{" "}
                  {new Date(sub.createdAt).toLocaleDateString()}
                </span>
                {sub.verificationMethod && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      background: "#f1f5f9",
                      color: "#64748b",
                    }}
                  >
                    {sub.verificationMethod}
                  </span>
                )}
              </div>
              <button
                onClick={() => setExpandedId(expanded ? null : sub.documentId)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#888",
                  cursor: "pointer",
                  fontSize: "12px",
                  flexShrink: 0,
                }}
              >
                {expanded ? "Hide details ▲" : "Show details ▼"}
              </button>
            </div>

            {/* Note */}
            {sub.note && (
              <p
                style={{ fontSize: "13px", color: "#444", margin: "0 0 12px" }}
              >
                {sub.note}
              </p>
            )}

            {/* Expanded detail panel */}
            {expanded && sub.submissionType === "library_claim" && (
              <LibraryClaimPanel sub={sub} />
            )}
            {expanded && sub.submissionType === "topic_suggestion" && (
              <TopicSuggestionPanel sub={sub} />
            )}
            {expanded &&
              sub.fields &&
              sub.submissionType !== "library_claim" &&
              sub.submissionType !== "topic_suggestion" && (
                <pre
                  style={{
                    background: "#f8f8f8",
                    padding: "12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    overflowX: "auto",
                    marginTop: "12px",
                  }}
                >
                  {JSON.stringify(sub.fields, null, 2)}
                </pre>
              )}

            {/* Review note */}
            {sub.reviewNote && (
              <p
                style={{
                  fontSize: "12px",
                  color: "#888",
                  marginTop: "8px",
                  fontStyle: "italic",
                }}
              >
                Review note: {sub.reviewNote}
              </p>
            )}

            {/* Actions */}
            {sub.status === "pending" && (
              <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                <button
                  onClick={() => void updateStatus(sub.documentId, "approved")}
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
                  {sub.submissionType === "library_claim"
                    ? "Approve & Verify"
                    : "Approve"}
                </button>
                <button
                  onClick={() => {
                    const note = globalThis.prompt(
                      "Rejection reason (optional):"
                    )
                    void updateStatus(
                      sub.documentId,
                      "rejected",
                      note ?? undefined
                    )
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
                  onClick={() =>
                    void updateStatus(sub.documentId, "needs_info")
                  }
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
        )
      })}
    </div>
  )
}
