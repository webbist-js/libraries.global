import { T } from "@/lib/design-tokens"

interface HeroLeadProps {
  children: React.ReactNode
  /** Character-width cap. Defaults to "56ch". */
  maxWidth?: string
  className?: string
}

/**
 * Lead paragraph that sits beneath a hero title or section header.
 * v2: Figtree 19px, T.ink.dim, 1.6 line-height.
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
        fontFamily: T.font.sans,
        fontSize: "19px",
        lineHeight: 1.6,
        color: T.ink.dim,
        fontWeight: 400,
        maxWidth,
        margin: 0,
      }}
    >
      {children}
    </p>
  )
}
