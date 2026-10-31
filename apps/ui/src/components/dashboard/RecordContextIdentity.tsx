import type { ReactNode } from "react"

import { Link } from "@/lib/navigation"

/** Identity and immediate parent; the toolbar carries the complete hierarchy. */
export function RecordContextIdentity({
  title,
  eyebrow,
  parent,
  children,
}: {
  readonly title: string
  readonly eyebrow?: string | null
  readonly parent?: { href: string; label: string }
  readonly children?: ReactNode
}) {
  return (
    <>
      {parent ? (
        <Link className="record-parent-chip" href={parent.href}>
          ‹ {parent.label}
        </Link>
      ) : null}
      {eyebrow ? <p className="record-context-eyebrow">{eyebrow}</p> : null}
      <p className="type-page-inline" title={title}>
        {title}
      </p>
      {children}
    </>
  )
}
