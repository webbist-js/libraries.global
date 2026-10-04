import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"

/**
 * One option in a group of radio cards: a real radio, styled as a card with
 * a tinted icon, a title and a hint. Wrap the cards in a `fieldset` or a
 * `role="radiogroup"` that names the group.
 */
export function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  icon,
  tint,
  title,
  hint,
}: {
  /** Shared by every card in the group. */
  readonly name: string
  readonly value: string
  readonly checked: boolean
  readonly onChange: () => void
  /** Iconify id, e.g. "mdi:earth". */
  readonly icon: string
  /** Icon circle colours, e.g. a `--tint-*-bg` / `--tint-*-fg` pair. */
  readonly tint: { bg: string; fg: string }
  readonly title: ReactNode
  readonly hint: ReactNode
}) {
  return (
    <label
      className="relative flex cursor-pointer flex-col gap-2 rounded-[16px] p-4 transition-colors has-focus-visible:outline-[3px] has-focus-visible:outline-offset-2 has-focus-visible:outline-(--t-accent-primary) has-focus-visible:outline-solid has-disabled:cursor-not-allowed"
      style={{
        border: `1.5px solid ${checked ? T.accent.primary : T.border.line}`,
        background: checked
          ? "color-mix(in srgb, var(--t-accent-chip) 45%, var(--t-bg-deep))"
          : T.bg.deep,
      }}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span className="flex items-start justify-between gap-2">
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-full"
          style={{ background: tint.bg, color: tint.fg }}
        >
          <Icon icon={icon} width={18} height={18} />
        </span>
        <Icon
          aria-hidden="true"
          icon={checked ? "mdi:check-circle" : "mdi:circle-outline"}
          width={22}
          height={22}
          style={{ color: checked ? T.accent.primary : T.border.hi }}
        />
      </span>
      <span
        className="text-[15.5px] font-semibold"
        style={{ color: T.ink.base }}
      >
        {title}
      </span>
      <span className="text-[14px] leading-[1.45]" style={{ color: T.ink.dim }}>
        {hint}
      </span>
    </label>
  )
}
