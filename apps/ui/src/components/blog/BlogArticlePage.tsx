import Image from "next/image"
import { useTranslations as useUiTranslations, type Locale } from "next-intl"

import { ArticleContext } from "@/components/articles/ArticleContext"
import { ArticleReaderActions } from "@/components/articles/ArticleReaderActions"
import { ArticleBodyBlocks } from "@/components/blog/ArticleBodyBlocks"
import { ArticleShareButtons } from "@/components/blog/ArticleShareButtons"
import { BlogArticleCard } from "@/components/blog/BlogArticleCard"
import { AttachedDiscussion } from "@/components/discussions/AttachedDiscussion"
import { ArticleEditHistorySection } from "@/components/docs/ArticleEditHistory"
import { Breadcrumb } from "@/components/ds/Breadcrumb"
import { MainContent } from "@/components/ds/MainContent"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { NotTranslatedNote } from "@/components/global/NotTranslatedNote"
import { ArticleEngagement } from "@/components/providers/ArticleEngagement"
import { articleReaderPath } from "@/lib/article-content-language"
import { articleContextPlaces } from "@/lib/article-context"
import {
  countWords,
  estimateReadingTime,
  extractHeadings,
  formatDate,
} from "@/lib/article-helpers"
import { avatarInitials, avatarSrc } from "@/lib/avatar"
import { T } from "@/lib/design-tokens"
import { isFounder } from "@/lib/founder"
import { routing } from "@/lib/navigation"
import { absoluteUrl } from "@/lib/seo/metadata"
import type {
  BlogArticleDetail,
  BlogArticleSummary,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

/** "Founder" pill beside the author's name (`lib/founder.ts`). */
function FounderTag() {
  const tUi = useUiTranslations("ui")

  return (
    <span
      className="ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 align-middle text-[12px] font-semibold"
      style={{
        fontFamily: T.font.sans,
        background: "var(--tint-special-bg)",
        color: "var(--tint-special-fg)",
      }}
    >
      {tUi("founder")}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function BlogArticlePage({
  article,
  related,
  locale,
  untranslatedLocale = null,
  contentLocale,
}: {
  readonly article: BlogArticleDetail | null
  readonly related?: BlogArticleSummary[]
  readonly locale: Locale
  /** Set when this is the default-locale stand-in for a missing translation. */
  readonly untranslatedLocale?: string | null
  readonly contentLocale?: string
}) {
  const tUi = useUiTranslations("ui")
  const tArticle = useUiTranslations("editorial")
  const p = useUiTranslations("publishing")

  if (!article) {
    return (
      <div
        className="relative isolate flex min-h-screen w-full flex-col"
        style={{ background: T.bg.void, color: T.ink.base }}
      >
        <GlobalHeader locale={locale} />
        <MainContent className="flex flex-1 items-center justify-center">
          <p style={{ color: T.ink.dim }}>{tArticle("articleNotFound")}</p>
        </MainContent>
      </div>
    )
  }

  const imgUrl = article.heroImage?.url
    ? formatStrapiMediaUrl(article.heroImage.url)
    : null

  const readingTime = estimateReadingTime(article.body)
  const wordCount = countWords(article.body)
  const publishedDate = formatDate(
    article.publishedAt ?? article.updatedAt,
    "long",
    locale
  )
  const shortDate = formatDate(
    article.publishedAt ?? article.updatedAt,
    "short",
    locale
  )
  const headings = extractHeadings(article.body)
  const hasContext = Boolean(
    article.topics?.some((item) => item.name) ||
    article.libraries?.some((item) => item.name) ||
    article.eventMentions?.some((item) => item.title) ||
    articleContextPlaces(article).length
  )

  // Curated related articles take priority; fall back to prop from page.tsx
  const relatedCards: BlogArticleSummary[] = (
    article.relatedArticles?.filter((a) => a.slug !== article.slug) ??
    related?.filter((a) => a.slug !== article.slug) ??
    []
  ).slice(0, 3)

  const authorProfile = article.authorProfile ?? null
  const authorName =
    article.author ??
    (authorProfile
      ? [authorProfile.firstName, authorProfile.lastName]
          .filter(Boolean)
          .join(" ") || authorProfile.username
      : null)
  const authorHref = authorProfile
    ? `/profile/${encodeURIComponent(authorProfile.username)}`
    : null
  const authorPhoto = avatarSrc(authorProfile?.avatar, "sm")
  const authorIsFounder = isFounder(authorProfile?.username)
  const authorInitial = avatarInitials(authorName)

  const metaRows = [
    { label: tUi("published"), value: publishedDate },
    {
      label: tArticle("readingTimeLabel"),
      value: readingTime ? tArticle("minutes", { minutes: readingTime }) : null,
    },
    {
      label: tArticle("words"),
      value: wordCount > 0 ? wordCount.toLocaleString(locale) : null,
    },
    { label: tArticle("section"), value: article.section?.name },
    { label: tArticle("category"), value: article.category?.name },
  ].filter((row): row is { label: string; value: string } => !!row.value)

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <MainContent
        className="relative z-10 mx-auto w-full max-w-[1240px] flex-1 px-4 pt-6 pb-20 sm:px-8 sm:pt-8"
        data-analytics-page="journal"
        data-analytics-content-id={article.documentId}
        data-analytics-path={
          new URL(
            absoluteUrl(
              `/journal/${article.section?.slug ?? "general"}/${article.slug}`,
              locale
            )
          ).pathname
        }
      >
        <div className="grid grid-cols-1 items-start gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,860px)_240px]">
          <div className="min-w-0">
            <div className="rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-10 lg:p-12">
              <header>
                <Breadcrumb
                  ancestorsOnly
                  items={[
                    { label: tUi("journal"), href: "/journal" },
                    ...(article.section?.slug
                      ? [
                          {
                            label: article.section.name ?? article.section.slug,
                            href: `/journal?section=${article.section.slug}`,
                          },
                        ]
                      : []),
                  ]}
                />
                {article.category?.name ? (
                  <p className="mt-4 mb-2 text-xs font-semibold text-(--t-accent-primary)">
                    {article.category.name}
                  </p>
                ) : null}
                <h1
                  className="mt-3 mb-0 text-[clamp(38px,4.5vw,60px)] leading-[1.02] tracking-[-0.02em] text-balance"
                  style={{ fontFamily: T.font.serif, fontWeight: 500 }}
                >
                  {article.title}
                </h1>
                {untranslatedLocale ? (
                  <NotTranslatedNote locale={untranslatedLocale} />
                ) : null}

                {article.summary ? (
                  <p
                    className="mt-5 mb-0 max-w-[58ch] text-[21px] leading-[1.5] text-pretty"
                    style={{ color: T.ink.dim, fontFamily: T.font.serif }}
                  >
                    {article.summary}
                  </p>
                ) : null}

                {/* Byline + share */}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-10 flex-none items-center justify-center overflow-hidden rounded-full text-[15px] font-semibold"
                      style={{
                        background: "var(--tint-national-bg)",
                        color: "var(--tint-national-fg)",
                      }}
                    >
                      {authorPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={authorPhoto}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        authorInitial
                      )}
                    </span>
                    <div>
                      <p
                        className="m-0 text-[15px] font-semibold"
                        style={{ color: T.ink.base }}
                      >
                        {authorName && authorHref ? (
                          <GlobalLink
                            href={authorHref}
                            className="underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-current"
                            style={{ color: T.ink.base }}
                          >
                            {authorName}
                          </GlobalLink>
                        ) : (
                          (authorName ?? "The Journal")
                        )}
                        {authorIsFounder ? <FounderTag /> : null}
                      </p>
                      <p className="m-0 mt-1 text-xs text-(--t-ink-dim)">
                        {[
                          shortDate,
                          readingTime
                            ? tArticle("readingTime", { minutes: readingTime })
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>

                  <ArticleShareButtons
                    contentId={article.documentId}
                    title={article.title}
                    url={absoluteUrl(
                      articleReaderPath(
                        `/journal/${article.section?.slug ?? "general"}/${article.slug}`,
                        locale,
                        contentLocale ??
                          (untranslatedLocale ? routing.defaultLocale : locale)
                      ),
                      locale
                    )}
                  />
                </div>
                <ArticleReaderActions
                  kind="journal"
                  slug={article.slug ?? ""}
                  path={`/journal/${article.section?.slug ?? "general"}/${article.slug}`}
                  contentLocale={
                    contentLocale ??
                    (untranslatedLocale ? routing.defaultLocale : locale)
                  }
                  interfaceLocale={locale}
                  availableLocales={article.availableLocales}
                  authorUsername={authorProfile?.username}
                />
                {hasContext ? (
                  <details className="mt-4 lg:hidden">
                    <summary className="text-sm font-semibold">
                      {p("contextStory")}
                    </summary>
                    <ArticleContext
                      article={article}
                      kind="journal"
                      locale={locale}
                    />
                  </details>
                ) : null}
              </header>

              {/* Hero image */}
              {imgUrl ? (
                <figure className="m-0 mt-6">
                  <div
                    className="relative aspect-[16/9] overflow-hidden rounded-3xl"
                    style={{ background: T.bg.deep }}
                  >
                    <Image
                      src={imgUrl}
                      alt={
                        article.heroImage?.alternativeText ??
                        article.title ??
                        ""
                      }
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 880px"
                      className="object-cover"
                    />
                  </div>
                </figure>
              ) : null}

              {/* Prose — white section card on paper */}
              <article
                id={`analytics-journal-${article.documentId}`}
                className="mt-7 max-w-[68ch]"
              >
                <ArticleEngagement
                  bodyId={`analytics-journal-${article.documentId}`}
                  contentId={article.documentId}
                  contentType="journal"
                  path={
                    new URL(
                      absoluteUrl(
                        `/journal/${article.section?.slug ?? "general"}/${article.slug}`,
                        locale
                      )
                    ).pathname
                  }
                />
                {/* Heading margins are in rem: the spacing scale is em-based,
                  so mt-* on a 28px heading would scale with it. */}
                <div className="article-drop-cap [&_h2]:mt-[2.25rem] [&_h2]:mb-[0.75rem] [&_h2]:[font-family:var(--font-newsreader),Georgia,serif] [&_h2]:text-[28px] [&_h2]:font-medium [&_h2]:tracking-[-0.01em] [&_h2:first-child]:mt-0 [&_h3]:mt-[1.75rem] [&_h3]:mb-[0.5rem] [&_h3]:[font-family:var(--font-newsreader),Georgia,serif] [&_h3]:text-[21px] [&_h3]:font-medium [&_h3:first-child]:mt-0 [&_li]:text-[17px] [&_li]:leading-[1.7] [&_p]:text-[17px] [&_p]:leading-[1.7]">
                  {article.body?.length ? (
                    <ArticleBodyBlocks blocks={article.body} />
                  ) : (
                    <p className="rounded-2xl bg-(--t-bg-void) p-5 text-(--t-ink-dim)">
                      {tArticle("noContent")}
                    </p>
                  )}
                </div>
              </article>

              {/* Author bio */}
              {authorName ? (
                <div
                  className="mt-8 flex items-start gap-4 rounded-[18px] p-5"
                  style={{ background: T.bg.void }}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-14 flex-none items-center justify-center overflow-hidden rounded-full text-[20px] font-semibold"
                    style={{
                      background: "var(--tint-national-bg)",
                      color: "var(--tint-national-fg)",
                    }}
                  >
                    {authorPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={authorPhoto}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      authorInitial
                    )}
                  </span>
                  <div className="min-w-0">
                    <p
                      className="m-0 mb-0.5 text-[14px] font-semibold"
                      style={{ color: T.ink.dim }}
                    >
                      {tArticle("writtenBy")}
                    </p>
                    <p
                      className="m-0 text-[22px]"
                      style={{
                        fontFamily: T.font.serif,
                        fontWeight: 500,
                        color: T.ink.base,
                      }}
                    >
                      {authorHref ? (
                        <GlobalLink
                          href={authorHref}
                          className="underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-current"
                          style={{ color: T.ink.base }}
                        >
                          {authorName}
                        </GlobalLink>
                      ) : (
                        authorName
                      )}
                      {authorIsFounder ? <FounderTag /> : null}
                    </p>
                    {article.authorTitle ? (
                      <p
                        className="m-0 mt-0.5 text-[14px]"
                        style={{ color: T.ink.dim }}
                      >
                        {article.authorTitle}
                      </p>
                    ) : null}
                    {article.authorBio ? (
                      <p
                        className="m-0 mt-3 text-[15px] leading-[1.6]"
                        style={{ color: T.ink.base }}
                      >
                        {article.authorBio}
                      </p>
                    ) : null}
                    {authorHref ? (
                      <GlobalLink
                        href={authorHref}
                        className="mt-3 inline-flex text-[15px] font-semibold underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-current"
                        style={{ color: T.accent.primary }}
                      >
                        {tArticle("viewProfile")}
                      </GlobalLink>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="mt-7 border-t border-(--t-divider) pt-5">
                {/* Back link */}
                <GlobalLink
                  href="/journal"
                  className="mt-1 inline-flex w-fit items-center gap-2 text-[15px] font-semibold underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-current"
                  style={{ color: T.accent.primary }}
                >
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path
                      d="M10 3L5 8l5 5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {tArticle("backToJournal")}
                </GlobalLink>
              </div>
              <div id="article-history" />
              <ArticleEditHistorySection
                kind="blog"
                documentId={article.documentId}
                locale={untranslatedLocale ? routing.defaultLocale : locale}
              />
            </div>
            <div className="mt-5 scroll-mt-24" id="article-discussion">
              <AttachedDiscussion
                presentation="article"
                target={{
                  uid: "api::blog-article.blog-article",
                  documentId: article.documentId,
                  locale:
                    contentLocale ??
                    (untranslatedLocale ? routing.defaultLocale : locale),
                }}
                subjectSlug="journal"
                title={article.title ?? article.slug ?? ""}
                language={
                  contentLocale ??
                  (untranslatedLocale ? routing.defaultLocale : locale)
                }
              />
            </div>
            {relatedCards.length > 0 ? (
              <section aria-labelledby="related-heading" className="mt-10">
                <h2
                  id="related-heading"
                  className="mb-5 text-[32px] leading-tight"
                  style={{ fontFamily: T.font.serif }}
                >
                  {tArticle("relatedStories")}
                </h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {relatedCards.map((item) => (
                    <BlogArticleCard key={item.documentId} article={item} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-5 lg:sticky lg:top-(--sticky-content-top) lg:max-h-(--sticky-content-max-height) lg:overflow-y-auto lg:overscroll-contain">
            {headings.length > 0 ? (
              <nav
                aria-label={tUi("in_this_article")}
                className="hidden lg:block"
                style={{ borderColor: T.border.line }}
              >
                <p
                  className="m-0 mb-2 text-[13px] font-semibold"
                  style={{ color: T.ink.base }}
                >
                  {tUi("in_this_article")}
                </p>
                <ul
                  className="m-0 flex list-none flex-col gap-1 border-l p-0 pl-3"
                  style={{ borderColor: T.border.divider }}
                >
                  {headings.map((h) => (
                    <li
                      key={h.id}
                      style={
                        h.level > 2
                          ? { paddingLeft: `${(h.level - 2) * 12}px` }
                          : undefined
                      }
                    >
                      <a
                        href={`#${h.id}`}
                        className="block py-0.5 text-[14px] leading-snug transition-colors hover:text-(--t-accent-primary)"
                        style={{ color: T.ink.dim }}
                      >
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
            <div className="hidden lg:block">
              <ArticleContext
                article={article}
                kind="journal"
                locale={locale}
              />
            </div>
            {metaRows.length > 0 ? (
              <div
                className="border-t border-(--t-divider) pt-3"
                style={{ borderColor: T.border.line }}
              >
                <p
                  className="m-0 mb-2 text-[15px] font-semibold"
                  style={{ color: T.ink.base }}
                >
                  {tArticle("aboutArticle")}
                </p>
                <dl className="m-0">
                  {metaRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-3 border-t py-2.5 first:border-t-0"
                      style={{ borderColor: T.border.divider }}
                    >
                      <dt className="text-[14px]" style={{ color: T.ink.dim }}>
                        {row.label}
                      </dt>
                      <dd
                        className="m-0 text-right text-[14px] font-semibold"
                        style={{ color: T.ink.base }}
                      >
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </aside>
        </div>
      </MainContent>
    </div>
  )
}

BlogArticlePage.displayName = "BlogArticlePage"

export default BlogArticlePage
