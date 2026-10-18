"use client"

import { Icon } from "@iconify/react"
import type { PlanKey } from "@repo/access"
import { useTranslations as useUiTranslations } from "next-intl"
import { useId } from "react"

import { Badge } from "@/components/ds/Badge"
import type { ContributeMenu } from "@/hooks/useContributeMenu"
import type { ContributorTint } from "@/lib/contributor-shortcuts"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { planShortName } from "@/lib/plans"

/** A card monogram's tint pair: a library-type tint, or the indigo chip. */
export function tintOf(tint: ContributorTint): { bg: string; fg: string } {
  return tint === "accent"
    ? { bg: T.accent.chip, fg: T.accent.primaryHover }
    : TYPE_TINT[tint]
}

/** A tinted icon disc. Decorative: the title says it. */
export function CardMonogram({
  icon,
  tint,
  size = 32,
}: {
  readonly icon: string
  readonly tint: ContributorTint
  readonly size?: number
}) {
  const { bg, fg } = tintOf(tint)
  const glyph = Math.round(size * 0.53)

  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: bg, color: fg }}
    >
      <Icon icon={icon} width={glyph} height={glyph} />
    </span>
  )
}

/** "14" with its noun for screen readers: suggestions or submissions waiting. */
export function CountPill({
  count,
  what,
}: {
  readonly count: number
  readonly what: string
}) {
  return (
    <span
      className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-[13px] font-bold text-white"
      style={{ background: T.ink.base }}
    >
      {count.toLocaleString("en-GB")}
      <span className="sr-only"> {what}</span>
    </span>
  )
}

/** "Plan: Pro" on the Membership row: a held plan indigo, Free neutral. */
export function PlanPill({ plan }: { readonly plan: PlanKey }) {
  return (
    <Badge
      label={`Plan: ${planShortName(plan)}`}
      color={plan === "free" || plan === "public" ? "dim" : "aurora"}
    />
  )
}

/**
 * The Your libraries card's selector, for staff of several libraries. The
 * Edit record and Event feeds links follow it, so their labels say which.
 */
export function LibrarySelect({
  library,
}: {
  readonly library: ContributeMenu["library"]
}) {
  const tUi = useUiTranslations("ui")

  const id = useId()

  return (
    <div
      className="flex min-h-11 items-center gap-2 rounded-[12px] border px-2.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-(--t-accent-primary)"
      style={{ borderColor: T.border.hi, background: T.bg.surface }}
    >
      <label
        htmlFor={id}
        className="text-[13px] font-semibold whitespace-nowrap"
        style={{ color: T.ink.dim }}
      >
        {tUi("library")}{" "}
      </label>
      <select
        id={id}
        value={library.selectedId ?? ""}
        onChange={(e) => library.select(e.target.value)}
        className="min-w-0 flex-1 cursor-pointer truncate rounded-md border-0 bg-transparent text-[14px] font-semibold outline-none"
        style={{ color: T.ink.base, fontFamily: T.font.sans }}
      >
        {library.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  )
}
