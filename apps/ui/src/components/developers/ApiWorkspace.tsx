import type { ReactNode } from "react"

import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { RecordContextIdentity } from "@/components/dashboard/RecordContextIdentity"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { WorkspaceNavigation } from "@/components/dashboard/WorkspaceNavigation"
import { Container } from "@/components/elementary/Container"

export const API_SECTIONS = {
  overview: {
    label: "Overview",
    title: "Build with library data",
    lead: "Search and retrieve published public Library records. Explore the docs, try a request, then connect your application with the Team API add-on.",
    icon: "mdi:code-tags",
  },
  keys: {
    label: "API keys",
    title: "API keys",
    lead: "Manage credentials for your Team. Each key shares your Team’s request and response-data allowance.",
    icon: "mdi:key-outline",
  },
  usage: {
    label: "Usage",
    title: "Usage",
    lead: "Track requests and response data across your Team’s keys. Allowances reset each calendar month.",
    icon: "mdi:chart-line",
  },
  reference: {
    label: "Request reference",
    title: "Request reference",
    lead: "Three endpoints for published public Library data. Keep the source credits and licences that travel with each record.",
    icon: "mdi:book-open-outline",
  },
  playground: {
    label: "Playground",
    title: "Playground",
    lead: "Make real API requests using your Team’s API key. Successful requests and response data count toward your Team’s shared monthly allowance.",
    icon: "mdi:play-outline",
  },
} as const
export type ApiSection = keyof typeof API_SECTIONS
export const apiSectionHref = (section: ApiSection) =>
  section === "overview" ? "/developers" : `/developers/${section}`

export function ApiWorkspace({
  section,
  team,
  teamName,
  children,
}: {
  readonly section: ApiSection
  readonly team: boolean
  readonly teamName?: string
  readonly children: ReactNode
}) {
  const current = API_SECTIONS[section]
  const tabs = (
    Object.entries(API_SECTIONS) as [
      ApiSection,
      (typeof API_SECTIONS)[ApiSection],
    ][]
  )
    .filter(([id]) => team || !["keys", "usage"].includes(id))
    .map(([id, item]) => ({
      id,
      label: item.label,
      icon: item.icon,
      href: apiSectionHref(id),
    }))

  return (
    <DashboardPage
      title="API"
      className="dashboard-workspace-page dashboard-api-page"
      navigationHeading={
        <RecordContextIdentity
          title="API"
          eyebrow="Libraries Global"
          parent={{
            href: team ? "/staff/teams" : "/",
            label: team ? "Your Team" : "Home",
          }}
        />
      }
      navigation={
        <WorkspaceNavigation
          tabs={tabs}
          activeId={section}
          label="API navigation"
        />
      }
      navigationFooter={
        <DashboardSidebarCta
          title="Sources travel with the data."
          body="Read published public fields with source credits and licences."
          action={{
            href: "/knowledge/data-api/team-api-quickstart",
            label: "First-request guide",
          }}
          secondary={
            team
              ? { href: "/staff/teams", label: "Back to your Team" }
              : { href: "/plans#plan-team", label: "Explore Teams + API" }
          }
        />
      }
      toolbar={
        <RecordToolbar
          items={[
            { label: "Home", href: "/" },
            {
              label: "API",
              href: section === "overview" ? undefined : "/developers",
            },
            ...(section === "overview" ? [] : [{ label: current.label }]),
          ]}
        />
      }
      overview={
        <div className="workspace-page-content">
          <WorkspacePageHeader
            title={
              team && section === "overview" ? "API overview" : current.title
            }
            context={teamName}
            density={section === "playground" ? "task" : "page"}
            lead={
              team && section === "overview"
                ? "Check your Team’s API add-on, manage keys and try a request."
                : current.lead
            }
          />
          <Container className="space-y-6 py-8 sm:py-10">{children}</Container>
        </div>
      }
    />
  )
}
