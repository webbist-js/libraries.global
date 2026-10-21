import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { PageHero } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { StaffAreaTabs } from "@/components/staff/StaffAreaTabs"
import { StaffLoadError } from "@/components/staff/StaffLoadError"
import { TeamBilling } from "@/components/staff/TeamBilling"
import { authDbPool } from "@/lib/auth"
import { getSessionSSR } from "@/lib/auth-server"
import { BillingError } from "@/lib/billing/config"
import { requireApiTeam } from "@/lib/team-api/team"
import { teamBillingDashboard } from "@/lib/team-billing/dashboard"
import { MIN_TEAM_SEATS, MAX_TEAM_SEATS } from "@/lib/team-billing/types"

export default async function TeamBillingPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    team?: string
    seats?: string
    payment?: string
  }>
}) {
  const [session, query] = await Promise.all([
    getSessionSSR(await headers()),
    searchParams,
  ])
  if (!session?.user)
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(`/staff/team/billing${query.team ? `?team=${query.team}` : ""}`)}`
    )
  if (!query.team) redirect("/staff/team")
  let data = null
  try {
    data = await teamBillingDashboard(
      authDbPool,
      await requireApiTeam(query.team, session.user)
    )
  } catch (error) {
    if (error instanceof BillingError && error.status === 404) notFound()
  }
  const wanted = Number(query.seats)
  const initialSeats =
    Number.isSafeInteger(wanted) &&
    wanted >= MIN_TEAM_SEATS &&
    wanted <= MAX_TEAM_SEATS
      ? wanted
      : (data?.membership?.seats ?? Math.max(MIN_TEAM_SEATS, data?.seats ?? 0))

  return (
    <>
      <PageHero
        staff
        tabs={<StaffAreaTabs active="billing" teamId={query.team} />}
        eyebrow="Team membership"
        title="Team billing"
        lead="Manage annual payment, seat allowances and renewal for your Team."
      />
      <Container className="py-10">
        {data ? (
          <TeamBilling
            key={data.teamId}
            initial={data}
            initialSeats={initialSeats}
            confirming={
              query.payment === "confirming" || query.payment === "updated"
            }
            refreshRequired={query.payment === "updated"}
          />
        ) : (
          <StaffLoadError what="Team billing" status={503} />
        )}
      </Container>
    </>
  )
}
