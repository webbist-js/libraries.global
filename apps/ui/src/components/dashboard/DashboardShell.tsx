import type { Locale } from "next-intl"
import { Suspense, type ReactNode } from "react"

import { DashboardFrame } from "@/components/dashboard/DashboardFrame"
import { MainContent } from "@/components/ds/MainContent"
import GlobalHeader from "@/components/global/GlobalHeader"
import { HomepageLoading } from "@/components/home/HomepageFrame"

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
        {/* This boundary persists across routes: keep a revealed page visible
            while a transition fetches the destination. Initial visits use the logo. */}
        <Suspense fallback={<HomepageLoading />}>{children}</Suspense>
      </MainContent>
    </DashboardFrame>
  )
}
