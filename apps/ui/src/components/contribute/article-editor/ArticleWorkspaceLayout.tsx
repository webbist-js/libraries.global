import type { ReactNode } from "react"

import { cn } from "@/lib/styles"

/** Room for two reading columns; the publishing rail moves below on tablets. */
export function ArticleWorkspaceLayout({
  wide,
  children,
}: {
  readonly wide: boolean
  readonly children: ReactNode
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 [--spacing:0.25rem] sm:px-8",
        wide ? "max-w-[1600px]" : "max-w-[1360px]"
      )}
    >
      <div
        className={cn(
          "grid min-w-0 grid-cols-1 items-start gap-6",
          wide
            ? "xl:grid-cols-[minmax(0,1fr)_300px]"
            : "lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]"
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function ArticleWorkspaceSidebar({
  wide,
  children,
}: {
  readonly wide: boolean
  readonly children: ReactNode
}) {
  return (
    <aside
      className={cn(
        "flex min-w-0 flex-col gap-4 self-start",
        wide
          ? "xl:sticky xl:top-(--sticky-content-top) xl:max-h-(--sticky-content-max-height) xl:overflow-y-auto xl:overscroll-contain"
          : "lg:sticky lg:top-(--sticky-content-top) lg:max-h-(--sticky-content-max-height) lg:overflow-y-auto lg:overscroll-contain"
      )}
    >
      {children}
    </aside>
  )
}
