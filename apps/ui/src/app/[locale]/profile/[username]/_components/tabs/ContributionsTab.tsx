import { T } from "@/lib/design-tokens"

// TODO: Implement when Submission content type is built.
// Will show: stats row (Total/Approved/Pending/Reputation), type filters (ALL/ADDED/EDITED/TRANSLATED/FLAGGED/PHOTOGRAPHY),
// country filter chips, date-grouped contribution list with rep points per entry.
export function ContributionsTab() {
  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "12px",
        padding: "48px",
        textAlign: "center",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <p
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".18em",
          textTransform: "uppercase",
          color: T.ink.faint,
          margin: "0 0 8px",
        }}
      >
        Contributions
      </p>
      <p style={{ fontSize: "14px", color: T.ink.faint, margin: 0 }}>
        Contribution history will appear here once the submission system is
        built.
      </p>
    </div>
  )
}
