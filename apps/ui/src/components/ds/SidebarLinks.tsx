import type { ReactNode } from "react"

import { cn } from "@/lib/styles"

/** Sidebar destinations: a full row per link, with a rule above each row. */
export function SidebarLinks({
  children,
  className,
}: {
  readonly children: ReactNode
  readonly className?: string
}) {
  return (
    <ul
      className={cn(
        "m-0 list-none divide-y divide-(--t-border-line) border-t border-(--t-border-line) p-0 text-base leading-normal [&>li>a]:flex [&>li>a]:min-h-12 [&>li>a]:items-center [&>li>a]:gap-3 [&>li>a]:py-3 [&>li>a]:font-semibold [&>li>a]:text-(--t-accent-primary) [&>li>a]:underline [&>li>a]:underline-offset-4 [&>li>a:focus-visible]:rounded-sm [&>li>a:focus-visible]:outline-2 [&>li>a:focus-visible]:outline-offset-2 [&>li>a:focus-visible]:outline-(--t-accent-primary) [&>li>a:hover]:text-(--t-accent-primary-hover)",
        className
      )}
    >
      {children}
    </ul>
  )
}
