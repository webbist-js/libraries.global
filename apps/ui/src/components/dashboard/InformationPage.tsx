import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import {
  DashboardPage,
  type DashboardDestination,
} from "@/components/dashboard/DashboardPage"
import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { InformationNavigation } from "@/components/dashboard/InformationNavigation"
import { RecordContextIdentity } from "@/components/dashboard/RecordContextIdentity"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"

/** Shared reading shell for public information and policies. */
export function InformationPage({
  title,
  links,
  children,
  routeKey,
  className,
  navigationFooter,
}: {
  readonly title: string
  readonly links: readonly DashboardDestination[]
  readonly children: ReactNode
  readonly routeKey?: string
  readonly className?: string
  readonly navigationFooter?: ReactNode
}) {
  const ui = useTranslations("ui")
  const copy = useTranslations("dashboardInformation")

  return (
    <DashboardPage
      title={title}
      routeKey={routeKey}
      className={`dashboard-information-page ${className ?? ""}`}
      navigationHeading={
        <RecordContextIdentity
          title={title}
          parent={{ href: "/", label: ui("home") }}
        />
      }
      toolbar={
        <RecordToolbar
          items={[{ label: ui("home"), href: "/" }, { label: title }]}
        />
      }
      navigation={
        <InformationNavigation links={links} label={ui("on_this_page")} />
      }
      navigationFooter={
        navigationFooter ?? (
          <DashboardSidebarCta
            title={copy("title")}
            body={copy("body")}
            action={{ href: "/contribute", label: ui("contribute") }}
            secondary={{ href: "/plans", label: ui("plans_and_pricing") }}
          />
        )
      }
    >
      {children}
    </DashboardPage>
  )
}
