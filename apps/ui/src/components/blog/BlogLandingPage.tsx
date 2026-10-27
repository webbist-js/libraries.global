import { useTranslations as useUiTranslations, type Locale } from "next-intl"

import { JournalAllArticles } from "@/components/blog/JournalAllArticles"
import { JournalToolbar } from "@/components/blog/JournalToolbar"
import { MainContent } from "@/components/ds/MainContent"
import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { JournalLandingData } from "@/lib/journal-landing"

import { BlogSearchBar } from "./BlogSearchBar"
import { JournalFeatureCard, JournalSideCard } from "./JournalCards"
import { journalHref } from "./journalLanding.helpers"
import { JournalWriteCta } from "./JournalWriteCta"
import { MonthlyDispatchCard } from "./MonthlyDispatchCard"

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
  const p = useUiTranslations("publishing")

  const {
    landing,
    query,
    linkLocale,
    featured,
    editorsPick,
    sideStories,
    communityPick,
  } = data

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <MainContent className="relative z-10 flex-1">
        <PageHero
          breadcrumb={[
            { label: tUi("home"), href: "/" },
            { label: tUi("journal") },
          ]}
          eyebrow={landing?.heroEyebrow ?? t("journalEyebrow")}
          eyebrowIcon="mdi:notebook-outline"
          lead={landing?.heroText ?? t("journalHeroLead")}
          title={landing?.heroTitle ?? t("journalHeroTitle")}
          displayTitle
        >
          <BlogSearchBar
            inputId="journal-search"
            initialQuery={query.q}
            currentQuery={query}
          />
        </PageHero>

        <JournalToolbar data={data} />

        <Container className="grid items-start gap-6 pt-8 pb-20 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-7">
          <div className="min-w-0">
            {featured ? (
              <section aria-labelledby="journal-index">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h2 id="journal-index" className="type-small-heading m-0">
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
                    className="inline-flex min-h-9 items-center text-xs font-semibold text-(--t-accent-primary) underline underline-offset-4"
                  >
                    {tUi("view_all")}
                  </GlobalLink>
                </div>
                <p className="mt-0 mb-3 text-xs" style={{ color: T.ink.dim }}>
                  {p("indexLead")}
                </p>
                <div className="grid grid-cols-1 gap-3">
                  <JournalFeatureCard
                    article={featured}
                    editorsPick={editorsPick}
                    locale={linkLocale}
                  />
                  {sideStories.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
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
              <section aria-label={t("editorPick")} className="mt-7">
                <h2 className="type-h2 mb-5">{t("editorPick")}</h2>
                <JournalFeatureCard
                  article={communityPick}
                  editorsPick
                  locale={linkLocale}
                />
              </section>
            ) : null}

            <div className="mt-8">
              <JournalAllArticles {...data} />
            </div>
          </div>

          <aside
            aria-label={tUi("more_from_the_journal")}
            className="flex flex-col gap-4"
          >
            <MonthlyDispatchCard />
            <JournalWriteCta />
          </aside>
        </Container>
      </MainContent>
    </div>
  )
}

BlogLandingPage.displayName = "BlogLandingPage"

export default BlogLandingPage
