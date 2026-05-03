import type { CSSProperties } from "react"

type FailedCredential = {
  credentialDocumentId: string
  label?: string
  error: string
}

type ProviderEntry = {
  fetched: number
  created: number
}

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
  providerBreakdown?: Record<string, ProviderEntry>
  failedCredentials?: FailedCredential[]
}

const cellStyle: CSSProperties = {
  padding: "8px 12px",
  fontSize: "12px",
  color: "#32324d",
  borderBottom: "1px solid #f6f6f9",
  verticalAlign: "top",
}

const labelStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#666687",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: "12px",
}

export function ImportRunDetail({ run }: { run: RunRecord }) {
  const stats = run.stats ?? {}
  const providers = run.providerBreakdown ?? {}
  const failed = run.failedCredentials ?? []

  return (
    <div
      style={{
        padding: "20px 24px",
        background: "#fafafa",
        borderTop: "1px solid #f0f0ff",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
        }}
      >
        {/* Event stats */}
        <div>
          <p style={labelStyle}>Event Stats</p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {(
                [
                  ["Fetched", stats.fetched ?? 0],
                  ["Created", stats.created ?? 0],
                  ["Updated", stats.updated ?? 0],
                  ["Unchanged", stats.unchanged ?? 0],
                  ["Expired purged", stats.expired ?? 0],
                  ["Pending review", stats.pendingReview ?? 0],
                  ["Errors", stats.errors ?? 0],
                ] as [string, number][]
              ).map(([label, val]) => (
                <tr key={label}>
                  <td
                    style={{ ...cellStyle, color: "#666687", width: "120px" }}
                  >
                    {label}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      fontWeight: 600,
                      color:
                        label === "Errors" && val > 0
                          ? "#d02b20"
                          : label === "Created" && val > 0
                            ? "#1b7c3a"
                            : "#32324d",
                    }}
                  >
                    {val}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Provider breakdown */}
        <div>
          <p style={labelStyle}>Provider Breakdown</p>
          {Object.keys(providers).length === 0 ? (
            <p style={{ fontSize: "13px", color: "#8e8ea9" }}>No data</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Provider", "Fetched", "Created"].map((h) => (
                    <th
                      key={h}
                      style={{
                        ...cellStyle,
                        fontSize: "10px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "#666687",
                        textAlign: "left",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(providers).map(([provider, entry]) => (
                  <tr key={provider}>
                    <td style={cellStyle}>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "12px",
                          color: "#4945ff",
                        }}
                      >
                        {provider}
                      </span>
                    </td>
                    <td style={cellStyle}>{entry.fetched}</td>
                    <td
                      style={{
                        ...cellStyle,
                        color: entry.created > 0 ? "#1b7c3a" : "#32324d",
                        fontWeight: entry.created > 0 ? 600 : 400,
                      }}
                    >
                      +{entry.created}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Failed credentials */}
      {failed.length > 0 && (
        <div style={{ marginTop: "16px" }}>
          <p style={labelStyle}>Failed Credentials</p>
          {failed.map((fc) => (
            <div
              key={fc.credentialDocumentId}
              style={{
                padding: "10px 14px",
                background: "#ffeaea",
                border: "1px solid #f5c0be",
                borderRadius: "6px",
                marginBottom: "8px",
                fontSize: "12px",
              }}
            >
              <span style={{ fontWeight: 600, color: "#d02b20" }}>
                {fc.label ?? fc.credentialDocumentId}
              </span>
              <span style={{ color: "#666687", marginLeft: "8px" }}>
                {fc.error}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
