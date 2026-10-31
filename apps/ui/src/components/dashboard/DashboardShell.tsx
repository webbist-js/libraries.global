import type { Locale } from "next-intl"
import type { ReactNode } from "react"

import { DashboardFrame } from "@/components/dashboard/DashboardFrame"
import { MainContent } from "@/components/ds/MainContent"
import GlobalHeader from "@/components/global/GlobalHeader"

/** Server-owned navigation/data; the client frame only owns transient panels. */
export function DashboardShell({
  locale,
  children,
}: {
  readonly locale: Locale
  readonly children: ReactNode
}) {
  return (
    <DashboardFrame
      navigation={<GlobalHeader locale={locale} variant="dashboard" />}
    >
      <MainContent className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-clip">
        {children}
      </MainContent>
    </DashboardFrame>
  )
}
