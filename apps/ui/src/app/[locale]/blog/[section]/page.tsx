import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { Locale } from "next-intl"
import { use } from "react"

import { BlogArticleGrid } from "@/components/blog/BlogArticleGrid"
import {
  HeroEyebrow,
  HeroTitle,
  PageShell,
  StickySubNav,
} from "@/components/ds"
import { parseHeroText } from "@/components/ds/HeroTitle"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import { DotHeroCanvas } from "@/components/ui/DotHeroCanvas"
import { T } from "@/lib/design-tokens"
import { isDevelopment } from "@/lib/general-helpers"
import {
  fetchBlogArticlesBySection,
  fetchBlogSections,
} from "@/lib/strapi-api/content/server"

export const dynamic = "force-static"
export const revalidate = 300
export const dynamicParams = true

export async function generateStaticParams() {
  if (isDevelopment()) return []
  const result = await fetchBlogSections()

  return (result.data ?? []).map((s) => ({ section: s.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; section: string }>
}): Promise<Metadata> {
  const { section: sectionSlug } = await params
  const sections = (await fetchBlogSections()).data ?? []
  const section = sections.find((s) => s.slug === sectionSlug)

  if (!section) return { title: "Section not found" }

  return {
    title: section.name,
    description: `Browse ${section.name} articles from the Library Journal.`,
    openGraph: {
      title: section.name,
      description: `Browse ${section.name} articles from the Library Journal.`,
      type: "website",
    },
  }
}

export default function BlogSectionRoute(props: {
  params: Promise<{ locale: string; section: string }>
}) {
  const params = use(props.params)
  const locale = params.locale as Locale
  const sectionSlug = params.section

  const sections = use(fetchBlogSections()).data ?? []
  const section = sections.find((s) => s.slug === sectionSlug)

  if (!section) notFound()

  const result = use(fetchBlogArticlesBySection(sectionSlug, locale, 1, 48))
  const articles = result.data ?? []
  const pagination = (result as any).meta?.pagination ?? {
    page: 1,
    pageCount: 1,
  }

  const sectionTabs = sections.map((s) => ({
    id: s.slug,
    label: s.name,
    href: `/blog/${s.slug}` as const,
  }))

  return (
    <PageShell className="flex flex-col">
      <GlobalHeader locale={locale} />

      <main className="relative z-10 flex-1">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section
          style={{
            position: "relative",
            padding: "130px 0 60px",
            overflow: "hidden",
          }}
        >
          <DotHeroCanvas variant="journal" />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 110% 90% at 50% 50%, transparent 25%, var(--t-bg-space) 80%)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              maxWidth: "1400px",
              margin: "0 auto",
              padding: "0 32px",
              position: "relative",
              zIndex: 10,
            }}
          >
            <div
              className="bsect-hero-inner"
              style={{
                display: "grid",
                gridTemplateColumns: "1.3fr 0.9fr",
                gap: "56px",
                alignItems: "end",
              }}
            >
              <div>
                <HeroEyebrow icon="✦">
                  The Library Journal · Section
                </HeroEyebrow>
                <HeroTitle>{parseHeroText(`*${section.name}*`)}</HeroTitle>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  paddingBottom: "24px",
                }}
              >
                {(pagination.total ?? articles.length) > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      gap: "24px",
                      paddingTop: "14px",
                      fontFamily: T.font.mono,
                    }}
                  >
                    <div>
                      <b
                        style={{
                          display: "block",
                          fontFamily: T.font.serif,
                          fontSize: "22px",
                          color: T.ink.base,
                          letterSpacing: "-.02em",
                          fontWeight: 400,
                        }}
                      >
                        {pagination.total ?? articles.length}
                      </b>
                      <span
                        style={{
                          fontSize: "11px",
                          color: T.ink.low,
                          letterSpacing: ".12em",
                          textTransform: "uppercase",
                        }}
                      >
                        articles
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* ── Sections subnav ───────────────────────────────────────────── */}
        {sectionTabs.length > 0 && (
          <StickySubNav tabs={sectionTabs} activeId={sectionSlug} />
        )}

        {/* ── Article grid ──────────────────────────────────────────────── */}
        <section className="py-14 sm:py-20">
          <Container>
            <BlogArticleGrid
              articles={articles}
              page={pagination.page ?? 1}
              pageCount={pagination.pageCount ?? 1}
              baseUrl={`/blog/${sectionSlug}`}
            />
          </Container>
        </section>
      </main>

      <style>{`
        @media (max-width: 960px) {
          .bsect-hero-inner { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </PageShell>
  )
}
