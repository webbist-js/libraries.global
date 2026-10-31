import type { Metadata } from "next"
import { headers } from "next/headers"
import { getTranslations as getUiTranslations } from "next-intl/server"

import { SuggestionReviewCard } from "@/components/community/SuggestionReviewCard"
import { SuggestionsWorkspace } from "@/components/community/SuggestionsWorkspace"
import { getSessionSSR } from "@/lib/auth-server"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { isVotable } from "@/lib/community/suggestions"
import {
  fetchOptionCatalogue,
  fetchSuggestionBoard,
} from "@/lib/community/suggestions-server"
import { T } from "@/lib/design-tokens"
import { openDriveCount } from "@/lib/drives/drive-view-server"
import { buildMetadata } from "@/lib/seo/metadata"

import { CommunitySectionHeader } from "../_components/CommunitySectionHeader"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  return buildMetadata({
    title: "Suggested additions",
    description:
      "Accessibility features, services, facilities and library types people want added to the lists. Vote for the ones you’d use.",
    path: "community/suggestions",
    locale,
  })
}

export default async function SuggestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ suggestion?: string | string[] }>
}) {
  const tUi = await getUiTranslations("ui")

  const { locale } = await params
  const requested = (await searchParams).suggestion
  const selectedSuggestionId =
    typeof requested === "string" && isDocumentIdParam(requested)
      ? requested
      : undefined
  const [board, optionCatalogue, session, openDrives] = await Promise.all([
    fetchSuggestionBoard(),
    fetchOptionCatalogue(locale),
    getSessionSSR(await headers()),
    openDriveCount(locale),
  ])
  const suggestions = board.data
  const t = await getUiTranslations("optionSuggestions")
  const optionNames = {
    accessibility: optionCatalogue.accessibility.map((item) => item.name),
    amenities: optionCatalogue.amenities.map((item) => item.name),
    services: optionCatalogue.services.map((item) => item.name),
    library_types: optionCatalogue.library_types.map((item) => item.name),
  }
  const now = new Date()
  const votableCount = suggestions.filter(isVotable).length

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <CommunitySectionHeader
        section={tUi("suggestions")}
        title={t("title")}
        lead={t("lead")}
        leadPlacement="left"
        counts={{ noticeboard: openDrives, suggestions: votableCount }}
      >
        <SuggestionReviewCard round={board.round} />
      </CommunitySectionHeader>

      <SuggestionsWorkspace
        initial={suggestions}
        optionNames={optionNames}
        optionCatalogue={optionCatalogue}
        signedIn={Boolean(session?.user)}
        now={now.toISOString()}
        round={board.round}
        selectedSuggestionId={selectedSuggestionId}
      />
    </div>
  )
}
