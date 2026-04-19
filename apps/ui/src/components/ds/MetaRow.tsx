import { T } from "@/lib/design-tokens"

export function MetaRow({
  items,
  separator = "·",
}: {
  readonly items: (string | null | undefined)[]
  readonly separator?: string
}) {
  const nonEmpty = items.filter((x): x is string => x != null && x !== "")
  if (nonEmpty.length === 0) return null

  return (
    <p
      style={{
        fontFamily: T.font.mono,
        fontSize: "10.5px",
        color: T.ink.low,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        flexWrap: "wrap",
        margin: 0,
      }}
    >
      {nonEmpty.map((item, i) => (
        <span
          key={i}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          {i > 0 && <span style={{ color: T.ink.ghost }}>{separator}</span>}
          {item}
        </span>
      ))}
    </p>
  )
}
