import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"

import { PageHero } from "@/components/ds/PageHero"
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
  if (!session?.user) redirect(claimSignInHref("/staff/claim", params, locale))
  const guide = await knowledgeLink(KNOWLEDGE_SLUGS.staffArea, locale)

  return (
    <>
      <PageHero
        compact
        breadcrumb={[
          { label: tUi("staff_area"), href: "/staff" },
          { label: t("title") },
        ]}
        eyebrow={t("eyebrow")}
        eyebrowIcon="mdi:shield-check-outline"
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
