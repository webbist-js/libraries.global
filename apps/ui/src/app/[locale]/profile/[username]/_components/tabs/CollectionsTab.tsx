import { T } from "@/lib/design-tokens"

// TODO: Implement when Collection content type is built.
// Will show: curated reading lists, exhibitions, and cross-library indexes assembled by the user.
export function CollectionsTab() {
  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "12px",
        padding: "48px",
        textAlign: "center",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <p
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".18em",
          textTransform: "uppercase",
          color: T.ink.faint,
          margin: "0 0 8px",
        }}
      >
        Collections — coming next
      </p>
      <p style={{ fontSize: "14px", color: T.ink.faint, margin: 0 }}>
        Curated reading lists, exhibitions, and cross-library indexes will
        appear here.
      </p>
    </div>
  )
}
