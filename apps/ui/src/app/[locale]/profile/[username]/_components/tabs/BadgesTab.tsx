import {
  BADGE_CATALOG,
  type BadgeDefinition,
  type BadgeRarity,
} from "@/lib/badges"
import { T } from "@/lib/design-tokens"

const RARITY_COLORS: Record<BadgeRarity, string> = {
  COMMON: "rgba(255,255,255,0.55)",
  UNCOMMON: T.accent.aurora,
  RARE: T.accent.violet,
  STATUS: T.accent.gold,
}

function getEarnedBadgeIds(): Set<string> {
  // Temporary fallback until contribution stats are wired into this tab.
  return new Set()
}

function BadgeCard({
  badge,
  earned,
}: {
  badge: BadgeDefinition
  earned: boolean
}) {
  return (
    <div
      style={{
        padding: "20px",
        borderRadius: "12px",
        border: `1px solid ${
          earned ? "rgba(127,223,255,0.18)" : T.border.line
        }`,
        background: earned
          ? "rgba(127,223,255,0.04)"
          : "rgba(255,255,255,0.02)",
        opacity: earned ? 1 : 0.5,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          background: earned
            ? "rgba(127,223,255,0.12)"
            : "rgba(255,255,255,0.04)",
          border: `1px solid ${
            earned ? "rgba(127,223,255,0.2)" : T.border.line
          }`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: earned ? RARITY_COLORS[badge.rarity] : T.ink.faint,
        }}
      >
        <span style={{ fontFamily: T.font.mono, fontSize: "10px" }}>
          {badge.icon.slice(0, 2).toUpperCase()}
        </span>
      </div>

      <div>
        <p
          style={{
            margin: "0 0 4px",
            fontSize: "13px",
            fontWeight: 500,
            color: earned ? T.ink.base : T.ink.dim,
          }}
        >
          {badge.name}
        </p>

        <p
          style={{
            margin: "0 0 8px",
            fontSize: "12px",
            color: T.ink.faint,
            lineHeight: "1.5",
          }}
        >
          {badge.description}
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "8px",
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: RARITY_COLORS[badge.rarity],
            }}
          >
            {badge.rarity}
          </span>

          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "8px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            {earned ? "EARNED" : "LOCKED"}
          </span>
        </div>
      </div>
    </div>
  )
}

export function BadgesTab() {
  const earnedBadgeIds = getEarnedBadgeIds()

  const earned = BADGE_CATALOG.filter((badge) => earnedBadgeIds.has(badge.id))
  const locked = BADGE_CATALOG.filter((badge) => !earnedBadgeIds.has(badge.id))

  const stats = [
    {
      label: "Earned",
      value: `${earned.length}/${BADGE_CATALOG.length}`,
    },
    {
      label: "Rare badges",
      value: String(earned.filter((badge) => badge.rarity === "RARE").length),
    },
    {
      label: "Latest",
      value: earned.at(-1)?.name ?? "—",
    },
    {
      label: "Next milestone",
      value: "—",
    },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
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
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: "20px 24px",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <span
              style={{
                fontFamily: T.font.serif,
                fontSize: "28px",
                fontWeight: 400,
                letterSpacing: "-0.03em",
                color: T.ink.base,
                display: "block",
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "12px",
        }}
      >
        {[...earned, ...locked].map((badge) => (
          <BadgeCard
            key={badge.id}
            badge={badge}
            earned={earnedBadgeIds.has(badge.id)}
          />
        ))}
      </div>
    </div>
  )
}
