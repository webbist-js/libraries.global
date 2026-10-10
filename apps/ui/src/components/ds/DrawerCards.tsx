"use client"

import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

import { Badge } from "./Badge"

export const DRAWER_CARD = "rounded-[20px] border"
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
