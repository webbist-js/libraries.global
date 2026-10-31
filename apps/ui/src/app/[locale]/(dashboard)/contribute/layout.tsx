import type { Metadata } from "next"
import type { Locale } from "next-intl"

import { ContributeWorkspace } from "@/components/contribute/ContributeWorkspace"
import { ContributionAccountGuard } from "@/components/contribute/ContributionAccountGuard"
import {
  KNOWLEDGE_SLUGS,
  knowledgeHref,
} from "@/components/staff/knowledge-links"
import { sessionCapabilities, staffLibrariesOf } from "@/lib/access-server"
import { contributionAccountScope } from "@/lib/contribution-account-scope"
import { getContributionSession } from "@/lib/contribution-session-server"

// Only the public hub overrides noindex; editors and private work stay private.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function ContributeLayout({
  children,
  params,
}: {
  readonly children: React.ReactNode
  readonly params: Promise<{ locale: string }>
}) {
  const [{ locale }, session] = await Promise.all([
    params,
    getContributionSession(),
  ])
  const caps = sessionCapabilities(session?.user)
  const guideHref = await knowledgeHref(
    KNOWLEDGE_SLUGS.contribute,
    locale as Locale
  )

  return (
    <ContributionAccountGuard
      expectedScope={contributionAccountScope(session?.user)}
    >
      <ContributeWorkspace
        editor={
          caps.set.has("docs.directEdit") || caps.set.has("journal.directEdit")
        }
        userId={session?.user?.id}
        library={
          caps.set.has("staff.area")
            ? staffLibrariesOf(session?.user)[0]
            : undefined
        }
        guideHref={guideHref ?? "/knowledge"}
      >
        {children}
      </ContributeWorkspace>
    </ContributionAccountGuard>
  )
}
