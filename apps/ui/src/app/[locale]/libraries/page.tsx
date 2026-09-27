// apps/ui/src/app/[locale]/index/page.tsx
import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { Suspense, use } from "react"

import GlobalHeader from "@/components/global/GlobalHeader"
import { FindLibraryPage } from "@/components/index-page/FindLibraryPage"
import { T } from "@/lib/design-tokens"
import { searchLibrariesV2 } from "@/lib/meilisearch"
import { buildMetadata } from "@/lib/seo/metadata"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params

  // Filtered/queried variants (?q=, ?type=…) canonicalise to the bare page.
  return buildMetadata({
    title: "Find a library",
    description:
      "Search every published library record by name, place, type, accessibility and facilities. Filter by what's open now, or find libraries near you.",
    path: "libraries",
    locale,
  })
}

async function fetchInitial() {
  const search = await searchLibrariesV2({
    bulkLimit: 1000,
    withFacets: true,
  }).catch(() => null)

  let total = search?.hits.length ?? 0
  if (!search) {
    // Search service unreachable — fall back to the CMS count so the intro
    // line stays truthful while the error state shows in the results area.
    const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
    const stats = (await fetch(
      `${strapiUrl}/api/libraries?pagination[pageSize]=1&fields[0]=id&status=published`,
      { next: { revalidate: 300 } }
    )
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)) as {
      meta?: { pagination?: { total?: number } }
    } | null
    total = stats?.meta?.pagination?.total ?? 0
  }

  return {
    hits: search?.hits ?? null,
    facets: (search?.facetDistribution ?? null) as Record<
      string,
      Record<string, number>
    > | null,
    total,
  }
}

export default function FindLibraryRoute(props: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = use(props.params)
  const { hits, facets, total } = use(fetchInitial())

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale as Locale} />
      <main className="flex flex-1 flex-col">
        <Suspense>
          <FindLibraryPage
            initialHits={hits}
            initialFacetDistribution={facets}
            statsTotal={total}
          />
        </Suspense>
      </main>
    </div>
  )
}
