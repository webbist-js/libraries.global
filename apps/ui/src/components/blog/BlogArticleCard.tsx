import Image from "next/image"
import type { Locale } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { homepagePanelClassName } from "@/components/home/homepage.constants"
import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

const categoryColors: Record<string, string> = {
  Research: "text-indigo-300 border-indigo-400/30 bg-indigo-500/10",
  Tech: "text-cyan-300 border-cyan-400/30 bg-cyan-500/10",
  Culture: "text-amber-300 border-amber-400/30 bg-amber-500/10",
  Editorial: "text-purple-300 border-purple-400/30 bg-purple-500/10",
  Preservation: "text-emerald-300 border-emerald-400/30 bg-emerald-500/10",
  Ethics: "text-rose-300 border-rose-400/30 bg-rose-500/10",
}

function CategoryBadge({ category }: { category: string }) {
  const colourClass =
    categoryColors[category] ?? "text-white/50 border-white/16 bg-white/6"

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] uppercase",
        colourClass
      )}
    >
      {category}
    </span>
  )
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return null

  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function BlogArticleCard({
  article,
  locale,
  className,
}: {
  readonly article: BlogArticleSummary
  readonly locale: Locale
  readonly className?: string
}) {
  if (!article.slug) return null

  const imgUrl = article.heroImage?.url
    ? formatStrapiMediaUrl(article.heroImage.url)
    : null

  return (
    <GlobalLink
      href={`/blog/${article.slug}`}
      className={cn(
        homepagePanelClassName,
        "group flex flex-col overflow-hidden transition-[border-color,box-shadow,background-color] duration-500 hover:border-cyan-200/16 hover:shadow-[0_20px_60px_rgba(6,16,40,0.5)]",
        className
      )}
    >
      {/* Image */}
      {imgUrl ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          <Image
            src={imgUrl}
            alt={article.heroImage?.alternativeText ?? article.title ?? ""}
            fill
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(5,8,22,0.65)_100%)]" />
        </div>
      ) : (
        <div className="aspect-[16/9] w-full bg-white/4" />
      )}

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          {article.category ? (
            <CategoryBadge category={article.category} />
          ) : null}
          <span className="ml-auto text-[10px] text-white/30">
            {formatDate(article.publishedAt ?? article.updatedAt)}
          </span>
        </div>

        <h3 className="text-base leading-snug font-semibold tracking-tight text-white transition-colors group-hover:text-cyan-50">
          {article.title}
        </h3>

        {article.summary ? (
          <p className="line-clamp-2 text-sm leading-6 text-white/50">
            {article.summary}
          </p>
        ) : null}

        <div className="mt-auto pt-2">
          <span className="text-xs font-medium text-indigo-400 transition-colors group-hover:text-indigo-300">
            Read article →
          </span>
        </div>
      </div>
    </GlobalLink>
  )
}

export function BlogArticleCardWide({
  article,
  locale,
  className,
}: {
  readonly article: BlogArticleSummary
  readonly locale: Locale
  readonly className?: string
}) {
  if (!article.slug) return null

  const imgUrl = article.heroImage?.url
    ? formatStrapiMediaUrl(article.heroImage.url)
    : null

  return (
    <GlobalLink
      href={`/blog/${article.slug}`}
      className={cn(
        homepagePanelClassName,
        "group flex flex-col overflow-hidden transition-[border-color,box-shadow,background-color] duration-500 hover:border-cyan-200/16 hover:shadow-[0_20px_60px_rgba(6,16,40,0.5)] sm:flex-row",
        className
      )}
    >
      {/* Image */}
      {imgUrl ? (
        <div className="relative w-full shrink-0 overflow-hidden sm:w-48">
          <div className="relative aspect-[16/9] sm:aspect-auto sm:h-full">
            <Image
              src={imgUrl}
              alt={article.heroImage?.alternativeText ?? article.title ?? ""}
              fill
              className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
            />
          </div>
        </div>
      ) : null}

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {article.category ? (
            <CategoryBadge category={article.category} />
          ) : null}
          <span className="ml-auto text-[10px] text-white/30">
            {formatDate(article.publishedAt ?? article.updatedAt)}
          </span>
        </div>

        <h3 className="text-sm leading-snug font-semibold tracking-tight text-white transition-colors group-hover:text-cyan-50">
          {article.title}
        </h3>

        {article.summary ? (
          <p className="line-clamp-2 text-xs leading-5 text-white/45">
            {article.summary}
          </p>
        ) : null}
      </div>
    </GlobalLink>
  )
}

export default BlogArticleCard
