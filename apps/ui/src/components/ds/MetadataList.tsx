import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"

/** Label/value metadata shared by article readers and their supporting rails. */
export function MetadataList({
  rows,
}: {
  readonly rows: readonly { label: string; value: ReactNode }[]
}) {
  return (
    <dl className="m-0">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between gap-3 border-t py-2.5 first:border-t-0"
          style={{ borderColor: T.border.divider }}
        >
          <dt className="text-sm" style={{ color: T.ink.dim }}>
            {row.label}
          </dt>
          <dd
            className="m-0 text-right text-sm font-semibold"
            style={{ color: T.ink.base }}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
