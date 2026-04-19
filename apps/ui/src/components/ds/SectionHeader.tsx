import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"

export function SectionHeader({
  children,
  italic,
  as: Tag = "h2",
}: {
  readonly children: ReactNode
  readonly italic?: string
  readonly as?: "h1" | "h2" | "h3"
}) {
  return (
    <Tag
      style={{
        fontFamily: T.font.serif,
        fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
        fontWeight: 600,
        lineHeight: 1.1,
        letterSpacing: "-0.02em",
        color: T.ink.base,
        margin: 0,
      }}
    >
      {children}
      {italic ? (
        <em
          style={{
            color: T.ink.low,
            fontStyle: "italic",
            fontWeight: 400,
          }}
        >
          {" "}
          {italic}
        </em>
      ) : null}
    </Tag>
  )
}
