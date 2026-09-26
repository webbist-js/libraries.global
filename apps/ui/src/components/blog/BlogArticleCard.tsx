import Image from "next/image"

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
  if (!article.slug) return null

  const imgUrl = article.heroImage?.url
    ? formatStrapiMediaUrl(article.heroImage.url)
    : null
  const date = formatDate(article.publishedAt ?? article.updatedAt, "short")

  return (
    <GlobalLink
      href={`/blog/${article.section?.slug ?? "general"}/${article.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-[20px] border transition-[border-color,box-shadow] duration-300 hover:border-[#B9B4F5] hover:shadow-[0_12px_28px_rgba(23,22,43,.08)]",
        className
      )}
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      {/* Thumbnail */}
      <div className="relative m-2 aspect-[16/9] overflow-hidden rounded-[14px]">
        {imgUrl ? (
          <Image
            src={imgUrl}
            alt={article.heroImage?.alternativeText ?? article.title ?? ""}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "var(--tint-national-bg)" }}
          >
            <span
              aria-hidden="true"
              style={{
                fontFamily: T.font.serif,
                fontSize: "44px",
                color: "var(--tint-national-fg)",
              }}
            >
              {(article.title ?? "J").charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col px-5 pt-3 pb-5">
        <p
          className="m-0 mb-2 text-[14px] font-semibold"
          style={{ color: T.accent.ember }}
        >
          {[article.section?.name ?? article.category?.name, date]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <h3
          className="m-0 mb-2.5 flex-1 text-[22px] leading-[1.15]"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: T.ink.base,
          }}
        >
          {article.title}
        </h3>

        {article.summary ? (
          <p
            className="m-0 mb-3 line-clamp-2 text-[15px] leading-[1.55]"
            style={{ color: T.ink.dim }}
          >
            {article.summary}
          </p>
        ) : null}

        {article.author ? (
          <p className="m-0 mt-auto text-[14px]" style={{ color: T.ink.dim }}>
            {article.author}
          </p>
        ) : null}
      </div>
    </GlobalLink>
  )
}

export default BlogArticleCard
