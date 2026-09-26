import type { Metadata } from "next"
import type { Locale } from "next-intl"

import { PageShell } from "@/components/ds"
import GlobalHeader from "@/components/global/GlobalHeader"

import { BlogSearchClient } from "./_components/SearchClient"

export const metadata: Metadata = {
  title: "Search the blog",
  description: "Search articles on the libraries.global blog.",
  robots: { index: false, follow: true },
}

export default async function BlogSearchPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <PageShell className="flex flex-col">
      <GlobalHeader locale={locale as Locale} />
      <BlogSearchClient />
    </PageShell>
  )
}
