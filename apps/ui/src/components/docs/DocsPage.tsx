import { Icon } from "@iconify/react"
import type { Locale } from "next-intl"

import {
  DOCS_REPO_URL,
  DOCS_SECTIONS,
  DOCS_VERSION,
  docsArticlePath,
  docsSectionForArticle,
  readingTimeMinutes,
} from "@/components/docs/docs.config"
import {
  DocsSectionsExplorer,
  type DocsPageRow,
  type DocsSectionData,
} from "@/components/docs/DocsSectionsExplorer"
import { SearchField } from "@/components/ds"
import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { DocsWikiArticle } from "@/lib/strapi-api/content/server"

const ENTRY_CARDS = [
  {
    title: "Improve library records",
    description: "No coding needed. Add libraries, fix details, cite sources.",
    href: "/contribute",
    icon: "mdi:pencil-outline",
    bg: "#F5EEDC",
    fg: "#6B5420",
    external: false,
  },
  {
    title: "Run or develop the platform",
    description: "Set it up locally and ship a change.",
    href: DOCS_REPO_URL,
    icon: "mdi:code-tags",
    bg: "var(--tint-academic-bg)",
    fg: "var(--tint-academic-fg)",
    external: true,
  },
  {
    title: "Use the open data",
    description: "Licensing, exports and the public API.",
    href: "#data-api",
    icon: "mdi:database-outline",
    bg: "var(--tint-public-bg)",
    fg: "var(--tint-public-fg)",
    external: false,
  },
] as const

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null

  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function toRow(article: DocsWikiArticle): DocsPageRow {
  return {
    documentId: article.documentId,
    title: article.title ?? article.slug ?? "Untitled",
    href: docsArticlePath(article),
    summary: article.summary ?? null,
    updatedLabel: formatDate(article.updatedAt),
    readMinutes: readingTimeMinutes(article.body),
  }
}

