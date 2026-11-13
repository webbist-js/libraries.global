"use client"

import { useTranslations } from "next-intl"
import { useSyncExternalStore } from "react"

import { createFindContributePrompt } from "@/components/home/homepage.content"
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
  const t = useTranslations("homepageFallback")
  const prompt = createFindContributePrompt(t)
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
        ...prompt.band,
        title: t("placeTitle", { name }),
        secondaryHref: addHref,
      }}
      benefits={prompt.benefits}
    />
  )
}
