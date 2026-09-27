import type { Metadata } from "next"
import type { Locale } from "next-intl"

import GlobalHeader from "@/components/global/GlobalHeader"
import { SITE_NAME } from "@/lib/constants"
import { T } from "@/lib/design-tokens"

import { DocsSearchClient } from "./_components/SearchClient"

export const metadata: Metadata = {
  title: "Search the docs",
  description: `Search the ${SITE_NAME} documentation.`,
  robots: { index: false, follow: true },
}

export default async function DocsSearchPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale as Locale} />
      <DocsSearchClient />
    </div>
  )
}
