import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

import { Card } from "./Card"

export function Pager({
  prev,
  next,
}: {
  readonly prev?: { label: string; href: string }
  readonly next?: { label: string; href: string }
}) {
  if (!prev && !next) return null

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}
    >
      {prev ? (
        <GlobalLink href={prev.href} style={{ textDecoration: "none" }}>
          <Card hover style={{ padding: "16px 20px" }}>
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                color: T.ink.faint,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                margin: "0 0 6px",
              }}
            >
              ← Previous
            </p>
            <p
              style={{
                fontFamily: T.font.sans,
                fontSize: "14px",
                color: T.ink.dim,
                lineHeight: 1.3,
                margin: 0,
              }}
            >
              {prev.label}
            </p>
          </Card>
        </GlobalLink>
      ) : (
        <div />
      )}
      {next ? (
        <GlobalLink href={next.href} style={{ textDecoration: "none" }}>
          <Card hover style={{ padding: "16px 20px", textAlign: "right" }}>
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                color: T.ink.faint,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                margin: "0 0 6px",
              }}
            >
              Next →
            </p>
            <p
              style={{
                fontFamily: T.font.sans,
                fontSize: "14px",
                color: T.ink.dim,
                lineHeight: 1.3,
                margin: 0,
              }}
            >
              {next.label}
            </p>
          </Card>
        </GlobalLink>
      ) : (
        <div />
      )}
    </div>
  )
}
