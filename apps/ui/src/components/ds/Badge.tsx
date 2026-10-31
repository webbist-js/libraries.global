import { Icon } from "@iconify/react"
import type { CSSProperties } from "react"

import { T, TYPE_TINT } from "@/lib/design-tokens"

export type BadgeColor =
  | "aurora"
  | "violet"
  | "ember"
  | "gold"
  | "ok"
  | "warn"
  | "danger"
  | "dim"

// v2 tint pairs — solid pastel fills with dark ink, no alpha borders.
const COLOR_MAP: Record<
  BadgeColor,
  { text: string; border: string; bg: string }
> = {
  aurora: {
    text: "var(--t-accent-primary-hover)",
    border: "transparent",
    bg: "var(--t-accent-chip)",
  },
  violet: {
    text: TYPE_TINT.national.fg,
    border: "transparent",
    bg: TYPE_TINT.national.bg,
  },
  ember: {
    text: TYPE_TINT.special.fg,
    border: "transparent",
    bg: TYPE_TINT.special.bg,
  },
  gold: {
    text: "var(--t-palette-amber-fg)",
    border: "transparent",
    bg: "var(--t-palette-amber-bg)",
  },
  ok: {
    text: TYPE_TINT.public.fg,
    border: "transparent",
    bg: TYPE_TINT.public.bg,
  },
  warn: {
    text: "var(--t-palette-amber-fg)",
    border: "transparent",
    bg: "var(--t-palette-amber-bg)",
  },
  danger: {
    text: "var(--t-palette-coral-fg)",
    border: "transparent",
    bg: "var(--t-palette-coral-bg)",
  },
  dim: {
    text: TYPE_TINT.neutral.fg,
    border: "transparent",
    bg: TYPE_TINT.neutral.bg,
  },
}

export function Badge({
  label,
  color,
  dot,
  icon,
  size = "sm",
  style,
}: {
  readonly label: string
  readonly color: BadgeColor
  readonly dot?: boolean
  /** Iconify id shown before the label, in the badge's text colour. */
  readonly icon?: string
  readonly size?: "xs" | "sm" | "md"
  readonly style?: CSSProperties
}) {
  const { text, border, bg } = COLOR_MAP[color]
  const dotColor = color === "dim" ? T.ink.faint : text

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size === "xs" ? "4px" : "6px",
        padding:
          size === "md" ? "5px 12px" : size === "xs" ? "2px 8px" : "3px 10px",
        borderRadius: "999px",
        fontFamily: T.font.sans,
        fontSize: size === "md" ? "15px" : size === "xs" ? "13px" : "14px",
        ...(size === "xs" ? { lineHeight: 1.35 } : {}),
        fontWeight: 600,
        color: text,
        border: `1px solid ${border}`,
        background: bg,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            background: dotColor,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
      )}
      {icon ? (
        <Icon
          aria-hidden="true"
          icon={icon}
          width={size === "md" ? 16 : size === "xs" ? 12 : 14}
          height={size === "md" ? 16 : size === "xs" ? 12 : 14}
          style={{ color: text, flexShrink: 0 }}
        />
      ) : null}
      {label}
    </span>
  )
}
