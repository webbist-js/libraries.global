import { T } from "@/lib/design-tokens"

export function StatBlock({
  value,
  label,
  size = "lg",
}: {
  readonly value: string | number
  readonly label: string
  readonly size?: "sm" | "lg"
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span
        style={{
          font: size === "lg" ? T.type.stat : T.type.h2,
          color: T.ink.base,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: T.font.sans,
          fontSize: "var(--type-body-small-size)",
          fontWeight: 600,
          color: T.ink.dim,
        }}
      >
        {label}
      </span>
    </div>
  )
}
