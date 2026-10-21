import type { Metadata } from "next"
import type { Locale } from "next-intl"

import { ContributionAccountGuard } from "@/components/contribute/ContributionAccountGuard"
import { MainContent } from "@/components/ds/MainContent"
import GlobalHeader from "@/components/global/GlobalHeader"
import { contributionAccountScope } from "@/lib/contribution-account-scope"
import { getContributionSession } from "@/lib/contribution-session-server"
import { T } from "@/lib/design-tokens"

// Default for every /contribute/* route: forms and auth-gated flows are not
// indexable. The hub (contribute/page.tsx) overrides this with index,follow.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function ContributeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const [{ locale }, session] = await Promise.all([
    params,
    getContributionSession(),
  ])

  return (
    <>
      <GlobalHeader locale={locale as Locale} />
      <MainContent style={{ background: T.bg.void }}>
        <ContributionAccountGuard
          expectedScope={contributionAccountScope(session?.user)}
        >
          {children}
        </ContributionAccountGuard>
      </MainContent>
    </>
  )
}
