import { T } from "@/lib/design-tokens"

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
    text: "var(--tint-national-fg)",
    border: "transparent",
    bg: "var(--tint-national-bg)",
  },
  ember: {
    text: "var(--tint-special-fg)",
    border: "transparent",
    bg: "var(--tint-special-bg)",
  },
  gold: {
    text: "#6B5420",
    border: "transparent",
    bg: "#F5EEDC",
  },
  ok: {
    text: "var(--tint-public-fg)",
    border: "transparent",
    bg: "var(--tint-public-bg)",
  },
  warn: {
    text: "#6B5420",
    border: "transparent",
    bg: "#F5EEDC",
  },
  danger: {
    text: "#A13A1A",
    border: "transparent",
    bg: "#F6E3DA",
  },
  dim: {
    text: "var(--tint-neutral-fg)",
    border: "transparent",
    bg: "var(--tint-neutral-bg)",
  },
}

export function Badge({
  label,
  color,
  dot,
  size = "sm",
}: {
  readonly label: string
  readonly color: BadgeColor
  readonly dot?: boolean
  readonly size?: "sm" | "md"
}) {
  const { text, border, bg } = COLOR_MAP[color]
  const dotColor = color === "dim" ? T.ink.faint : text

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: size === "md" ? "5px 12px" : "3px 10px",
        borderRadius: "999px",
        fontFamily: T.font.sans,
        fontSize: size === "md" ? "14px" : "13px",
        fontWeight: 600,
        color: text,
        border: `1px solid ${border}`,
        background: bg,
        whiteSpace: "nowrap",
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
      {label}
    </span>
  )
}
