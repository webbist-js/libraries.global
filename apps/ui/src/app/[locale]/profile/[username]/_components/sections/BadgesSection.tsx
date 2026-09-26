"use client"

import { useEffect, useMemo, useState } from "react"

import type { EarnedBadge } from "@/app/api/profile/[username]/badges/route"
import { BADGE_CATALOG } from "@/lib/badges"
import { T } from "@/lib/design-tokens"

import {
  BadgeTile,
  CARD,
  SectionTitle,
  StatCard,
  TextLink,
} from "../ProfileSectionUI"

const TIERS = [
  { name: "Reader", min: 0, next: 100 },
  { name: "Indexer", min: 100, next: 500 },
  { name: "Cartographer", min: 500, next: 1500 },
  { name: "Archivist", min: 1500, next: 4000 },
  { name: "Scholar", min: 4000, next: 9000 },
  { name: "Curator", min: 9000, next: null },
]

function computeProgress(points: number, tierName: string): number {
  const tier = TIERS.find((t) => t.name === tierName)
  if (!tier || tier.next === null) return 100

  return Math.min(
    100,
    Math.round(((points - tier.min) / (tier.next - tier.min)) * 100)
  )
}

function formatAwarded(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null

  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
}

export function BadgesSection({
  username,
  points,
  tier,
  streak,
  pointsThisMonth,
}: {
  username: string
  points?: number | null
  tier?: string | null
  streak?: number | null
  pointsThisMonth?: number | null
}) {
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

  const progress = points != null && tier ? computeProgress(points, tier) : null
  const currentTier = TIERS.find((t) => t.name === tier)
  const nextTierName =
    currentTier?.next != null
      ? (TIERS.find((t) => t.min === currentTier.next)?.name ?? null)
      : null

  const earnedList = BADGE_CATALOG.filter((b) => earnedMap.has(b.id))
  const lockedList = BADGE_CATALOG.filter((b) => !earnedMap.has(b.id))

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <h2 className="sr-only">Recognition summary</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-live="polite">
        <StatCard
          label="Total points"
          value={points != null ? points.toLocaleString() : "0"}
          bg="var(--tint-national-bg)"
          fg="var(--tint-national-fg)"
          icon="mdi:star-four-points-outline"
        />
        <StatCard
          label="Tier"
          value={tier ?? "—"}
          bg="var(--tint-academic-bg)"
          fg="var(--tint-academic-fg)"
          icon="mdi:school-outline"
          compactValue
        />
        <StatCard
          label="Day streak"
          value={String(streak ?? 0)}
          bg="var(--tint-special-bg)"
          fg="var(--tint-special-fg)"
          icon="mdi:fire"
        />
        <StatCard
          label="Badges earned"
          value={loading ? "—" : `${earnedCount}/${BADGE_CATALOG.length}`}
          bg="var(--tint-public-bg)"
          fg="var(--tint-public-fg)"
          icon="mdi:medal-outline"
        />
      </div>

      {/* Tier progress */}
      <section
        aria-labelledby="rc-progress"
        className="flex flex-col gap-4"
        style={{ ...CARD, padding: "20px 24px 24px" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle as="h2" id="rc-progress">
            Progress
          </SectionTitle>
          <TextLink href="/contribute/community">View leaderboard</TextLink>
        </div>

        {progress != null && nextTierName ? (
          <div>
            <div
              role="progressbar"
              aria-label={`Progress to ${nextTierName}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="h-2 overflow-hidden rounded-full"
              style={{ background: T.bg.muted }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress}%`,
                  background: T.accent.primary,
                }}
              />
            </div>
            <p
              className="m-0 mt-2 text-[15px] font-semibold"
              style={{ color: T.ink.base }}
            >
              {progress}% to {nextTierName}
            </p>
            {pointsThisMonth ? (
              <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
                {pointsThisMonth.toLocaleString()} points this month
              </p>
            ) : null}
          </div>
        ) : (
          <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
            {tier === "Curator"
              ? "Highest tier reached."
              : "Earn points by contributing to start climbing the tiers."}
          </p>
        )}

        <dl
          className="m-0 grid grid-cols-1 gap-x-6 gap-y-2 border-t pt-4 sm:grid-cols-3"
          style={{ borderTopColor: T.border.divider }}
        >
          {[
            { label: "Rare badges", value: loading ? "—" : String(rareCount) },
            { label: "Latest badge", value: latest?.name ?? "None yet" },
            {
              label: "Next up",
              value:
                earnedCount < BADGE_CATALOG.length
                  ? (lockedList[0]?.name ?? "—")
                  : "All earned",
            },
          ].map((f) => (
            <div key={f.label}>
              <dt
                className="text-[13px] font-semibold"
                style={{ color: T.ink.low }}
              >
                {f.label}
              </dt>
              <dd className="m-0 text-[15px]" style={{ color: T.ink.base }}>
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Earned */}
      <section
        aria-labelledby="rc-earned"
        aria-busy={loading}
        style={{ ...CARD, padding: "20px 24px 24px" }}
      >
        <div className="flex items-baseline justify-between gap-2 pb-4">
          <SectionTitle as="h2" id="rc-earned">
            Earned
          </SectionTitle>
          <span
            className="text-[15px]"
            style={{ color: T.ink.dim }}
            aria-live="polite"
          >
            {loading
              ? "Loading…"
              : `${earnedCount} ${earnedCount === 1 ? "badge" : "badges"}`}
          </span>
        </div>
        {loading ? null : earnedList.length === 0 ? (
          <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
            No badges earned yet. A first accepted contribution earns one.
          </p>
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {earnedList.map((badge) => (
              <BadgeTile
                key={badge.id}
                badge={badge}
                earned
                awardedLabel={formatAwarded(earnedMap.get(badge.id))}
                showRarity
              />
            ))}
          </ul>
        )}
      </section>

      {/* Still to earn */}
      {lockedList.length > 0 && !loading ? (
        <section
          aria-labelledby="rc-locked"
          style={{ ...CARD, padding: "20px 24px 24px" }}
        >
          <div className="flex items-baseline justify-between gap-2 pb-4">
            <SectionTitle as="h2" id="rc-locked">
              Still to earn
            </SectionTitle>
            <span className="text-[15px]" style={{ color: T.ink.dim }}>
              {lockedList.length} {lockedList.length === 1 ? "badge" : "badges"}
            </span>
          </div>
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {lockedList.map((badge) => (
              <BadgeTile
                key={badge.id}
                badge={badge}
                earned={false}
                showRarity
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
