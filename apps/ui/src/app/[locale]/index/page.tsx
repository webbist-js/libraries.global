// apps/ui/src/app/[locale]/index/page.tsx
import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { Suspense, use } from "react"

import GlobalHeader from "@/components/global/GlobalHeader"
import { LibraryIndexPage } from "@/components/library-index/LibraryIndexPage"
import type { LibraryIndexStats } from "@/components/library-index/types"
import { T } from "@/lib/design-tokens"
import { searchLibraries } from "@/lib/meilisearch"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Index — Libraries of the World",
  description:
    "A complete, searchable, filterable register of every significant library on earth. Browse by continent, country, region, type and status.",
}

async function fetchPageData(): Promise<{
  stats: LibraryIndexStats
  initialHits: Awaited<ReturnType<typeof searchLibraries>>["hits"]
  initialTotal: number
}> {
  const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const [statsRes, firstPage] = await Promise.all([
    fetch(`${BASE}/api/library-stats`, {
      next: { revalidate: 1800 },
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    searchLibraries({
      sort: "featured:desc,name:asc",
      page: 0,
      hitsPerPage: 24,
    }).catch(() => null),
  ])

  const stats: LibraryIndexStats = (statsRes as LibraryIndexStats | null) ?? {
    totalLibraries: 0,
    totalCountries: 0,
    totalRegions: 0,
    percentOpen: 0,
  }

  return {
    stats,
    initialHits: firstPage?.hits ?? [],
    initialTotal: firstPage?.estimatedTotalHits ?? 0,
  }
}

export default function LibraryIndexRoute(props: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = use(props.params)
  const { stats, initialHits, initialTotal } = use(fetchPageData())

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.space, color: T.ink.base }}
    >
      <GlobalHeader locale={locale as Locale} />
      <Suspense>
        <LibraryIndexPage
          stats={stats}
          initialHits={initialHits}
          initialTotal={initialTotal}
        />
      </Suspense>
    </div>
  )
}
