import type { Metadata } from "next"

import { SuggestedAdditions } from "@/components/community/SuggestedAdditions"
import { T } from "@/lib/design-tokens"
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
      "Services, amenities and accessibility features contributors want added to the lists. Vote for the ones you'd use.",
    path: "community/suggestions",
    locale,
  })
}

export default function SuggestionsPage() {
  return (
    <div
      style={{ minHeight: "100vh", background: T.bg.void, color: T.ink.base }}
    >
      <CommunitySectionHeader
        section="Suggestions"
        title="What should the lists *include?*"
        lead="When contributors correct a library, they can name an option the lists don't have yet. Vote for the ones you'd use; the editorial board decides monthly."
      />
      <div className="mx-auto w-full max-w-[880px] px-4 pt-8 pb-16 sm:px-8">
        <SuggestedAdditions
          variant="page"
          signInReturnTo="/community/suggestions"
        />
      </div>
    </div>
  )
}
