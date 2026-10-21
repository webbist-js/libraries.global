import type { Locale } from "next-intl"

import { MainContent } from "@/components/ds/MainContent"
import GlobalHeader from "@/components/global/GlobalHeader"
import { T } from "@/lib/design-tokens"

// Community pages are public and indexable, unlike /contribute: each page
// sets its own metadata with buildMetadata.
export default async function CommunityLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <>
      <GlobalHeader locale={locale as Locale} />
      <MainContent style={{ background: T.bg.void }}>{children}</MainContent>
    </>
  )
}
