import Image from "next/image"

import GlobalLink from "@/components/global/GlobalLink"
import type { SectionIntro } from "@/components/home/homepage.types"
import SectionHeader from "@/components/home/sections/SectionHeader"
import { formatDate } from "@/lib/article-helpers"
import { T } from "@/lib/design-tokens"
import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

function articleHref(article: BlogArticleSummary): string {
  return `/blog/${article.section?.slug ?? "general"}/${article.slug}`
}

export function JournalSection({
  intro,
  articles,
}: {
  readonly intro: SectionIntro
  readonly articles: BlogArticleSummary[]
}) {
  if (articles.length === 0) return null

  const [featured, ...rest] = articles
  if (!featured) return null
  const secondary = rest.slice(0, 3)
  const imgUrl = formatStrapiMediaUrl(featured.heroImage?.url) ?? null
  const date = formatDate(featured.publishedAt ?? featured.updatedAt, "short")

  return (
    <section
      aria-labelledby="journal-title"
      className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(64px,8vw,104px)] sm:px-8"
    >
      <SectionHeader
        id="journal-title"
        intro={intro}
        action={
          <GlobalLink
            href="/blog"
            className="font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            All stories
          </GlobalLink>
        }
      />

      <article className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] items-center gap-[clamp(20px,3vw,40px)]">
        <div className="relative aspect-[3/2] overflow-hidden rounded-[24px]">
          {imgUrl ? (
            <Image
              src={imgUrl}
              alt={featured.heroImage?.alternativeText ?? featured.title ?? ""}
              fill
              className="object-cover"
            />
          ) : (
            <div className="h-full w-full" style={{ background: T.bg.muted }} />
          )}
        </div>
        <div className="flex max-w-[560px] flex-col gap-3.5">
          <span
            className="text-[15px] font-semibold"
            style={{ color: T.accent.ember }}
          >
            {featured.category?.name ?? featured.section?.name ?? "Feature"}
            {date ? ` · ${date}` : null}
          </span>
          <h3
            className="m-0"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              fontSize: "clamp(28px,3vw,38px)",
              lineHeight: 1.15,
            }}
          >
            <GlobalLink
              href={articleHref(featured)}
              className="no-underline hover:underline"
              style={{ color: T.ink.base }}
            >
              {featured.title}
            </GlobalLink>
          </h3>
          {featured.summary ? (
            <p
              className="m-0 line-clamp-3 text-[18px] leading-[1.65]"
              style={{ color: T.ink.dim }}
            >
              {featured.summary}
            </p>
          ) : null}
          {featured.author ? (
            <span className="text-[15px]" style={{ color: T.ink.dim }}>
              By {featured.author}
            </span>
          ) : null}
        </div>
      </article>

      {secondary.length > 0 ? (
        <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
          {secondary.map((article) => (
            <GlobalLink
              key={article.documentId}
              href={articleHref(article)}
              className="flex flex-col gap-2 rounded-[18px] border bg-white p-5 no-underline transition-colors hover:border-(--t-accent-primary)"
              style={{ borderColor: T.border.line }}
            >
              <span
                className="text-[14px] font-semibold"
                style={{ color: T.accent.ember }}
              >
                {article.category?.name ?? article.section?.name ?? "Article"}
              </span>
              <span
                className="text-[21px] leading-[1.2]"
                style={{
                  fontFamily: T.font.serif,
                  fontWeight: 500,
                  color: T.ink.base,
                }}
              >
                {article.title}
              </span>
              <span className="text-[14px]" style={{ color: T.ink.dim }}>
                {formatDate(article.publishedAt ?? article.updatedAt, "short")}
              </span>
            </GlobalLink>
          ))}
        </div>
      ) : null}
    </section>
  )
}

JournalSection.displayName = "JournalSection"

export default JournalSection
