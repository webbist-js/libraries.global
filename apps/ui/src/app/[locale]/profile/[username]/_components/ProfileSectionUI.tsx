import { Icon } from "@iconify/react"

import type { PublicSubmission } from "@/app/api/profile/[username]/contributions/route"
import {
  RARITY_COLOR,
  type BadgeDefinition,
  type BadgeRarity,
} from "@/lib/badges"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

// Shared v2 profile primitives, used by the Overview, Libraries, Recognition
// and Contributions tabs so they stay visually in sync.

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
        fontFamily: T.font.serif,
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
      className="text-[15px] font-semibold underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-current"
      style={{ color: T.accent.primary }}
    >
      {children}
    </Link>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  bg,
  fg,
  icon,
  compactValue = false,
}: {
  label: string
  value: string
  bg: string
  fg: string
  icon: string
  /** Smaller numeral for long text values (e.g. tier names). */
  compactValue?: boolean
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-2.5 rounded-[20px] px-5 py-[18px]"
      style={{ background: bg }}
    >
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-full"
        style={{ background: "#fff", color: fg }}
      >
        <Icon icon={icon} width={19} height={19} />
      </span>
      <span
        className="truncate"
        style={{
          fontFamily: T.font.serif,
          fontSize: compactValue ? "30px" : "40px",
          lineHeight: compactValue ? "40px" : 1,
          color: T.ink.base,
        }}
      >
        {value}
      </span>
      <span className="text-[15px] font-semibold" style={{ color: fg }}>
        {label}
      </span>
    </div>
  )
}

// ── Contribution rows ─────────────────────────────────────────────────────────

export const KIND_META: Record<
  string,
  { tint: string; icon: string; label: string }
> = {
  new_library: {
    tint: "public",
    icon: "mdi:book-plus-outline",
    label: "Added a library",
  },
  library_edit: {
    tint: "academic",
    icon: "mdi:pencil-outline",
    label: "Edited a record",
  },
  correction: {
    tint: "special",
    icon: "mdi:flag-outline",
    label: "Suggested a correction",
  },
  wiki_edit: {
    tint: "national",
    icon: "mdi:book-edit-outline",
    label: "Knowledge edit",
  },
  library_claim: {
    tint: "national",
    icon: "mdi:shield-check-outline",
    label: "Stewardship",
  },
  topic_suggestion: {
    tint: "neutral",
    icon: "mdi:tag-outline",
    label: "Suggested a topic",
  },
  blog_submission: {
    tint: "neutral",
    icon: "mdi:newspaper-variant-outline",
    label: "Submitted an article",
  },
  default: {
    tint: "neutral",
    icon: "mdi:message-text-outline",
    label: "Contribution",
  },
}

export const STATUS_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  approved: {
    label: "Accepted",
    color: "var(--tint-public-fg)",
    icon: "mdi:check-circle-outline",
  },
  pending: {
    label: "In review",
    color: "var(--tint-academic-fg)",
    icon: "mdi:clock-outline",
  },
  rejected: {
    label: "Not applied",
    color: T.accent.danger,
    icon: "mdi:close-circle-outline",
  },
  needs_info: {
    label: "Needs info",
    color: T.accent.warn,
    icon: "mdi:help-circle-outline",
  },
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return "Just now"
  if (h < 24) return `${h}h ago`
  const d = Math.floor(diff / 86_400_000)
  if (d === 1) return "Yesterday"
  if (d < 7) return `${d} days ago`
  if (d < 30) return `${Math.floor(d / 7)} weeks ago`

  return `${Math.floor(d / 30)} months ago`
}

export function ContributionRow({
  item,
  points,
  showStatusIcon = false,
}: {
  item: PublicSubmission
  /** Points earned for this contribution, shown under the date. */
  points?: number | null
  showStatusIcon?: boolean
}) {
  const kind = KIND_META[item.submissionType] ?? KIND_META.default!
  const status = STATUS_META[item.status] ?? STATUS_META.pending!

  return (
    <li
      className="flex items-start gap-3.5 border-t px-6 py-4"
      style={{ borderTopColor: T.border.divider }}
    >
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-[14px]"
        style={{
          background: `var(--tint-${kind.tint}-bg)`,
          color: `var(--tint-${kind.tint}-fg)`,
        }}
      >
        <Icon icon={kind.icon} width={19} height={19} />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="m-0 text-[14px] font-semibold"
          style={{ color: T.ink.dim }}
        >
          {kind.label}
        </p>
        <p
          className="m-0 truncate"
          style={{
            fontFamily: T.font.serif,
            fontSize: "21px",
            fontWeight: 500,
            color: T.ink.base,
          }}
        >
          {item.targetLabel ?? item.targetSlug ?? item.submissionType}
        </p>
        {item.editSummary ? (
          <p
            className="m-0 mt-0.5 truncate text-[15px]"
            style={{ color: T.ink.dim }}
          >
            “{item.editSummary}”
          </p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p
          className="m-0 inline-flex items-center gap-1 text-[14px] font-semibold"
          style={{ color: status.color }}
        >
          {showStatusIcon ? (
            <Icon
              icon={status.icon}
              width={16}
              height={16}
              aria-hidden="true"
            />
          ) : null}
          {status.label}
        </p>
        <p className="m-0 text-[13px]" style={{ color: T.ink.low }}>
          {relativeTime(item.createdAt)}
        </p>
        {points != null ? (
          <p
            className="m-0 text-[13px] font-semibold"
            style={{ color: "var(--tint-public-fg)" }}
          >
            +{points} points
          </p>
        ) : null}
      </div>
    </li>
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
          className="block text-[16px] font-bold"
          style={{ color: earned ? T.ink.base : T.ink.dim }}
        >
          {badge.name}
        </span>
        <span className="block text-[14px]" style={{ color: T.ink.dim }}>
          {badge.description}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className="text-[13px] font-semibold"
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
              className="rounded-full px-2 py-px text-[12px] font-semibold"
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
