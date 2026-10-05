import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

import { AtlasContributeCard } from "@/components/atlas/AtlasContributeCard"
import { AtlasExplorer } from "@/components/atlas/AtlasExplorer"
import { DismissiblePrompt } from "@/components/ds/DismissiblePrompt"
import { getSessionSSR } from "@/lib/auth-server"
import { isPromptHidden } from "@/lib/dismissed-prompts"
import { buildMetadata } from "@/lib/seo/metadata"

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/map">): Promise<Metadata> {
  const { locale } = await params

  return buildMetadata({
    title: "Atlas: map of the world's libraries",
    description:
      "Find libraries anywhere on one interactive map. Filter by type, opening hours and facilities, and add data layers such as library density and record completeness.",
    path: "map",
    locale,
  })
}

export default async function MapPage({ params }: PageProps<"/[locale]/map">) {
  const { locale } = (await params) as { locale: Locale }
  setRequestLocale(locale)

  const [session, cookieStore] = await Promise.all([
    headers().then(getSessionSSR),
    cookies(),
  ])
  const signedIn = Boolean(session?.user)
  const showContribute = !isPromptHidden(
    "atlas-contribute",
    cookieStore,
    session?.user
  )

  return (
    <AtlasExplorer
      contributePrompt={
        showContribute ? (
          <DismissiblePrompt prompt="atlas-contribute" signedIn={signedIn}>
            <AtlasContributeCard signedIn={signedIn} />
          </DismissiblePrompt>
        ) : null
      }
    />
  )
}
