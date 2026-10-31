import type { CSSProperties, ReactNode } from "react"

/** Keep parent-first ordering in the reader; this wrapper only draws the branch. */
export function DiscussionReplyBranch({
  depth,
  compact = false,
  children,
}: {
  readonly depth: number
  readonly compact?: boolean
  readonly children: ReactNode
}) {
  return (
    <div
      className={
        compact
          ? depth
            ? "ml-3 border-l-2 border-(--t-palette-violet-bg) pl-3 sm:ml-6 sm:pl-5"
            : undefined
          : "discussion-reply-branch"
      }
      data-reply-depth={depth}
      style={
        compact
          ? undefined
          : ({
              "--discussion-depth": Math.min(Math.max(depth, 0) + 1, 3),
            } as CSSProperties)
      }
    >
      {children}
    </div>
  )
}
