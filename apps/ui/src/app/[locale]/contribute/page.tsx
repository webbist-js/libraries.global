import { headers } from "next/headers"

import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"

import { ContributeGuidelinesSection } from "./_components/ContributeGuidelinesSection"
import { ContributeHeroSection } from "./_components/ContributeHeroSection"
import { ContributePathCards } from "./_components/ContributePathCards"

export default async function ContributePage() {
  const session = await getSessionSSR(await headers())

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeHeroSection />
      <ContributePathCards
        isSignedIn={!!session?.user}
        isVerifiedLibrarian={false}
      />
      <ContributeGuidelinesSection />
    </div>
  )
}
