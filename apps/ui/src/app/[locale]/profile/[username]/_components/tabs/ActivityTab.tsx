import { T } from "@/lib/design-tokens"

// TODO: Implement when contribution/event data exists.
// Will show: 30-day stats (events/avg/streak/watching), 12-month bar chart, filter (ALL/Mine/Followed/Editorial/Mentions),
// date-grouped activity feed (edits, follows, badge earned, approvals, mentions).
export function ActivityTab() {
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
        Activity
      </p>
      <p style={{ fontSize: "14px", color: T.ink.faint, margin: 0 }}>
        Activity feed will appear here once contribution events are tracked.
      </p>
    </div>
  )
}
