import type { ReactNode } from "react"

import { Container } from "@/components/elementary/Container"

/** Sits outside the hero so the submenu remains sticky throughout the page. */
export function SectionNavigation({
  children,
}: {
  readonly children: ReactNode
}) {
  return (
    <div
      data-sticky-navigation=""
      className="sticky top-(--sticky-header-height) z-40 border-b border-(--t-border-line) bg-(--t-bg-deep) print:hidden"
    >
      <Container className="flex min-w-0 flex-col gap-x-6 lg:flex-row lg:items-stretch">
        {children}
      </Container>
    </div>
  )
}
