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

const COLOR_MAP: Record<
  BadgeColor,
  { text: string; border: string; bg: string }
> = {
  aurora: {
    text: T.accent.aurora,
    border: "rgba(127,223,255,.3)",
    bg: "rgba(127,223,255,.08)",
  },
  violet: {
    text: T.accent.violet,
    border: "rgba(163,144,255,.3)",
    bg: "rgba(163,144,255,.08)",
  },
  ember: {
    text: T.accent.ember,
    border: "rgba(255,184,138,.3)",
    bg: "rgba(255,184,138,.08)",
  },
  gold: {
    text: T.accent.gold,
    border: "rgba(232,201,138,.3)",
    bg: "rgba(232,201,138,.08)",
  },
  ok: {
    text: T.accent.ok,
    border: "rgba(142,240,179,.3)",
    bg: "rgba(142,240,179,.08)",
  },
  warn: {
    text: T.accent.warn,
    border: "rgba(255,207,122,.3)",
    bg: "rgba(255,207,122,.08)",
  },
  danger: {
    text: T.accent.danger,
    border: "rgba(255,138,138,.3)",
    bg: "rgba(255,138,138,.08)",
  },
  dim: { text: T.ink.low, border: T.border.line, bg: T.bg.surface },
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
        gap: "5px",
        padding: size === "md" ? "5px 12px" : "3px 8px",
        borderRadius: "999px",
        fontFamily: T.font.mono,
        fontSize: size === "md" ? "11px" : "10px",
        letterSpacing: ".18em",
        textTransform: "uppercase",
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
