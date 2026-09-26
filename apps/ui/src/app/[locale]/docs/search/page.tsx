import type { Metadata } from "next"
import type { Locale } from "next-intl"

import { PageShell } from "@/components/ds"
import GlobalHeader from "@/components/global/GlobalHeader"

import { DocsSearchClient } from "./_components/SearchClient"

export const metadata: Metadata = {
  title: "Search the docs",
  description: "Search the libraries.global documentation.",
  robots: { index: false, follow: true },
}

export default async function DocsSearchPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <PageShell className="flex flex-col">
      <GlobalHeader locale={locale as Locale} />
      <DocsSearchClient />
    </PageShell>
  )
}
