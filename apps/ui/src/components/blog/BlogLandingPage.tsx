import { useTranslations as useUiTranslations, type Locale } from "next-intl"

import {
  JournalSidebar,
  JournalSidebarFooter,
} from "@/components/articles/EditorialSidebar"
import { JournalAllArticles } from "@/components/blog/JournalAllArticles"
import { JournalDataDrops } from "@/components/blog/JournalDataDrops"
import { JournalSavedArticles } from "@/components/blog/JournalSaved"
import { JournalToolbar } from "@/components/blog/JournalToolbar"
import { JournalWriteCta } from "@/components/blog/JournalWriteCta"
import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { RecordContextIdentity } from "@/components/dashboard/RecordContextIdentity"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import { MainContent } from "@/components/ds/MainContent"
import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { JournalLandingData } from "@/lib/journal-landing"

import { BlogSearchBar } from "./BlogSearchBar"
import {
  JournalArticleCard,
  JournalFeatureCard,
  JournalSideCard,
} from "./JournalCards"
import { journalHref } from "./journalLanding.helpers"

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
    dataDropsTotal,
    dataDrops,
    fieldNotes,
  } = data

  const showFeatures =
    !query.saved &&
    !query.q &&
    !query.section &&
    query.page === 1 &&
    query.sort === "newest" &&
    !Object.values(query.filters ?? {}).some((values) => values?.length)

  return (
    <DashboardPage
      routeKey="/journal"
      title={tUi("journal")}
      className="dashboard-editorial-page dashboard-journal-landing"
      navigationHeading={
        <RecordContextIdentity
          title={tUi("journal")}
          parent={{ href: "/journal", label: tDiscovery("allStories") }}
        />
      }
      navigation={<JournalSidebar data={data} />}
      navigationFooter={<JournalSidebarFooter />}
      toolbar={
        <RecordToolbar
          items={[{ label: tUi("home"), href: "/" }, { label: tUi("journal") }]}
        />
      }
      header={
        <>
          <PageHero
            variant="card"
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
        </>
      }
      overview={
        <MainContent className="editorial-landing-content">
          <Container className="editorial-content-container">
            <div className="min-w-0">
              {showFeatures && featured ? (
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
                  <div className="journal-lead-grid">
                    <JournalFeatureCard
                      article={featured}
                      editorsPick={editorsPick}
                      locale={linkLocale}
                    />
                    {sideStories.length > 0 ? (
                      <div className="journal-side-stories">
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

              {showFeatures ? (
                <>
                  <div className="mt-7">
                    <JournalWriteCta />
                  </div>
                  <JournalDataDrops
                    query={query}
                    total={dataDropsTotal}
                    articles={dataDrops ?? []}
                    locale={linkLocale}
                  />
                </>
              ) : null}
              {showFeatures && fieldNotes?.length ? (
                <section
                  className="journal-field-notes"
                  aria-labelledby="journal-field-notes"
                >
                  <div className="journal-section-heading">
                    <div>
                      <h2
                        id="journal-field-notes"
                        className="type-small-heading"
                      >
                        {t("fieldNotes")}
                      </h2>
                      <p>{p("communityLead")}</p>
                    </div>
                    <GlobalLink
                      href={journalHref(
                        query,
                        {
                          filters: { ...query.filters, origins: ["community"] },
                          allOrigins: false,
                        },
                        "all-articles"
                      )}
                    >
                      {tUi("view_all")}
                    </GlobalLink>
                  </div>
                  <div className="journal-field-notes-grid">
                    {fieldNotes.map((article) => (
                      <JournalArticleCard
                        key={`${article.documentId}:${article.locale}`}
                        article={article}
                        locale={linkLocale}
                      />
                    ))}
                  </div>
                  <GlobalLink
                    className="journal-field-note-prompt"
                    href="/contribute/knowledge?type=journal"
                  >
                    {t("writeFieldNote")}
                  </GlobalLink>
                </section>
              ) : showFeatures && communityPick ? (
                <section aria-label={t("editorPick")} className="mt-7">
                  <JournalFeatureCard
                    article={communityPick}
                    editorsPick
                    locale={linkLocale}
                  />
                </section>
              ) : null}
              <div className="mt-8">
                {query.saved ? (
                  <JournalSavedArticles query={query} />
                ) : (
                  <JournalAllArticles {...data} />
                )}
              </div>
            </div>
          </Container>
        </MainContent>
      }
    />
  )
}

BlogLandingPage.displayName = "BlogLandingPage"

export default BlogLandingPage
