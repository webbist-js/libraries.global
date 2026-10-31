import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import type { Locale } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"

import { AtlasContributeCard } from "@/components/atlas/AtlasContributeCard"
import { AtlasExplorer } from "@/components/atlas/AtlasExplorer"
import { AtlasFeedbackButton } from "@/components/atlas/AtlasFeedbackButton"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import { DismissiblePrompt } from "@/components/ds/DismissiblePrompt"
import { scalableAtlasEnabled, ATLAS_COHORT_COOKIE } from "@/lib/atlas-rollout"
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

  const [session, cookieStore, ui] = await Promise.all([
    headers().then(getSessionSSR),
    cookies(),
    getTranslations({ locale, namespace: "ui" }),
  ])
  const signedIn = Boolean(session?.user)
  const showContribute = !isPromptHidden(
    "atlas-contribute",
    cookieStore,
    session?.user
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h1 className="type-h1 sr-only">
        Atlas: map of the world&apos;s libraries
      </h1>
      <RecordToolbar items={[{ label: ui("atlas") }]} />
      <div className="relative min-h-0 flex-1">
        <AtlasExplorer
          feedbackPrompt={<AtlasFeedbackButton />}
          scalable={scalableAtlasEnabled(
            cookieStore.get(ATLAS_COHORT_COOKIE)?.value
          )}
          contributePrompt={
            showContribute ? (
              <DismissiblePrompt prompt="atlas-contribute" signedIn={signedIn}>
                <AtlasContributeCard signedIn={signedIn} />
              </DismissiblePrompt>
            ) : null
          }
        />
      </div>
    </div>
  )
}
