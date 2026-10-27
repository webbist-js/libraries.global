import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"

/**
 * The contribution forms' shared field and button styles, and their field
 * label: the wizard, the photo upload and a drive's task panel.
 */

export const FIELD =
  "w-full rounded-[14px] border border-(--t-border-hi) bg-white px-4 py-3 text-base outline-none transition-colors focus:border-(--t-accent-primary)"
export const PRIMARY =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-colors"
export const SECONDARY =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full border bg-white px-5 text-base font-semibold transition-colors hover:bg-(--t-bg-surface)"

/** A field label with an optional dimmed hint after it ("Optional"). */
export function Label({
  htmlFor,
  children,
  hint,
}: {
  readonly htmlFor: string
  readonly children: ReactNode
  readonly hint?: string
}) {
  return (
    <label
      className="mb-2 block text-base font-semibold"
      htmlFor={htmlFor}
      style={{ color: T.ink.base }}
    >
      {children}
      {hint ? (
        <span className="font-normal" style={{ color: T.ink.dim }}>
          {" "}
          {hint}
        </span>
      ) : null}
    </label>
  )
}
