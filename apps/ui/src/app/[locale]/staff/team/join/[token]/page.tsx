import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"

import { PageHero } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import {
  knowledgeLink,
  KNOWLEDGE_SLUGS,
} from "@/components/staff/knowledge-links"
import { StaffAreaTabs } from "@/components/staff/StaffAreaTabs"
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
  const [tUi, t, locale] = await Promise.all([
    getTranslations("ui"),
    getTranslations("teamInvitation"),
    getLocale(),
  ])

  const { token } = await params
  if (!/^[a-f0-9]{64}$/.test(token)) notFound()
  const session = await getSessionSSR(await headers())
  if (!session?.user)
    redirect(
      `/auth/signin?callbackUrl=${encodeURIComponent(`/staff/team/join/${token}`)}`
    )
  const [result, ...guideResults] = await Promise.all([
    fetchStaff<TeamInvitePreview>(
      session.user,
      `teams/join/${token}`,
      "access"
    ),
    knowledgeLink(KNOWLEDGE_SLUGS.teams, locale),
    knowledgeLink(KNOWLEDGE_SLUGS.staffArea, locale),
    knowledgeLink(KNOWLEDGE_SLUGS.plans, locale),
  ])
  const guides = guideResults.filter((guide) => guide !== null)
  if (result.status === 404) notFound()
  const invite = result.status === 200 ? result.body : null

  return (
    <>
      <PageHero
        compact
        centered
        breadcrumb={[
          { label: tUi("staff_area"), href: "/staff" },
          { label: t("pageLabel") },
        ]}
        eyebrow={t("eyebrow")}
        eyebrowIcon="mdi:account-group-outline"
        title={
          invite ? t("joinTitle", { team: invite.teamName }) : t("pageLabel")
        }
        plainTitle
        tabs={<StaffAreaTabs active="invite" />}
        lead={t("lead")}
      />
      <Container className="max-w-[1024px] py-8 sm:py-12">
        {invite ? (
          <TeamJoin
            token={token}
            invite={invite}
            emailVerified={session.user.emailVerified === true}
            guides={guides}
          />
        ) : (
          <StaffLoadError what={t("inviteLabel")} status={result.status} />
        )}
      </Container>
    </>
  )
}
