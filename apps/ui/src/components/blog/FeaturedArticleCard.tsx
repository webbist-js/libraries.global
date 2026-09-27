import Image from "next/image"

import GlobalLink from "@/components/global/GlobalLink"
import { formatDate } from "@/lib/article-helpers"
import { T } from "@/lib/design-tokens"
import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

export function FeaturedArticleCard({
  article,
}: {
  readonly article: BlogArticleSummary
}) {
  if (!article.slug) return null
  const imgUrl = article.heroImage?.url
    ? formatStrapiMediaUrl(article.heroImage.url)
    : null
  const initials = (article.author ?? "?")
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase()
  const date = formatDate(article.publishedAt ?? article.updatedAt, "long")

  return (
    <GlobalLink
      href={`/journal/${article.section?.slug ?? "general"}/${article.slug}`}
      className="group block overflow-hidden rounded-[24px] border transition-[border-color,box-shadow] duration-300 hover:border-[#B9B4F5] hover:shadow-[0_12px_28px_rgba(23,22,43,.08)]"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr]">
        {/* Left: image */}
        <div className="relative m-2 aspect-[4/3] overflow-hidden rounded-[18px] lg:aspect-auto lg:min-h-[420px]">
          {imgUrl ? (
            <Image
              src={imgUrl}
              alt={article.heroImage?.alternativeText ?? article.title ?? ""}
              fill
              priority
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-[18px] border border-dashed"
              style={{
                background: T.bg.surface,
                borderColor: T.border.hi,
              }}
            >
              <svg
                aria-hidden="true"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={{ color: T.ink.faint }}
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.9-3.9a2 2 0 0 0-2.8 0L6 19.5" />
              </svg>
              <span className="text-[13px]" style={{ color: T.ink.low }}>
                No cover photo yet
              </span>
            </div>
          )}
        </div>

        {/* Right: text */}
        <div className="flex flex-col justify-center p-7 lg:p-11">
          <p
            className="m-0 mb-4 text-[15px] font-semibold"
            style={{ color: T.accent.ember }}
          >
            {[article.section?.name ?? article.category?.name, date]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <h2
            className="m-0 mb-4 text-[clamp(28px,3vw,40px)] leading-[1.08]"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: T.ink.base,
            }}
          >
            {article.title}
          </h2>

          {article.summary ? (
            <p
              className="m-0 mb-6 line-clamp-3 text-[17px] leading-[1.6]"
              style={{ color: T.ink.dim }}
            >
              {article.summary}
            </p>
          ) : null}

          {article.author ? (
            <div className="mb-6 flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-8 flex-none items-center justify-center rounded-full text-[12px] font-semibold"
                style={{
                  background: "var(--tint-national-bg)",
                  color: "var(--tint-national-fg)",
                }}
              >
                {initials}
              </span>
              <span className="text-[15px]" style={{ color: T.ink.dim }}>
                <span className="font-semibold" style={{ color: T.ink.base }}>
                  {article.author}
                </span>
                {article.authorTitle ? <> · {article.authorTitle}</> : null}
              </span>
            </div>
          ) : null}

          <span
            className="text-[15px] font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            Read the article
          </span>
        </div>
      </div>
    </GlobalLink>
  )
}
