import Image from "next/image"
import { useLocale } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { formatDate } from "@/lib/article-helpers"
import { T } from "@/lib/design-tokens"
import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

export function BlogArticleCard({
  article,
  className,
}: {
  readonly article: BlogArticleSummary
  readonly index?: number
  readonly className?: string
}) {
  const locale = useLocale()
  if (!article.slug) return null

  const imgUrl = article.heroImage?.url
    ? formatStrapiMediaUrl(article.heroImage.url)
    : null
  const date = formatDate(
    article.publishedAt ?? article.updatedAt,
    "short",
    locale
  )

  return (
    <GlobalLink
      href={`/journal/${article.section?.slug ?? "general"}/${article.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-[20px] border border-(--t-border-line) transition-[border-color,box-shadow] duration-200 hover:border-(--t-border-hi) hover:shadow-[0_4px_16px_rgba(23,22,43,.04)]",
        className
      )}
      style={{ background: T.bg.deep }}
    >
      {imgUrl ? (
        <div className="relative m-2 aspect-[16/9] overflow-hidden rounded-[14px]">
          <Image
            src={imgUrl}
            alt={article.heroImage?.alternativeText ?? ""}
            fill
            sizes="(min-width: 640px) 280px, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <p
          className="m-0 mb-2 text-xs font-semibold"
          style={{ color: T.accent.primary }}
        >
          {article.section?.name ?? article.category?.name}
        </p>

        <h3
          className="type-h3 m-0 mb-2.5"
          style={{
            color: T.ink.base,
          }}
        >
          {article.title}
        </h3>

        {article.summary ? (
          <p
            className="m-0 mb-3 line-clamp-2 text-base leading-[1.55]"
            style={{ color: T.ink.dim }}
          >
            {article.summary}
          </p>
        ) : null}

        <p className="m-0 mt-auto pt-3 text-xs" style={{ color: T.ink.dim }}>
          {[article.author, date].filter(Boolean).join(" · ")}
        </p>
      </div>
    </GlobalLink>
  )
}

export default BlogArticleCard
