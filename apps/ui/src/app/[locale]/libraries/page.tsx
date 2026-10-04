// apps/ui/src/app/[locale]/libraries/page.tsx
import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import type { Locale } from "next-intl"
import { Suspense } from "react"

import { DismissiblePrompt } from "@/components/ds/DismissiblePrompt"
import GlobalHeader from "@/components/global/GlobalHeader"
import { FIND_CONTRIBUTE_PROMPT } from "@/components/home/homepage.content"
import FinalCtaSection from "@/components/home/sections/FinalCtaSection"
import {
  findQueryOf,
  findStateFromParams,
} from "@/components/index-page/find-helpers"
import { FindLibraryPage } from "@/components/index-page/FindLibraryPage"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { isPromptHidden } from "@/lib/dismissed-prompts"
import { libraryTotal, searchFind } from "@/lib/find-search"
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

/** The CMS's published-library count, for when search is unreachable. */
async function strapiLibraryTotal(): Promise<number> {
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const stats = (await fetch(
    `${strapiUrl}/api/libraries?pagination[pageSize]=1&fields[0]=id&status=published`,
    { next: { revalidate: 300 } }
  )
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)) as { meta?: { pagination?: { total?: number } } } | null

  return stats?.meta?.pagination?.total ?? 0
}

export default async function FindLibraryRoute(props: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await props.params
  const raw = await props.searchParams
  // The page's own state, so the first render already shows this URL's
  // results: one page of hits, never the whole index.
  const state = findStateFromParams(
    new URLSearchParams(
      Object.entries(raw).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value]] : []
      )
    )
  )
  const [initial, statsTotal, session, cookieStore] = await Promise.all([
    searchFind(findQueryOf(state, locale)).catch(() => null),
    libraryTotal(locale).catch(() => strapiLibraryTotal()),
    headers().then(getSessionSSR),
    cookies(),
  ])
  const signedIn = Boolean(session?.user)
  const showContribute = !isPromptHidden(
    "find-contribute",
    cookieStore,
    session?.user
  )

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale as Locale} />
      <main className="flex flex-1 flex-col">
        <Suspense>
          <FindLibraryPage
            initial={initial}
            statsTotal={statsTotal}
            contributeBand={
              showContribute ? (
                <DismissiblePrompt
                  prompt="find-contribute"
                  signedIn={signedIn}
                  className="mx-auto w-full max-w-[1360px] px-4 pt-8 sm:px-8"
                >
                  <FinalCtaSection
                    compact
                    band={FIND_CONTRIBUTE_PROMPT.band}
                    benefits={FIND_CONTRIBUTE_PROMPT.benefits}
                    signedIn={signedIn}
                    dismissLabel="Hide this"
                  />
                </DismissiblePrompt>
              ) : null
            }
          />
        </Suspense>
      </main>
    </div>
  )
}
