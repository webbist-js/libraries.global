import { Card } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import type { ContributingStanding } from "@/lib/types/profile"

import { TierProgressRing } from "./TierProgressRing"

export function WelcomeBackWidget({
  standing,
}: {
  readonly standing: ContributingStanding
}) {
  const {
    firstName,
    streak,
    globalRank,
    countryRank,
    country,
    tier,
    totalPoints,
    pointsToNext,
    nextTierName,
    pendingSubmissions,
  } = standing

  const rankText =
    globalRank != null
      ? countryRank != null && country
        ? `ranked #${globalRank} globally / #${countryRank} in ${country}`
        : `ranked #${globalRank} globally`
      : null

  const pendingText =
    pendingSubmissions > 0
      ? `${pendingSubmissions} ${pendingSubmissions === 1 ? "submission" : "submissions"} awaiting review. `
      : ""

  const nextTierText =
    pointsToNext != null && nextTierName
      ? `You're ${pointsToNext} pts away from `
      : null

  return (
    <Card
      style={{
        padding: "28px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "24px",
      }}
    >
      {/* Left: text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(1.1rem, 2vw, 1.4rem)",
            fontWeight: 600,
            color: T.ink.base,
            margin: "0 0 8px",
            lineHeight: 1.25,
          }}
        >
          Welcome back,{" "}
          <em
            style={{
              fontStyle: "italic",
              fontWeight: 400,
              color: T.accent.aurora,
            }}
          >
            {firstName}
          </em>
          .{" "}
          {streak > 0 && (
            <>
              You&apos;re on a{" "}
              <strong style={{ color: T.ink.base }}>{streak}-day streak</strong>
              {rankText && (
                <>
                  {" "}
                  and <strong style={{ color: T.ink.base }}>{rankText}</strong>
                </>
              )}
              .
            </>
          )}
        </h2>
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.ink.dim,
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {pendingText}
          {nextTierText && (
            <>
              {nextTierText}
              <strong
                style={{
                  color: T.ink.base,
                  fontFamily: T.font.mono,
                  fontSize: "12px",
                  letterSpacing: ".06em",
                }}
              >
                {nextTierName} · tier {tier.level + 1}
              </strong>
              .
            </>
          )}
        </p>
      </div>

      {/* Right: tier ring */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <TierProgressRing
          percent={tier.progressPercent}
          label={`${tier.progressPercent}%`}
        />
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.dim,
              margin: "0 0 2px",
            }}
          >
            To next tier
          </p>
          {tier.nextThreshold != null && (
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                color: T.ink.low,
                margin: 0,
                letterSpacing: ".04em",
              }}
            >
              {totalPoints.toLocaleString()} /{" "}
              {tier.nextThreshold.toLocaleString()} pts
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
