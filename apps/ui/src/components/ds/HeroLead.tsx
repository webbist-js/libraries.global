import { T } from "@/lib/design-tokens"

interface HeroLeadProps {
  children: React.ReactNode
  /** Character-width cap. Defaults to "52ch". */
  maxWidth?: string
  className?: string
}

/**
 * Lead paragraph that sits beneath a hero title or section header.
 * Light-weight (300), T.ink.dim, 15px / 1.68 line-height.
 * Margin is intentionally absent — control spacing from the parent.
 */
export function HeroLead({
  children,
  maxWidth = "52ch",
  className,
}: HeroLeadProps) {
  return (
    <p
      className={className}
      style={{
        fontSize: "15px",
        lineHeight: 1.68,
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
