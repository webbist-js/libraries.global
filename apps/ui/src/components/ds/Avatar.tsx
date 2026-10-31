import { T, TYPE_TINT, type TypeTintKey } from "@/lib/design-tokens"

const GRADIENTS = [
  `linear-gradient(135deg, ${T.accent.aurora}, ${T.accent.violet})`,
  `linear-gradient(135deg, ${T.accent.ember}, ${T.accent.gold})`,
  `linear-gradient(135deg, ${T.accent.violet}, ${T.accent.aurora})`,
  `linear-gradient(135deg, ${T.accent.gold}, ${T.accent.ok})`,
]

const SIZES = { sm: "28px", md: "36px", lg: "48px", xl: "64px" } as const
const FONT_SIZES = { sm: "10px", md: "12px", lg: "16px", xl: "26px" } as const

/**
 * Initials in a disc. `variant="tint"` is the v2 look for lists of people
 * (staff, teams): a pale indigo disc with indigo serif initials, the same
 * for everyone. The default gradient disc remains for older callers.
 */
export function Avatar({
  initials,
  index = 0,
  size = "md",
  title,
  variant = "gradient",
  tint,
}: {
  readonly initials: string
  readonly index?: number
  readonly size?: "sm" | "md" | "lg" | "xl"
  readonly title?: string
  readonly variant?: "gradient" | "tint"
  readonly tint?: TypeTintKey
}) {
  const tinted = variant === "tint"
  const palette = tint
    ? TYPE_TINT[tint]
    : { bg: T.accent.chip, fg: T.accent.primaryHover }
  const gradient =
    GRADIENTS[
      ((index % GRADIENTS.length) + GRADIENTS.length) % GRADIENTS.length
    ]
  const dim = SIZES[size]
  const fs = FONT_SIZES[size]

  return (
    <div
      title={title}
      style={{
        width: dim,
        height: dim,
        borderRadius: "50%",
        background: tinted ? palette.bg : gradient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: T.font.sans,
          fontSize: fs,
          color: tinted ? palette.fg : T.ink.inverse,
          fontWeight: tinted && (tint || size === "xl") ? 400 : 600,
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        {Array.from(initials.trim()).slice(0, 2).join("").toUpperCase() || "?"}
      </span>
    </div>
  )
}
