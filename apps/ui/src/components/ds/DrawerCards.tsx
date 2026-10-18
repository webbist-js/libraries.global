"use client"

import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

import { Badge } from "./Badge"

export const DRAWER_CARD = "rounded-[20px] border"
export const DRAWER_PILL =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-(--t-border-hi) bg-white px-3 text-[13px] font-semibold text-(--t-ink-base) no-underline transition-colors hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"

/** Compact workspace shortcuts, grouped on a single paper surface. */
export function DrawerSection({
  id,
  title,
  description,
  action,
  children,
}: {
  readonly id: string
  readonly title: string
  readonly description?: ReactNode
  readonly action?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-[22px] border border-(--t-border-line) bg-white p-4"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            id={id}
            className="m-0 font-serif text-[23px] leading-tight tracking-[-0.02em] text-(--t-ink-base)"
          >
            {title}
          </h3>
          {description ? (
            <p className="m-0 mt-1 text-[13px] leading-relaxed text-(--t-ink-dim)">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function DrawerAction({
  href,
  icon,
  label,
  description,
  tag,
  count,
  onClick,
}: {
  readonly href: string
  readonly icon: string
  readonly label: string
  readonly description?: string
  readonly tag?: "Mobile" | "Team"
  readonly count?: ReactNode
  readonly onClick?: () => void
}) {
  return (
    <Link
      href={href}
      aria-label={tag ? `${label} (${tag})` : undefined}
      onClick={onClick}
      className="group flex min-h-12 min-w-0 items-center gap-2.5 rounded-[12px] px-2 py-2 text-(--t-ink-base) no-underline transition-colors hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--t-accent-chip) text-(--t-accent-primary)">
        <Icon
          aria-hidden
          height={17}
          width={17}
          icon={tag === "Team" ? "mdi:lock-outline" : icon}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] leading-snug font-semibold">
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-[12px] leading-snug text-(--t-ink-dim)">
            {description}
          </span>
        ) : null}
      </span>
      {tag ? (
        <Badge label={tag} color={tag === "Mobile" ? "ok" : "aurora"} />
      ) : null}
      {count !== undefined ? (
        <span
          className={`min-w-6 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[12px] font-semibold tabular-nums ${typeof count === "number" && count > 0 ? "bg-[#19172c] text-white" : "bg-(--t-bg-space) text-(--t-ink-dim)"}`}
        >
          {count}
        </span>
      ) : null}
      <Icon
        aria-hidden
        height={15}
        width={15}
        icon="mdi:chevron-right"
        className="shrink-0 text-(--t-ink-low)"
      />
    </Link>
  )
}

export function DrawerFooter({
  href,
  label,
  shortcut,
  onClose,
}: {
  readonly href: string
  readonly label: string
  readonly shortcut: string
  readonly onClose: () => void
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-(--t-border-line) bg-white px-5 py-3">
      <Link
        href={href}
        onClick={onClose}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-(--t-accent-primary) px-5 text-[14px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)"
      >
        {label}
        <Icon aria-hidden height={16} width={16} icon="mdi:arrow-right" />
      </Link>
      <kbd
        className="rounded-md border border-(--t-border-line) bg-(--t-bg-surface) px-2 py-1 text-[12px] text-(--t-ink-dim)"
        style={{ fontFamily: T.font.mono }}
      >
        {shortcut}
      </kbd>
    </div>
  )
}
const TILE =
  "flex min-h-[104px] flex-col justify-between gap-6 rounded-[20px] border p-3.5 text-[16px] font-semibold leading-snug no-underline transition-colors hover:bg-(--t-bg-surface)"

export function DrawerTile({
  href,
  icon,
  label,
  tag,
}: {
  readonly href: string
  readonly icon: string
  readonly label: string
  /** "Mobile": a green tag. "Team": a lock and an indigo tag (not covered). */
  readonly tag?: "Mobile" | "Team"
}) {
  return (
    <Link
      aria-label={tag ? `${label} (${tag})` : label}
      href={href}
      className={TILE}
      style={{
        background: T.bg.deep,
        borderColor: T.border.line,
        color: T.ink.base,
      }}
    >
      <span className="flex w-full items-start justify-between gap-2">
        <Icon
          aria-hidden="true"
          className="shrink-0"
          height={20}
          icon={tag === "Team" ? "mdi:lock-outline" : icon}
          style={{ color: T.accent.primary }}
          width={20}
        />
        {tag ? (
          <Badge label={tag} color={tag === "Mobile" ? "ok" : "aurora"} />
        ) : null}
      </span>
      <span className="w-full">{label}</span>
    </Link>
  )
}

export function DrawerLinkCard({
  href,
  title,
  description,
}: {
  readonly href: string
  readonly title: string
  readonly description?: string | null
}) {
  return (
    <Link
      href={href}
      className={`${DRAWER_CARD} flex flex-col gap-2 px-3.5 py-3.5 no-underline transition-colors hover:bg-(--t-bg-surface)`}
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <span
        className="flex items-start gap-3 text-[16px] leading-snug font-semibold"
        style={{ color: T.ink.base }}
      >
        <Icon
          aria-hidden="true"
          className="mt-0.5 shrink-0"
          height={20}
          icon="mdi:pin-outline"
          style={{ color: T.accent.primary }}
          width={20}
        />
        <span>{title}</span>
      </span>
      {description ? (
        <span className="text-[14px]" style={{ color: T.ink.dim }}>
          {description}
        </span>
      ) : null}
    </Link>
  )
}
