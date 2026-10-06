import type { ReactNode } from "react"

/**
 * A Drive title's `*italic*` markup as ink italics, for cards (the hero
 * uses `PageHero`'s indigo italics instead).
 */
export function DriveTitle({ title }: { readonly title: string }): ReactNode {
  return title.split(/(\*[^*]+\*)/g).map((part, i) =>
    part.length > 2 && part.startsWith("*") && part.endsWith("*") ? (
      <em key={i} style={{ fontStyle: "italic", fontWeight: 400 }}>
        {part.slice(1, -1)}
      </em>
    ) : (
      part
    )
  )
}
