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
        fontWeight: 400,
        fontSize: "clamp(56px,8.4vw,128px)",
        lineHeight: 0.92,
        letterSpacing: "-.045em",
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
 * - First *italic* occurrence → aurora gradient + weight 300
 * - Subsequent *italic* occurrences → T.ink.low + weight 300
 *
 * Example: "Field *notes* from *the stacks.*"
 */
export function parseHeroText(text: string): ReactNode[] {
  const parts = text.split(/(\*[^*]+\*)/g)
  let italicsSeen = 0

  return parts.map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*")) {
      const word = part.slice(1, -1)
      const isFirst = italicsSeen === 0
      italicsSeen++

      if (isFirst) {
        return (
          <em
            key={i}
            style={{
              fontStyle: "italic",
              fontWeight: 300,
              background: `linear-gradient(180deg,${T.accent.aurora} 0%,#c8ebff 55%,${T.accent.violet} 120%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {word}
          </em>
        )
      }

      return (
        <em
          key={i}
          style={{ fontStyle: "italic", fontWeight: 300, color: T.ink.low }}
        >
          {word}
        </em>
      )
    }

    return <span key={i}>{part}</span>
  })
}
