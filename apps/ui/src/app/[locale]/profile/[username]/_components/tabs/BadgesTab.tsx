"use client"

import { Icon } from "@iconify/react"
import { useEffect, useMemo, useState } from "react"

import type { EarnedBadge } from "@/app/api/profile/[username]/badges/route"
import {
  BADGE_CATALOG,
  BADGE_VARIANT_STYLES,
  RARITY_COLOR,
  type BadgeDefinition,
} from "@/lib/badges"
import { T } from "@/lib/design-tokens"

function BadgeCard({
  badge,
  earned,
  awardedAt,
}: {
  badge: BadgeDefinition
  earned: boolean
  awardedAt?: string
}) {
  const vs = earned
    ? BADGE_VARIANT_STYLES[badge.variant]
    : { border: T.border.line, bg: T.bg.surface, color: T.ink.ghost }

  const awardedLabel = awardedAt
    ? new Date(awardedAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : null

  return (
    <div
      className="transition-transform duration-150 hover:-translate-y-0.5"
      style={{
        padding: "20px",
        borderRadius: "14px",
        border: `1px solid ${vs.border}`,
        background: earned ? vs.bg : T.bg.surface,
        opacity: earned ? 1 : 0.45,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {/* Icon tile */}
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "12px",
          background: earned ? vs.bg : T.bg.surface,
          border: `1px solid ${vs.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon
          icon={badge.icon}
          width={22}
          height={22}
          style={{ color: vs.color }}
        />
      </div>

      <div>
        <p
          style={{
            margin: "0 0 4px",
            fontFamily: T.font.serif,
            fontSize: "15px",
            fontWeight: 400,
            letterSpacing: "-0.01em",
            color: earned ? T.ink.base : T.ink.dim,
          }}
        >
          {badge.name}
        </p>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: "12px",
            color: T.ink.faint,
            lineHeight: "1.55",
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
              fontSize: "10px",
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: RARITY_COLOR[badge.rarity],
            }}
          >
            {badge.rarity}
          </span>
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: earned ? T.accent.ok : T.ink.faint,
            }}
          >
            {earned ? (awardedLabel ?? "Earned") : "Locked"}
          </span>
        </div>
      </div>
    </div>
  )
}

export function BadgesTab({ username }: { username: string }) {
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/profile/${encodeURIComponent(username)}/badges`)
      .then((r) => r.json())
      .then((json: { data?: EarnedBadge[] }) => {
        setEarnedBadges(json.data ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [username])

  const earnedMap = useMemo(
    () => new Map(earnedBadges.map((b) => [b.badgeId, b.awardedAt])),
    [earnedBadges]
  )

  const earnedCount = earnedBadges.length
  const rareCount = useMemo(
    () =>
      BADGE_CATALOG.filter((b) => earnedMap.has(b.id) && b.rarity === "RARE")
        .length,
    [earnedMap]
  )
  const latest = useMemo(() => {
    if (!earnedBadges.length) return null
    const sorted = [...earnedBadges].sort(
      (a, b) =>
        new Date(b.awardedAt).getTime() - new Date(a.awardedAt).getTime()
    )

    return BADGE_CATALOG.find((b) => b.id === sorted[0]?.badgeId) ?? null
  }, [earnedBadges])

  const stats = [
    { label: "Earned", value: `${earnedCount} / ${BADGE_CATALOG.length}` },
    { label: "Rare badges", value: String(rareCount) },
    { label: "Latest", value: latest?.name ?? "—" },
    {
      label: "Next milestone",
      value:
        earnedCount < BADGE_CATALOG.length
          ? (BADGE_CATALOG.find((b) => !earnedMap.has(b.id))?.name ?? "—")
          : "Complete!",
    },
  ]

  const sorted = [
    ...BADGE_CATALOG.filter((b) => earnedMap.has(b.id)),
    ...BADGE_CATALOG.filter((b) => !earnedMap.has(b.id)),
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Stats strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1px",
          border: `1px solid ${T.border.line}`,
          borderRadius: "18px",
          overflow: "hidden",
          background: T.border.line,
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{ padding: "20px 24px", background: T.bg.surface }}
          >
            <span
              style={{
                fontFamily: T.font.serif,
                fontSize: "26px",
                fontWeight: 400,
                letterSpacing: "-0.03em",
                color: T.ink.base,
                display: "block",
                marginBottom: "4px",
              }}
            >
              {loading ? "—" : stat.value}
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

      {/* Badge grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "12px",
        }}
      >
        {sorted.map((badge) => (
          <BadgeCard
            key={badge.id}
            badge={badge}
            earned={earnedMap.has(badge.id)}
            awardedAt={earnedMap.get(badge.id)}
          />
        ))}
      </div>
    </div>
  )
}
