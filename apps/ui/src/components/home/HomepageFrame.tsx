import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { MainContent } from "@/components/ds/MainContent"
import { PageLoader } from "@/components/global/PageLoader"

/** Global navigation stays available while content streams. */
export function HomepageFrame({ children }: { readonly children: ReactNode }) {
  const t = useTranslations("ui")

  return (
    <DashboardPage
      title={t("home")}
      navigationHidden
      className="dashboard-home-page"
    >
      {children}
    </DashboardPage>
  )
}

export function HomepageContentLoading() {
  const t = useTranslations("ui")

  return (
    <MainContent>
      <PageLoader label={t("loading")} />
    </MainContent>
  )
}

export function HomepageLoading() {
  return (
    <HomepageFrame>
      <HomepageContentLoading />
    </HomepageFrame>
  )
}
