import type { Locale } from "next-intl"

import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import { T } from "@/lib/design-tokens"
import type { JournalLandingData } from "@/lib/journal-landing"

import { BlogSearchBar } from "./BlogSearchBar"
import { JournalAllArticles } from "./JournalAllArticles"
import { JournalFeatureCard, JournalSideCard } from "./JournalCards"
import { JournalSectionBrowser } from "./JournalSectionBrowser"
import { JournalWriteCta } from "./JournalWriteCta"
import { MonthlyDispatchCard } from "./MonthlyDispatchCard"
import { MostReadCard } from "./MostReadCard"

export function BlogLandingPage({
  data,
  locale,
}: {
  readonly data: JournalLandingData
  readonly locale: Locale
}) {
  const {
    landing,
    query,
    sections,
    total,
    linkLocale,
    featured,
    editorsPick,
    sideStories,
    mostRead,
  } = data

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <main className="relative z-10 flex-1">
        <PageHero
          breadcrumb={[{ label: "Home", href: "/" }, { label: "Journal" }]}
          eyebrow={landing?.heroEyebrow ?? "The Library Journal · since 2024"}
          eyebrowIcon="mdi:notebook-outline"
          lead={
            landing?.heroText ??
            "Stories, histories and notes from librarians, archivists and researchers about the world’s libraries and the people in them."
          }
          title={landing?.heroTitle ?? "Field notes *from the stacks.*"}
        >
          <BlogSearchBar inputId="journal-search" />
        </PageHero>

        <Container className="pt-10 pb-20">
          {featured ? (
            <section aria-label="Top stories">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <JournalFeatureCard
                  article={featured}
                  editorsPick={editorsPick}
                  locale={linkLocale}
                />
                {sideStories.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {sideStories.map((article) => (
                      <JournalSideCard
                        article={article}
                        key={article.documentId}
                        locale={linkLocale}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <JournalSectionBrowser
            query={query}
            sections={sections}
            total={total}
          />

          <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
            <JournalAllArticles {...data} />

            <aside
              aria-label="More from the Journal"
              className="flex flex-col gap-5"
            >
              <MostReadCard articles={mostRead} locale={linkLocale} />
              <MonthlyDispatchCard />
              <JournalWriteCta />
            </aside>
          </div>
        </Container>
      </main>
    </div>
  )
}

BlogLandingPage.displayName = "BlogLandingPage"

export default BlogLandingPage
