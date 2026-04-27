import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"

export function OverviewTab({ profile }: { profile: UserProfile }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Quick stats row — placeholder zeros until contribution data exists */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1px",
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {[
          // TODO: replace — values with real contribution/following counts
          { label: "Contributions", value: "—" },
          { label: "Following", value: "—" },
          { label: "Collections", value: "—" },
          { label: "Reputation", value: "—" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: "20px 24px",
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <span
              style={{
                fontFamily: T.font.serif,
                fontSize: "32px",
                fontWeight: 400,
                letterSpacing: "-0.03em",
                color: T.ink.base,
              }}
            >
              {stat.value}
            </span>
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: T.ink.faint,
              }}
            >
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Profile details */}
      {(profile.affiliation || profile.role || profile.city || profile.country || profile.timezone || profile.website) && (
        <div
          style={{
            border: `1px solid ${T.border.line}`,
            borderRadius: "12px",
            padding: "24px",
            background: "rgba(255,255,255,0.02)",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <p style={{ fontFamily: T.font.mono, fontSize: "9px", letterSpacing: ".18em", textTransform: "uppercase", color: T.ink.faint, margin: 0 }}>
            Profile details
          </p>
          {[
            { label: "Institution", value: profile.affiliation },
            { label: "Role", value: profile.role },
            { label: "Location", value: [profile.city, profile.country].filter(Boolean).join(", ") || null },
            { label: "Timezone", value: profile.timezone },
            { label: "Website", value: profile.website },
          ].filter((r) => r.value).map((row) => (
            <div key={row.label} style={{ display: "flex", gap: "24px" }}>
              <span style={{ fontFamily: T.font.mono, fontSize: "10px", letterSpacing: ".1em", textTransform: "uppercase", color: T.ink.faint, width: "100px", flexShrink: 0 }}>
                {row.label}
              </span>
              <span style={{ fontSize: "13px", color: T.ink.dim }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
