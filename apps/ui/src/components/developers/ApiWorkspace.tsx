import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { DashboardSidebarCta } from "@/components/dashboard/DashboardSidebarCta"
import { RecordContextIdentity } from "@/components/dashboard/RecordContextIdentity"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { WorkspaceNavigation } from "@/components/dashboard/WorkspaceNavigation"
import {
  ApiPlaygroundNavigationProvider,
  ApiPlaygroundNavigation,
} from "@/components/developers/ApiPlaygroundNavigation"
import { Container } from "@/components/elementary/Container"
import { TeamNameContext } from "@/components/staff/TeamNameContext"

/** Section icons; labels, titles and leads are `developersWorkspace.sections.<id>`. */
export const API_SECTIONS = {
  overview: { icon: "mdi:code-tags" },
  keys: { icon: "mdi:key-outline" },
  usage: { icon: "mdi:chart-line" },
  reference: { icon: "mdi:book-open-outline" },
  playground: { icon: "mdi:play-outline" },
} as const
export type ApiSection = keyof typeof API_SECTIONS
export const apiSectionHref = (section: ApiSection) =>
  section === "overview" ? "/developers" : `/developers/${section}`

type ApiWorkspaceProps = {
  readonly section: ApiSection
  readonly team: boolean
  readonly teamName?: string
  readonly playgroundAvailable?: boolean
  readonly children: ReactNode
}

export function ApiWorkspace({
  section,
  team,
  teamName,
  children,
  playgroundAvailable,
}: ApiWorkspaceProps) {
  const tExisting = useTranslations()

  const t = useTranslations("developersWorkspace")
  const label = (id: ApiSection) => t(`sections.${id}.label`)
  const tabs = (
    Object.entries(API_SECTIONS) as [
      ApiSection,
      (typeof API_SECTIONS)[ApiSection],
    ][]
  )
    .filter(([id]) => team || !["keys", "usage"].includes(id))
    .map(([id, item]) => ({
      id,
      label: label(id),
      icon: item.icon,
      href: apiSectionHref(id),
    }))

  return (
    <ApiPlaygroundNavigationProvider
      sidebar={section === "playground" && playgroundAvailable}
    >
      <DashboardPage
        title={tExisting("ui.api")}
        className="dashboard-workspace-page dashboard-api-page"
        navigationHeading={
          <RecordContextIdentity
            title={tExisting("ui.api")}
            eyebrow="Libraries Global"
            parent={{ href: "/", label: t("home") }}
          />
        }
        navigation={
          <>
            <WorkspaceNavigation
              tabs={tabs}
              activeId={section}
              label={t("navigation")}
            />
            {section === "playground" && playgroundAvailable ? (
              <ApiPlaygroundNavigation />
            ) : null}
          </>
        }
        navigationFooter={
          <DashboardSidebarCta
            title={t("sidebarTitle")}
            body={t("sidebarBody")}
            action={{
              href: "/knowledge/data-api/team-api-quickstart",
              label: t("quickstart"),
            }}
            secondary={
              team
                ? { href: "/staff/teams", label: t("organisation") }
                : { href: "/plans#offer-api", label: t("comparePlans") }
            }
          />
        }
        toolbar={
          <RecordToolbar
            items={[
              { label: t("home"), href: "/" },
              {
                label: tExisting("ui.api"),
                href: section === "overview" ? undefined : "/developers",
              },
              ...(section === "overview" ? [] : [{ label: label(section) }]),
            ]}
          />
        }
        overview={
          <div className="workspace-page-content">
            <WorkspacePageHeader
              title={t(
                team && section === "overview"
                  ? "accountOverviewTitle"
                  : `sections.${section}.title`
              )}
              context={
                teamName ? <TeamNameContext name={teamName} /> : undefined
              }
              density={section === "playground" ? "task" : "page"}
              lead={t(
                team && section === "overview"
                  ? "accountOverviewLead"
                  : `sections.${section}.lead`
              )}
            />
            <Container className="space-y-6 py-8 sm:py-10">
              {children}
            </Container>
          </div>
        }
      />
    </ApiPlaygroundNavigationProvider>
  )
}
