import Image from "next/image"

import { Badge } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { formatDate } from "@/lib/article-helpers"
import { T } from "@/lib/design-tokens"
import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

function pad(n: number) {
  return String(n + 1).padStart(2, "0")
}

export function BlogArticleCard({
  article,
  index,
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
      href={`/blog/${article.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl transition-[border-color] duration-300 hover:border-(--t-border-hi)",
        className
      )}
      style={{ background: T.bg.surface, border: `1px solid ${T.border.line}` }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/9] overflow-hidden">
        {imgUrl ? (
          <Image
            src={imgUrl}
            alt={article.heroImage?.alternativeText ?? article.title ?? ""}
            fill
            className="object-cover opacity-75 transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_35%_40%,rgba(40,80,180,0.22),transparent_60%),linear-gradient(135deg,#0a1020,#060b19)]" />
        )}
        {/* Index badge */}
        {index != null ? (
          <div className="absolute top-3 left-3 flex size-7 items-center justify-center rounded-full border border-white/12 bg-black/40 font-mono text-[10px] text-white/40 backdrop-blur-sm">
            {pad(index)}
          </div>
        ) : null}
        {/* Bottom gradient */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(6,11,25,0.7)_100%)]" />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 h-px bg-(--t-border-line)" />

        <div className="mb-3 flex items-center gap-2">
          {article.category?.name ? (
            <Badge label={article.category.name} color="dim" />
          ) : null}
          {date ? (
            <span className="ml-auto font-mono text-[10px] text-(--t-ink-faint)">
              {date}
            </span>
          ) : null}
        </div>

        <h3 className="mb-3 flex-1 font-[family-name:var(--font-fraunces)] text-[1.2rem] leading-[1.15] font-semibold tracking-[-0.01em] text-(--t-ink-base) transition-colors group-hover:text-(--t-ink-dim)">
          {article.title}
        </h3>

        {article.summary ? (
          <p className="mb-4 line-clamp-2 text-[13px] leading-6 text-(--t-ink-low)">
            {article.summary}
          </p>
        ) : null}

        {article.author ? (
          <p className="mt-auto font-mono text-[10px] tracking-[0.1em] text-(--t-ink-faint) uppercase">
            {article.author}
          </p>
        ) : null}
      </div>
    </GlobalLink>
  )
}

export default BlogArticleCard
