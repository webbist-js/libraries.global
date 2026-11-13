import { headers } from "next/headers"
import { getTranslations } from "next-intl/server"

import { FeatureAccessLanding } from "@/components/auth/FeatureAccessLanding"
import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { Container } from "@/components/elementary/Container"
import { NetworkWorkspace } from "@/components/networks/NetworkWorkspace"
import { StaffAreaTabs } from "@/components/staff/StaffAreaTabs"
import { WidgetWorkspaceReady } from "@/components/widgets/WidgetWorkspaceReady"
import { withMessages } from "@/i18n/scoped-messages"
import { sessionTeamsOf } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"

async function NetworksWorkspacePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ network?: string; request?: string }>
}) {
  const tStatic = await getTranslations("staticUi")

  const tExisting = await getTranslations()

  const session = await getSessionSSR(await headers()),
    { network, request } = await searchParams
  const query = new URLSearchParams({
    ...(network ? { network } : {}),
    ...(request ? { request } : {}),
  })
  const returnTo = `/staff/networks${query.size ? `?${query}` : ""}`
  if (!session?.user)
    return <FeatureAccessLanding feature="networks" returnTo={returnTo} />
  const team = sessionTeamsOf(session.user)[0]
  const teamId = team?.id

  return (
    <>
      <WorkspacePageHeader
        title={tExisting("staffWorkspace.networks")}
        breadcrumb={[
          { label: tExisting("ui.staff_area"), href: "/staff" },
          { label: tExisting("staffWorkspace.networks") },
        ]}
        lead={tStatic(
          "staffRoute.review_affiliations_request_service_management_and_follow_grouped_access_updates"
        )}
        tabs={<StaffAreaTabs active="networks" teamId={teamId} />}
      />
      <Container className="py-10">
        <WidgetWorkspaceReady returnTo={returnTo}>
          <NetworkWorkspace
            initialNetwork={network}
            initialRequestId={request}
            teamId={team?.role === "organiser" ? teamId : null}
          />
        </WidgetWorkspaceReady>
      </Container>
    </>
  )
}

export default withMessages(
  NetworksWorkspacePage,
  "[locale]/(dashboard)/staff/networks/page"
)
