import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { PageHero } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import { StaffLoadError } from "@/components/staff/StaffLoadError"
import { getSessionSSR } from "@/lib/auth-server"
import type { TeamInvitePreview } from "@/lib/staff/types"
import { fetchStaff } from "@/lib/staff-proxy"

import { TeamJoin } from "./_components/TeamJoin"

/**
 * Accept a Team invite. Signed out: to sign-in and back. The invite shows
 * the Team, who sent it and the masked email it went to; the signed-in
 * email must match before "Join" works (Strapi checks again).
 */
export default async function TeamJoinPage({
  params,
}: {
  readonly params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!/^[a-f0-9]{64}$/.test(token)) notFound()
  const session = await getSessionSSR(await headers())
  if (!session?.user)
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(`/staff/team/join/${token}`)}`
    )
  const result = await fetchStaff<TeamInvitePreview>(
    session.user,
    `teams/join/${token}`,
    "access"
  )
  if (result.status === 404) notFound()
  const invite = result.status === 200 ? result.body : null

  return (
    <>
      <PageHero
        compact
        breadcrumb={[
          { label: "Staff area", href: "/staff" },
          { label: "Join a team" },
        ]}
        eyebrow="Team invite"
        eyebrowIcon="mdi:account-group-outline"
        title={invite ? `Join *${invite.teamName}*` : "Join a *team*"}
        lead={
          invite
            ? `${invite.invitedByName} invited you${invite.teamRole === "organiser" ? " as an organiser" : ""}. Members get Pro and staff access on the team’s libraries.`
            : "Accept an invite from a team organiser."
        }
      />
      <Container className="py-10">
        {invite ? (
          <TeamJoin
            token={token}
            invite={invite}
            emailVerified={session.user.emailVerified === true}
          />
        ) : (
          <StaffLoadError what="The invite" status={result.status} />
        )}
      </Container>
    </>
  )
}
