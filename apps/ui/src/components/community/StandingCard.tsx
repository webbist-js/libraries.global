import { Icon } from "@iconify/react"
import { profilePalette, type ProfileBackground } from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import type { ReactNode } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import type { Standing } from "@/lib/community/leaderboard-server"
import { T } from "@/lib/design-tokens"

const fmt = (n: number) => n.toLocaleString("en-GB")

/** Points for one approved new library, quoted in the progress tip. */
const NEW_LIBRARY_POINTS = 50

const CARD_STYLE = {
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
  borderRadius: 24,
  padding: 22,
}

function Header({
  initials,
  subtitle,
  avatarUrl,
  background,
}: {
  readonly initials: string | null
  readonly subtitle?: string
  readonly avatarUrl?: string | null
  readonly background?: ProfileBackground | null
}) {
  const palette = profilePalette(background)

  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-full"
        style={{
          width: 44,
          height: 44,
          background: avatarUrl ? "transparent" : palette.bg,
          color: palette.fg,
          fontFamily: T.font.serif,
          fontSize: 18,
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          (initials ?? (
            <Icon height={22} icon="mdi:account-outline" width={22} />
          ))
        )}
      </span>
      <div className="min-w-0">
        <h2
          id="standing-heading"
          className="m-0"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            fontSize: 26,
            lineHeight: 1.1,
            color: T.ink.base,
          }}
        >
          Your standing
        </h2>
        {subtitle ? (
          <p className="m-0 mt-0.5 text-[14px]" style={{ color: T.ink.dim }}>
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <section
      aria-labelledby="standing-heading"
      className="flex flex-col gap-3.5"
      style={CARD_STYLE}
    >
      {children}
    </section>
  )
}

const NOT_RANKED = "Not ranked yet"

function Tile({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div
      className="rounded-2xl"
      style={{
        background: T.bg.surface,
        border: `1px solid ${T.border.divider}`,
        padding: "12px 14px",
      }}
    >
      <dt className="text-[14px]" style={{ color: T.ink.dim }}>
        {label}
      </dt>
      <dd
        className="m-0 mt-1"
        style={{
          fontFamily: T.font.serif,
          fontSize: value === NOT_RANKED ? 20 : 26,
          lineHeight: 1.1,
          color: T.ink.base,
        }}
      >
        {value}
      </dd>
    </div>
  )
}

function Progress({ standing }: { readonly standing: Standing }) {
  const { nextName, nextThreshold } = standing.tier

  if (!nextName || !nextThreshold) {
    return (
      <p className="m-0 text-[15px] leading-[1.5]" style={{ color: T.ink.dim }}>
        You’ve reached the top tier. Thank you.
      </p>
    )
  }

  const points = standing.totalPoints
  const percent = Math.min(100, Math.max(0, (points / nextThreshold) * 100))
  const toGo = Math.max(0, nextThreshold - points)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap justify-between gap-x-3 text-[15px]">
        <strong style={{ color: T.ink.base }}>Progress to {nextName}</strong>
        <span style={{ color: T.ink.dim }}>
          {fmt(points)} of {fmt(nextThreshold)} pts
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Progress to ${nextName}`}
        aria-valuemin={0}
        aria-valuemax={nextThreshold}
        aria-valuenow={points}
        className="flex h-2.5 overflow-hidden rounded-full"
        style={{ background: T.border.divider }}
      >
        <span
          className="rounded-full"
          style={{
            width: `${Math.round(percent * 10) / 10}%`,
            background: T.accent.primary,
          }}
        />
      </div>
      <p
        className="m-0 mt-0.5 text-[15px] leading-[1.5]"
        style={{ color: T.ink.dim }}
      >
        {fmt(toGo)} points to go. One approved new library is worth{" "}
        {NEW_LIBRARY_POINTS}.
      </p>
    </div>
  )
}

/**
 * The viewer's tier, ranks, points, streak and progress to the next tier:
 * the first card of every Community rail. Signed out, the same card asks
 * them to sign in. Server-safe: no hooks.
 */
export function StandingCard({
  standing,
  signedIn,
  initials,
  signInReturnTo,
  avatarUrl,
  background,
}: {
  readonly standing: Standing | null
  readonly signedIn: boolean
  /** The viewer's initials, for the avatar. */
  readonly initials: string
  /** Where "Sign in" comes back to. */
  readonly signInReturnTo: string
  readonly avatarUrl?: string | null
  readonly background?: ProfileBackground | null
}) {
  const tUi = useUiTranslations("ui")

  if (!signedIn) {
    return (
      <Shell>
        <Header initials={null} />
        <p
          className="m-0 text-[15px] leading-[1.55]"
          style={{ color: T.ink.dim }}
        >
          Sign in to see your rank, tier and progress.
        </p>
        <GlobalLink
          href={`/auth/signin?callbackUrl=${encodeURIComponent(signInReturnTo)}`}
          className="inline-flex min-h-11 items-center self-start rounded-full bg-(--t-accent-primary) px-5 text-[15px] font-semibold text-white no-underline hover:bg-(--t-accent-primary-hover)"
        >
          {tUi("sign_in")}{" "}
        </GlobalLink>
      </Shell>
    )
  }

  if (!standing) {
    return (
      <Shell>
        <Header
          initials={initials}
          avatarUrl={avatarUrl}
          background={background}
        />
        <p
          className="m-0 text-[15px] leading-[1.55]"
          style={{ color: T.ink.dim }}
        >
          Your standing couldn’t load right now. Try again in a minute.
        </p>
      </Shell>
    )
  }

  const tiles = [
    {
      label: "This month",
      value:
        standing.monthRank != null ? `#${fmt(standing.monthRank)}` : NOT_RANKED,
    },
    {
      label: tUi("all_time"),
      value:
        standing.globalRank != null && standing.totalPoints > 0
          ? `#${fmt(standing.globalRank)}`
          : NOT_RANKED,
    },
    { label: tUi("total_points"), value: fmt(standing.totalPoints) },
    {
      label: "Streak",
      value: `${fmt(standing.streak)} ${standing.streak === 1 ? "day" : "days"}`,
    },
  ]

  return (
    <Shell>
      <Header
        initials={initials}
        avatarUrl={avatarUrl}
        background={background}
        subtitle={`${standing.tier.name} · Level ${standing.tier.level}`}
      />
      <dl className="m-0 grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <Tile key={t.label} label={t.label} value={t.value} />
        ))}
      </dl>
      <Progress standing={standing} />
    </Shell>
  )
}
