import { headers } from "next/headers"
import { getLocale, getTranslations } from "next-intl/server"

import { FeatureAccessLanding } from "@/components/auth/FeatureAccessLanding"
import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { Container } from "@/components/elementary/Container"
import { LibraryClaimWorkspace } from "@/components/library-editor/LibraryClaimWorkspace"
import {
  knowledgeLink,
  KNOWLEDGE_SLUGS,
} from "@/components/staff/knowledge-links"
import { StaffAreaTabs } from "@/components/staff/StaffAreaTabs"
import { sessionTeamsOf } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import {
  claimSignInHref,
  selectedClaimLibrary,
  type ClaimParams,
} from "@/lib/library-claim"
import { privateMetadata } from "@/lib/seo/metadata"

export const metadata = privateMetadata("Claim a library")

export default async function StaffClaimPage({
  searchParams,
}: {
  readonly searchParams: Promise<ClaimParams>
}) {
  const [session, params, locale, t, tUi] = await Promise.all([
    getSessionSSR(await headers()),
    searchParams,
    getLocale(),
    getTranslations("libraryClaim"),
    getTranslations("ui"),
  ])
  if (!session?.user)
    return (
      <FeatureAccessLanding
        feature="claim"
        signInHref={claimSignInHref("/staff/claim", params, locale)}
      />
    )
  const guide = await knowledgeLink(KNOWLEDGE_SLUGS.staffArea, locale)

  return (
    <>
      <WorkspacePageHeader
        breadcrumb={[
          { label: tUi("staff_area"), href: "/staff" },
          { label: t("title") },
        ]}
        title={t("title")}
        lead={t("lead")}
        tabs={
          <StaffAreaTabs
            active="claim"
            teamId={sessionTeamsOf(session.user)[0]?.id}
          />
        }
      />
      <Container className="py-8 sm:py-10">
        <LibraryClaimWorkspace
          context="staff"
          initialLibrary={selectedClaimLibrary(params)}
          guide={guide}
        />
      </Container>
    </>
  )
}
