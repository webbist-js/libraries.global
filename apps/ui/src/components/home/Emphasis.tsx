import type { CSSProperties } from "react"

/** Split `*emphasised*` CMS syntax, keyed by character offset (stable even
 * when the same fragment repeats). */
function splitEmphasis(text: string): { key: string; text: string }[] {
  const parts: { key: string; text: string }[] = []
  let offset = 0
  for (const part of text.split(/(\*[^*]+\*)/g)) {
    if (part) parts.push({ key: `${offset}`, text: part })
    offset += part.length
  }

  return parts
}

/** Renders CMS copy where `*words*` become an italic accent. */
export function Emphasis({
  text,
  emStyle,
}: {
  readonly text: string
  readonly emStyle?: CSSProperties
}) {
  return (
    <>
      {splitEmphasis(text).map(({ key, text: part }) =>
        part.startsWith("*") && part.endsWith("*") ? (
          <em key={key} style={{ fontWeight: 400, ...emStyle }}>
            {part.slice(1, -1)}
          </em>
        ) : (
          <span key={key}>{part}</span>
        )
      )}
    </>
  )
}

Emphasis.displayName = "Emphasis"

export default Emphasis
