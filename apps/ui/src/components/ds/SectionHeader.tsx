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
      className={
        Tag === "h1" ? "type-h1" : Tag === "h3" ? "type-h3" : "type-h2"
      }
      style={{
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