export function DocsPage({
  articles,
  locale,
}: {
  readonly articles: DocsWikiArticle[]
  readonly locale: Locale
}) {
  const sections: DocsSectionData = {
    "getting-started": [],
    contributing: [],
    "data-api": [],
    "design-system": [],
    governance: [],
  }
  articles.forEach((article) => {
    sections[docsSectionForArticle(article)].push(toRow(article))
  })

  // Recent changes — articles are already sorted by updatedAt desc
  const recent = articles.slice(0, 5)
  const now = new Date()
  const latest = articles[0]?.updatedAt
    ? new Date(articles[0].updatedAt!)
    : null
  const editsThisMonth =
    latest != null &&
    latest.getFullYear() === now.getFullYear() &&
    latest.getMonth() === now.getMonth()

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <main className="relative z-10 flex-1">
        <PageHero
          breadcrumb={[{ label: "Home", href: "/" }, { label: "Docs" }]}
          eyebrow="Documentation"
          eyebrowAccent={DOCS_VERSION}
          eyebrowIcon="mdi:book-open-outline"
          lead="How to improve library records, run the platform locally, use the open data, and build on our design system."
          title="Build, contribute, *extend the index.*"
        >
          <form action={`/${locale}/docs/search`} method="get">
            <SearchField
              id="docs-search"
              label="Search the docs"
              placeholder="Search the docs — e.g. contribute, API, run locally"
              inputProps={{ name: "q" }}
            />
          </form>
        </PageHero>

        <Container className="pt-8 pb-20">
          {/* Entry cards */}
          <nav aria-label="Start here" className="grid gap-4 md:grid-cols-3">
            {ENTRY_CARDS.map((card) => (
              <GlobalLink
                className="group rounded-[18px] p-5 transition-transform hover:-translate-y-0.5"
                href={card.href}
                key={card.title}
                style={{ background: card.bg }}
                {...(card.external
                  ? { rel: "noopener noreferrer", target: "_blank" }
                  : {})}
              >
                <span className="flex items-start gap-3.5">
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full"
                    style={{ background: T.bg.deep, color: card.fg }}
                  >
                    <Icon height={19} icon={card.icon} width={19} />
                  </span>
                  <span>
                    <span
                      className="block text-[19px]"
                      style={{
                        fontFamily: T.font.serif,
                        fontWeight: 500,
                        color: T.ink.base,
                      }}
                    >
                      {card.title}{" "}
                      <span
                        aria-hidden="true"
                        className="inline-block transition-transform group-hover:translate-x-0.5"
                      >
                        →
                      </span>
                    </span>
                    <span
                      className="mt-1 block text-[14px] leading-[1.5]"
                      style={{ color: T.ink.dim }}
                    >
                      {card.description}
                    </span>
                  </span>
                </span>
              </GlobalLink>
            ))}
          </nav>

          {/* Sections + sidebar */}
          <div className="mt-10 flex flex-col gap-8 lg:flex-row">
            <div className="min-w-0 flex-1">
              <DocsSectionsExplorer sections={sections} />
            </div>

            <aside className="flex w-full shrink-0 flex-col gap-5 lg:w-[300px]">
              <section
                aria-labelledby="docs-recent"
                className="rounded-[20px] border p-5"
                style={{ background: T.bg.deep, borderColor: T.border.line }}
              >
                <h2
                  className="m-0 flex items-center gap-2 text-[17px]"
                  id="docs-recent"
                  style={{
                    fontFamily: T.font.serif,
                    fontWeight: 500,
                    color: T.ink.base,
                  }}
                >
                  <Icon
                    aria-hidden="true"
                    height={17}
                    icon="mdi:pulse"
                    style={{ color: T.accent.primary }}
                    width={17}
                  />
                  Recent changes
                </h2>
                <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
                  {recent.map((article) => {
                    const row = toRow(article)
                    const sectionTitle = DOCS_SECTIONS.find(
                      (s) => s.key === docsSectionForArticle(article)
                    )?.title

                    return (
                      <li key={article.documentId}>
                        <GlobalLink
                          className="text-[15px] font-semibold underline decoration-(--t-ink-ghost) underline-offset-[3px] transition-colors hover:decoration-current"
                          href={row.href}
                          style={{ color: T.ink.base }}
                        >
                          {row.title}
                        </GlobalLink>
                        <p
                          className="m-0 mt-0.5 text-[13px]"
                          style={{ color: T.ink.low }}
                        >
                          {sectionTitle}
                          {row.updatedLabel ? ` · ${row.updatedLabel}` : ""}
                        </p>
                      </li>
                    )
                  })}
                </ul>
                {!editsThisMonth ? (
                  <p
                    className="m-0 mt-3 text-[13px] leading-[1.5]"
                    style={{ color: T.ink.low }}
                  >
                    No edits by other contributors this month.
                  </p>
                ) : null}
              </section>

              <section
                aria-labelledby="docs-open-source"
                className="rounded-[20px] p-5"
                style={{ background: T.ink.base, color: "#fff" }}
              >
                <h2
                  className="m-0 text-[20px]"
                  id="docs-open-source"
                  style={{ fontFamily: T.font.serif, fontWeight: 500 }}
                >
                  The docs are open source too
                </h2>
                <p
                  className="mt-2 mb-0 text-[14px] leading-[1.55]"
                  style={{ color: "rgba(255,255,255,.75)" }}
                >
                  Every page lives in the repository. Spot a mistake? Open a
                  pull request, or start a discussion.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-[14px] font-semibold transition-opacity hover:opacity-90"
                    href={DOCS_REPO_URL}
                    rel="noopener noreferrer"
                    style={{ background: "#fff", color: T.ink.base }}
                    target="_blank"
                  >
                    View source
                    <Icon
                      aria-hidden="true"
                      height={13}
                      icon="mdi:arrow-top-right"
                      width={13}
                    />
                  </a>
                  <a
                    className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors hover:bg-white/10"
                    href={`${DOCS_REPO_URL}/releases`}
                    rel="noopener noreferrer"
                    style={{
                      borderColor: "rgba(255,255,255,.35)",
                      color: "#fff",
                    }}
                    target="_blank"
                  >
                    Watch releases
                    <Icon
                      aria-hidden="true"
                      height={13}
                      icon="mdi:arrow-top-right"
                      width={13}
                    />
                  </a>
                </div>
              </section>
            </aside>
          </div>
        </Container>
      </main>
    </div>
  )
}

export default DocsPage
