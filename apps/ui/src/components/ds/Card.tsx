import type { CSSProperties, ReactNode } from "react"

import { T } from "@/lib/design-tokens"

export function Card({
  children,
  as: Tag = "div",
  hover,
  style,
  className,
}: {
  readonly children: ReactNode
  readonly as?: "div" | "article"
  readonly hover?: boolean
  readonly style?: CSSProperties
  readonly className?: string
}) {
  return (
    <Tag
      style={{
        background: T.bg.surface,
        border: `1px solid ${T.border.line}`,
        borderRadius: "16px",
        transition: hover ? "border-color 200ms" : undefined,
        ...style,
      }}
      className={className}
    >
      {children}
    </Tag>
  )
}
