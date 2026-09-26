import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"

/**
 * Full-bleed hero h1 with the canonical size/weight/tracking.
 * Pass pre-parsed JSX as children — use parseHeroText() for *italic* markup.
 */
export function HeroTitle({ children }: { readonly children: ReactNode }) {
  return (
    <h1
      style={{
        fontFamily: T.font.serif,
        fontWeight: 500,
        fontSize: "clamp(44px,6vw,84px)",
        lineHeight: 1.02,
        letterSpacing: "-.02em",
        margin: 0,
        color: T.ink.base,
        textWrap: "balance",
      }}
    >
      {children}
    </h1>
  )
}

/**
 * Parse a hero title string that uses *word* markup for italic spans.
 *
 * v2: every *italic* span renders as an indigo italic em (matching the
 * homepage hero's emphasis treatment).
 *
 * Example: "Field *notes* from *the stacks.*"
 */
export function parseHeroText(text: string): ReactNode[] {
  const parts = text.split(/(\*[^*]+\*)/g)

  return parts.map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em
          key={i}
          style={{
            fontStyle: "italic",
            fontWeight: 400,
            color: T.accent.primary,
          }}
        >
          {part.slice(1, -1)}
        </em>
      )
    }

    return <span key={i}>{part}</span>
  })
}
