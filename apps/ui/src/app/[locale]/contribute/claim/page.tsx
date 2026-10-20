import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"

import { Container } from "@/components/elementary/Container"
import { LibraryClaimWorkspace } from "@/components/library-editor/LibraryClaimWorkspace"
import {
  knowledgeLink,
  KNOWLEDGE_SLUGS,
} from "@/components/staff/knowledge-links"
import { getSessionSSR } from "@/lib/auth-server"
import {
  claimSignInHref,
  selectedClaimLibrary,
  type ClaimParams,
} from "@/lib/library-claim"
import { privateMetadata } from "@/lib/seo/metadata"

import { ContributeSectionHeader } from "../_components/ContributeSectionHeader"

export const metadata = privateMetadata("Claim a library")

export default async function ClaimLibraryPage({
  searchParams,
}: {
  searchParams: Promise<ClaimParams>
}) {
  const session = await getSessionSSR(await headers())
  const params = await searchParams
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("libraryClaim"),
  ])

  if (!session?.user) {
    redirect(claimSignInHref("/contribute/claim", params, locale))
  }

  const guide = await knowledgeLink(KNOWLEDGE_SLUGS.staffArea, locale)

  return (
    <>
      <ContributeSectionHeader
        compact
        section={t("title")}
        title={t("title")}
        lead={t("lead")}
      />
      <Container className="py-8 sm:py-10">
        <LibraryClaimWorkspace
          initialLibrary={selectedClaimLibrary(params)}
          guide={guide}
        />
      </Container>
    </>
  )
}
