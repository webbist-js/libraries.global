import GlobalLink from "@/components/global/GlobalLink"
import { BADGE_CATALOG } from "@/lib/badges"
import { T } from "@/lib/design-tokens"

type Standing = {
  globalRank: number | null
  tier: {
    level: number
    name: string
    nextName: string | null
    nextThreshold: number | null
    progressPercent: number
  }
  streak: number
  totalPoints: number
  pointsThisMonth: number
  recentBadges: { badgeId: string; awardedAt: string }[]
  suggestedAction: string
}

const POINT_ACTIONS = [
  { label: "New library approved", pts: "+50" },
  { label: "Major edit approved", pts: "+15" },
  { label: "Wiki translation", pts: "+15" },
  { label: "Minor edit approved", pts: "+5" },
  { label: "Hours verified", pts: "+5" },
  { label: "Status verified", pts: "+5" },
  { label: "Daily streak", pts: "+1" },
]

const CARD_STYLE = {
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
}

const CARD_HEADING_STYLE = {
  fontFamily: T.font.serif,
  fontSize: "22px",
  fontWeight: 500,
  letterSpacing: "-0.01em",
  color: T.ink.base,
}

export function LeaderboardSidebar({
  isSignedIn,
  standing,
  profileUsername,
}: {
  isSignedIn: boolean
  standing: Standing | null
  profileUsername?: string | null
}) {
  return (
    <aside className="flex flex-col gap-5 lg:sticky lg:top-[120px]">
      <section
        aria-labelledby="standing-heading"
        className="rounded-[20px] p-6"
        style={CARD_STYLE}
      >
        <h2
          id="standing-heading"
          className="m-0 mb-4"
          style={CARD_HEADING_STYLE}
        >
          Your standing
        </h2>
        {!isSignedIn ? (
          <div>
            <p
              className="m-0 mb-4 text-[15px] leading-[1.6]"
              style={{ color: T.ink.dim }}
            >
              Sign in to see your rank, tier, and progress.
            </p>
            <GlobalLink
              href="/auth/signin"
              className="inline-block rounded-full px-5 py-2.5 text-[15px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
              style={{ background: T.accent.primary }}
            >
              Sign in
            </GlobalLink>
          </div>
        ) : standing ? (
          <div className="flex flex-col">
            <dl className="m-0">
              {[
                {
                  label: "Global rank",
                  value:
                    standing.globalRank != null
                      ? `#${standing.globalRank}`
                      : "—",
                },
                {
                  label: "Tier",
                  value: `${standing.tier.name} (Level ${standing.tier.level})`,
                },
                {
                  label: "Total points",
                  value: standing.totalPoints.toLocaleString(),
                },
                {
                  label: "This month",
                  value: standing.pointsThisMonth.toLocaleString(),
                },
                {
                  label: "Streak",
                  value: `${standing.streak} day${standing.streak === 1 ? "" : "s"}`,
                },
              ].map(({ label, value }, index) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-4 py-2.5"
                  style={
                    index > 0
                      ? { borderTop: `1px solid ${T.border.divider}` }
                      : undefined
                  }
                >
                  <dt className="text-[15px]" style={{ color: T.ink.dim }}>
                    {label}
                  </dt>
                  <dd
                    className="m-0 text-right"
                    style={{
                      fontFamily: T.font.serif,
                      fontSize: "20px",
                      fontWeight: 500,
                      letterSpacing: "-0.01em",
                      color: T.ink.base,
                    }}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {standing.tier.nextName && (
              <div className="mt-3">
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <p
                    id="tier-progress-label"
                    className="m-0 text-[14px] font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    Progress to {standing.tier.nextName}
                  </p>
                  <span
                    className="text-[14px] font-semibold"
                    style={{ color: T.ink.dim }}
                  >
                    {standing.tier.progressPercent}%
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-labelledby="tier-progress-label"
                  aria-valuenow={standing.tier.progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2 overflow-hidden rounded-full"
                  style={{ background: T.bg.muted }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${standing.tier.progressPercent}%`,
                      background: T.accent.primary,
                      transition: "width 600ms",
                    }}
                  />
                </div>
              </div>
            )}
            {standing.suggestedAction && (
              <p
                className="m-0 mt-4 rounded-[14px] px-4 py-3 text-[14.5px] leading-[1.55]"
                style={{ background: T.bg.surface, color: T.ink.dim }}
              >
                {standing.suggestedAction}
              </p>
            )}
            {standing.recentBadges.length > 0 && (
              <div className="mt-5">
                <h3
                  className="m-0 mb-2 text-[15px] font-semibold"
                  style={{ color: T.ink.base }}
                >
                  Recent badges
                </h3>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {standing.recentBadges.map((b) => {
                    const def = BADGE_CATALOG.find((d) => d.id === b.badgeId)
                    if (!def) return null

                    return (
                      <li
                        key={b.badgeId}
                        className="flex items-center justify-between gap-3"
                      >
                        <span
                          className="text-[15px]"
                          style={{ color: T.ink.base }}
                        >
                          {def.name}
                        </span>
                        <span
                          className="shrink-0 text-[14px]"
                          style={{ color: T.ink.dim }}
                        >
                          {new Date(b.awardedAt).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {profileUsername && (
              <GlobalLink
                href={`/profile/${profileUsername}/badges`}
                className="mt-4 self-start text-[14px] font-semibold underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                View all your badges
              </GlobalLink>
            )}
          </div>
        ) : (
          <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
            Loading your standing…
          </p>
        )}
      </section>

      <section
        aria-labelledby="points-heading"
        className="rounded-[20px] p-6"
        style={CARD_STYLE}
      >
        <h2 id="points-heading" className="m-0 mb-3" style={CARD_HEADING_STYLE}>
          How points work
        </h2>
        <dl className="m-0">
          {POINT_ACTIONS.map(({ label, pts }, index) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-4 py-2"
              style={
                index > 0
                  ? { borderTop: `1px solid ${T.border.divider}` }
                  : undefined
              }
            >
              <dt className="text-[15px]" style={{ color: T.ink.dim }}>
                {label}
              </dt>
              <dd
                className="m-0 text-[15px] font-semibold tabular-nums"
                style={{ color: T.accent.primary }}
              >
                {pts}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </aside>
  )
}
