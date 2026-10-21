import type { Metadata } from "next"
import type { Locale } from "next-intl"

import { MainContent } from "@/components/ds/MainContent"
import GlobalHeader from "@/components/global/GlobalHeader"
import { T } from "@/lib/design-tokens"

/**
 * The staff section: a hidden area for a library's verified staff. Every
 * page is noindex, and the proxy also tags responses (including redirects).
 * Contribute tabs: each library has its own shell (`[documentId]/layout`).
 * The site header is rendered here, as `/contribute` does, because the root
 * layout leaves it to each section.
 */
export const metadata: Metadata = {
  title: "Staff area",
  robots: { index: false, follow: false },
}

export default async function StaffSectionLayout({
  children,
  params,
}: {
  readonly children: React.ReactNode
  readonly params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <>
      <GlobalHeader locale={locale as Locale} />
      <MainContent style={{ background: T.bg.void }}>{children}</MainContent>
    </>
  )
}
