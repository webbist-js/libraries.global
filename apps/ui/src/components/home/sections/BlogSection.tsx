import Image from "next/image"
import type { Locale } from "next-intl"

import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { formatDate } from "@/lib/article-helpers"
import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

function ArticleImage({
  url,
  alt,
  className,
}: {
  url: string | null
  alt: string
  className?: string
}) {
  if (!url) {
    return (
      <div
        className={cn(
          "w-full bg-(--t-bg-deep) bg-[repeating-linear-gradient(45deg,rgba(127,127,127,0.04)_0px,rgba(127,127,127,0.04)_1px,transparent_1px,transparent_8px)]",
          className
        )}
      />
    )
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image src={url} alt={alt} fill className="object-cover" />
    </div>
  )
}

function FeaturedArticleCard({ article }: { article: BlogArticleSummary }) {
  const imgUrl = article.heroImage?.url
    ? (formatStrapiMediaUrl(article.heroImage.url) ?? null)
    : null
  const date = formatDate(article.publishedAt ?? article.updatedAt, "short")

  return (
    <GlobalLink
      href={`/blog/${article.section?.slug ?? "general"}/${article.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) transition-[border-color] duration-300 hover:border-(--t-border-hi)"
    >
      <ArticleImage
        url={imgUrl}
        alt={article.heroImage?.alternativeText ?? article.title ?? ""}
        className="aspect-[3/2]"
      />
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-4 h-px bg-(--t-border-line)" />
        <div className="mb-3 flex items-center gap-3">
          <span className="font-mono text-[10px] tracking-[0.18em] text-(--t-ink-faint) uppercase">
            —&nbsp;
            {article.category?.name ?? article.section?.name ?? "FEATURE"}
          </span>
        </div>
        <h3 className="mb-3 font-[family-name:var(--font-fraunces)] text-[1.7rem] leading-[1.12] font-semibold tracking-[-0.02em] text-(--t-ink-base) transition-colors group-hover:text-(--t-ink-dim) sm:text-[1.9rem]">
          {article.title}
        </h3>
        {article.summary ? (
          <p className="mb-4 line-clamp-3 text-sm leading-6 text-(--t-ink-low)">
            {article.summary}
          </p>
        ) : null}
        <div className="mt-auto flex items-center gap-2 text-[11px] text-(--t-ink-faint)">
          <span>{date}</span>
          {article.author ? (
            <>
              <span>·</span>
              <span className="tracking-[0.06em] uppercase">
                BY {article.author}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </GlobalLink>
  )
}

export function BlogCard({ article }: { article: BlogArticleSummary }) {
  const imgUrl = article.heroImage?.url
    ? (formatStrapiMediaUrl(article.heroImage.url) ?? null)
    : null
  const date = formatDate(article.publishedAt ?? article.updatedAt, "short")

  return (
    <GlobalLink
      href={`/blog/${article.section?.slug ?? "general"}/${article.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) transition-[border-color] duration-300 hover:border-(--t-border-hi)"
    >
      <ArticleImage
        url={imgUrl}
        alt={article.heroImage?.alternativeText ?? article.title ?? ""}
        className="aspect-[16/9]"
      />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 h-px bg-(--t-border-line)" />
        <p className="mb-2 font-mono text-[10px] tracking-[0.18em] text-(--t-ink-faint) uppercase">
          —&nbsp;{article.category?.name ?? article.section?.name ?? "ARTICLE"}
        </p>
        <h3 className="flex-1 font-[family-name:var(--font-fraunces)] text-[1.15rem] leading-[1.2] font-semibold tracking-[-0.01em] text-(--t-ink-base) transition-colors group-hover:text-(--t-ink-dim)">
          {article.title}
        </h3>
        <p className="mt-3 text-[11px] text-(--t-ink-faint)">{date}</p>
      </div>
    </GlobalLink>
  )
}

export function BlogSection({
  articles,
  locale,
}: {
  readonly articles: BlogArticleSummary[]
  readonly locale: Locale
}) {
  if (articles.length === 0) return null

  const [featured, ...rest] = articles
  const secondary = rest.slice(0, 4)

  return (
    <section className="py-16 sm:py-20">
      <Container>
        {/* Section header */}
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-[36rem]">
            <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-(--t-ink-faint) uppercase">
              § 03 — FIELD DISPATCHES
            </p>
            <h2 className="font-[family-name:var(--font-fraunces)] text-[2.4rem] leading-[1.08] font-semibold tracking-[-0.02em] text-(--t-ink-base) sm:text-[3rem]">
              Stories from the{" "}
              <em className="text-(--t-ink-dim) italic">journal.</em>
            </h2>
          </div>
          <div className="max-w-[26rem] sm:text-right">
            <p className="mb-4 text-sm leading-7 text-(--t-ink-low)">
              Reports, histories, and curator&rsquo;s notes from the hands doing
              the cataloguing.
            </p>
            <GlobalLink
              href="/blog"
              className="text-sm text-(--t-accent-aurora) underline-offset-4 transition-colors hover:underline hover:opacity-80"
            >
              Read the journal →
            </GlobalLink>
          </div>
        </div>

        {/* Asymmetric grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Featured article — left, full height */}
          {featured ? (
            <div className="lg:row-span-2">
              <FeaturedArticleCard article={featured} />
            </div>
          ) : null}

          {/* Secondary articles — right 2×2 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {secondary.map((article) => (
              <BlogCard key={article.documentId} article={article} />
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}

BlogSection.displayName = "BlogSection"

export default BlogSection
