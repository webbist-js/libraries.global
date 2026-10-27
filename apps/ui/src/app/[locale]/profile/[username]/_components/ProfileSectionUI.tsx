import { Icon } from "@iconify/react"

import {
  RARITY_COLOR,
  type BadgeDefinition,
  type BadgeRarity,
} from "@/lib/badges"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

// Shared v2 profile primitives, used by the Overview, Libraries, Recognition
// and Contributions tabs so they stay visually in sync. Contribution rows
// live in `components/contributions` (My submissions uses them too) and the
// stat tile in `components/ds`.

// ── Card + titles ─────────────────────────────────────────────────────────────

export const CARD: React.CSSProperties = {
  border: `1px solid ${T.border.line}`,
  borderRadius: "20px",
  background: T.bg.deep,
}

export function SectionTitle({
  children,
  as: Tag = "p",
  id,
}: {
  children: React.ReactNode
  as?: "p" | "h2" | "h3"
  id?: string
}) {
  return (
    <Tag
      id={id}
      className="m-0"
      style={{
        fontFamily: T.font.sans,
        fontSize: "24px",
        fontWeight: 500,
        letterSpacing: "-0.01em",
        color: T.ink.base,
      }}
    >
      {children}
    </Tag>
  )
}

/** Indigo text link — "See all", "View leaderboard", etc. */
export function TextLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="text-base font-semibold underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-current"
      style={{ color: T.accent.primary }}
    >
      {children}
    </Link>
  )
}

// ── Badge tile ────────────────────────────────────────────────────────────────

const RARITY_LABEL: Record<BadgeRarity, string> = {
  COMMON: "Common",
  UNCOMMON: "Uncommon",
  RARE: "Rare",
  STATUS: "Status",
}

export function BadgeTile({
  badge,
  earned,
  awardedLabel,
  showRarity = false,
}: {
  badge: BadgeDefinition
  earned: boolean
  /** e.g. "May 2026" — appended to "Earned" when provided. */
  awardedLabel?: string | null
  showRarity?: boolean
}) {
  return (
    <li
      className="flex items-start gap-3 rounded-[16px] p-3.5"
      style={
        earned
          ? {
              background: "var(--tint-national-bg)",
              border: "1px solid transparent",
            }
          : {
              background: T.bg.void,
              border: `1px dashed ${T.border.hi}`,
            }
      }
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full"
        style={{
          background: "#fff",
          color: earned ? "var(--tint-national-fg)" : T.ink.low,
        }}
      >
        <Icon
          icon={earned ? badge.icon : "mdi:lock-outline"}
          width={18}
          height={18}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block text-base font-bold"
          style={{ color: earned ? T.ink.base : T.ink.dim }}
        >
          {badge.name}
        </span>
        <span className="block text-sm" style={{ color: T.ink.dim }}>
          {badge.description}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className="text-sm font-semibold"
            style={{
              color: earned ? "var(--tint-public-fg)" : T.ink.low,
            }}
          >
            {earned
              ? awardedLabel
                ? `Earned ${awardedLabel}`
                : "Earned"
              : "Locked"}
          </span>
          {showRarity ? (
            <span
              className="rounded-full px-2 py-px text-xs font-semibold"
              style={{
                background: T.bg.deep,
                border: `1px solid ${T.border.line}`,
                color: RARITY_COLOR[badge.rarity],
              }}
            >
              {RARITY_LABEL[badge.rarity]}
            </span>
          ) : null}
        </span>
      </span>
    </li>
  )
}
