import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { PageHero } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { NetworkWorkspace } from "@/components/networks/NetworkWorkspace"
import { StaffAreaTabs } from "@/components/staff/StaffAreaTabs"
import { WidgetWorkspaceReady } from "@/components/widgets/WidgetWorkspaceReady"
import { sessionTeamsOf } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"

export default async function NetworksWorkspacePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ network?: string; request?: string }>
}) {
  const session = await getSessionSSR(await headers()),
    { network, request } = await searchParams
  if (!session?.user)
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(`/staff/networks${network ? `?${new URLSearchParams({ network, ...(request ? { request } : {}) })}` : ""}`)}`
    )
  const team = sessionTeamsOf(session.user)[0]
  const teamId = team?.id

  return (
    <>
      <PageHero
        staff
        compact
        title="Your *services & networks*"
        eyebrow="Institutional access"
        eyebrowIcon="mdi:domain"
        breadcrumb={[
          { label: "Staff area", href: "/staff" },
          { label: "Services & networks" },
        ]}
        lead="Review affiliations, request service management and follow grouped access updates."
        tabs={<StaffAreaTabs active="networks" teamId={teamId} />}
      />
      <Container className="py-10">
        <WidgetWorkspaceReady
          returnTo={`/staff/networks${network ? `?${new URLSearchParams({ network, ...(request ? { request } : {}) })}` : ""}`}
        >
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
