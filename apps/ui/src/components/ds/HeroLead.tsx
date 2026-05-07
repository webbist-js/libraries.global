import { T } from "@/lib/design-tokens"

interface HeroLeadProps {
  children: React.ReactNode
  /** Character-width cap. Defaults to "56ch". */
  maxWidth?: string
  className?: string
}

/**
 * Lead paragraph that sits beneath a hero title or section header.
 * Fraunces serif, light-weight (300), T.ink.dim, 21px / 1.5 line-height.
 * Margin is intentionally absent — control spacing from the parent.
 */
export function HeroLead({
  children,
  maxWidth = "56ch",
  className,
}: HeroLeadProps) {
  return (
    <p
      className={className}
      style={{
        fontFamily: T.font.serif,
        fontSize: "21px",
        lineHeight: 1.5,
        letterSpacing: "-.005em",
        color: T.ink.dim,
        fontWeight: 300,
        maxWidth,
        margin: 0,
      }}
    >
      {children}
    </p>
  )
}
