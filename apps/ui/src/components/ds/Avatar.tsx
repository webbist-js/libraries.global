import { T } from "@/lib/design-tokens"

const GRADIENTS = [
  `linear-gradient(135deg, ${T.accent.aurora}, ${T.accent.violet})`,
  `linear-gradient(135deg, ${T.accent.ember}, ${T.accent.gold})`,
  `linear-gradient(135deg, ${T.accent.violet}, ${T.accent.aurora})`,
  `linear-gradient(135deg, ${T.accent.gold}, ${T.accent.ok})`,
]

const SIZES = { sm: "28px", md: "36px", lg: "48px" } as const
const FONT_SIZES = { sm: "10px", md: "12px", lg: "16px" } as const

export function Avatar({
  initials,
  index = 0,
  size = "md",
  title,
}: {
  readonly initials: string
  readonly index?: number
  readonly size?: "sm" | "md" | "lg"
  readonly title?: string
}) {
  const gradient = GRADIENTS[index % GRADIENTS.length]
  const dim = SIZES[size]
  const fs = FONT_SIZES[size]

  return (
    <div
      title={title}
      style={{
        width: dim,
        height: dim,
        borderRadius: "50%",
        background: gradient,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: T.font.serif,
          fontSize: fs,
          color: T.bg.deep,
          fontWeight: 600,
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        {initials.slice(0, 2).toUpperCase()}
      </span>
    </div>
  )
}
