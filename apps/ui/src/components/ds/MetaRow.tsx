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
        fontFamily: T.font.sans,
        fontSize: "var(--type-body-small-size)",
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
          {i > 0 && <span style={{ color: T.ink.faint }}>{separator}</span>}
          {item}
        </span>
      ))}
    </p>
  )
}
