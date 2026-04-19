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
          fontFamily: T.font.serif,
          fontWeight: 400,
          fontSize: size === "lg" ? "clamp(1.8rem, 4vw, 2.8rem)" : "1.4rem",
          color: T.ink.base,
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".18em",
          textTransform: "uppercase",
          color: T.ink.low,
        }}
      >
        {label}
      </span>
    </div>
  )
}
