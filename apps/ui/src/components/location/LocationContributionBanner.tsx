"use client"

import { useSyncExternalStore } from "react"

import { FIND_CONTRIBUTE_PROMPT } from "@/components/home/homepage.content"
import FinalCtaSection from "@/components/home/sections/FinalCtaSection"
import { authClient } from "@/lib/auth-client"

const subscribe = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

/** Reuse the Find libraries contribution band with this place selected. */
export function LocationContributionBanner({
  name,
  addHref = "/contribute/index/new",
}: {
  readonly name: string
  readonly addHref?: string
}) {
  const { data: session } = authClient.useSession()
  const hydrated = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot
  )

  return (
    <FinalCtaSection
      compact
      contained
      signedIn={hydrated && Boolean(session?.user)}
      band={{
        ...FIND_CONTRIBUTE_PROMPT.band,
        title: `Know a library in ${name}? *Put it on the map.*`,
        secondaryHref: addHref,
      }}
      benefits={FIND_CONTRIBUTE_PROMPT.benefits}
    />
  )
}
