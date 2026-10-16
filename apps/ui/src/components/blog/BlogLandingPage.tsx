import { useTranslations as useUiTranslations, type Locale } from "next-intl"

import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { JournalLandingData } from "@/lib/journal-landing"

import { BlogSearchBar } from "./BlogSearchBar"
import { JournalAllArticles } from "./JournalAllArticles"
import { JournalFeatureCard, JournalSideCard } from "./JournalCards"
import { journalHref } from "./journalLanding.helpers"
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
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("editorial")
  const tDiscovery = useUiTranslations("discovery")

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
    communityPick,
  } = data

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <main className="relative z-10 flex-1">
        <PageHero
          breadcrumb={[
            { label: tUi("home"), href: "/" },
            { label: tUi("journal") },
          ]}
          eyebrow={landing?.heroEyebrow ?? t("journalEyebrow")}
          eyebrowIcon="mdi:notebook-outline"
          lead={landing?.heroText ?? t("journalHeroLead")}
          title={landing?.heroTitle ?? t("journalHeroTitle")}
        >
          <BlogSearchBar inputId="journal-search" />
        </PageHero>

        <Container className="pt-10 pb-20">
          {featured ? (
            <section aria-labelledby="journal-index">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <h2
                  id="journal-index"
                  className="m-0 text-3xl"
                  style={{ fontFamily: T.font.serif }}
                >
                  {tDiscovery("fromIndex")}
                </h2>
                <GlobalLink
                  href={journalHref(
                    query,
                    {
                      filters: { ...query.filters, origins: ["index"] },
                      allOrigins: false,
                    },
                    "all-articles"
                  )}
                  className="font-semibold underline underline-offset-4"
                >
                  {tUi("view_all")}
                </GlobalLink>
              </div>
              <div
                className={`grid grid-cols-1 gap-4 ${sideStories.length ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : ""}`}
              >
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
                        key={`${article.documentId}:${article.locale}`}
                        locale={linkLocale}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {communityPick ? (
            <section aria-label={t("editorPick")} className="mt-10">
              <h2
                className="mb-5 text-3xl"
                style={{ fontFamily: T.font.serif }}
              >
                {t("editorPick")}
              </h2>
              <JournalFeatureCard
                article={communityPick}
                editorsPick
                locale={linkLocale}
              />
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
              aria-label={tUi("more_from_the_journal")}
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
