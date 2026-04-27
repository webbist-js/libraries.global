import { T } from "@/lib/design-tokens"

// TODO: Implement when Follow relation is added to user-profile.
// Will show: following stats (total/libraries/people/followers), sub-tabs (People/Libraries/Regions/Followers),
// search + filter chips, person cards with avatar/name/institution/stats/Follow button.
export function FollowingTab() {
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
      <p style={{ fontFamily: T.font.mono, fontSize: "10px", letterSpacing: ".18em", textTransform: "uppercase", color: T.ink.faint, margin: "0 0 8px" }}>
        Following
      </p>
      <p style={{ fontSize: "14px", color: T.ink.faint, margin: 0 }}>
        Following and followers will appear here once the social graph is built.
      </p>
    </div>
  )
}
