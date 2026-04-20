import Image from "next/image"

import GlobalLink from "@/components/global/GlobalLink"
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
  const initial = (article.author ?? "?").charAt(0).toUpperCase()

  return (
    <GlobalLink
      href={`/blog/${article.slug}`}
      className="group relative overflow-hidden rounded-2xl"
      style={{ background: T.bg.surface, border: `1px solid ${T.border.line}` }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr]">
        {/* Left: image */}
        <div className="relative aspect-[4/3] overflow-hidden lg:aspect-auto lg:min-h-[440px]">
          {imgUrl ? (
            <Image
              src={imgUrl}
              alt={article.heroImage?.alternativeText ?? article.title ?? ""}
              fill
              priority
              className="object-cover opacity-70 transition-transform duration-700 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_30%_50%,rgba(40,80,180,0.3),transparent_60%),linear-gradient(145deg,#0d1830,#060b19)]" />
          )}
          {/* Gradient bleed into text panel on large screens */}
          <div className="absolute inset-0 hidden lg:block lg:bg-[linear-gradient(90deg,transparent_55%,rgba(6,11,25,0.85)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(6,11,25,0.9)_100%)] lg:hidden" />
        </div>

        {/* Right: text */}
        <div className="flex flex-col justify-end p-8 lg:p-12">
          {article.category?.name ? (
            <p className="mb-5 font-mono text-[10px] tracking-[0.22em] text-white/30 uppercase">
              — {article.category.name}
            </p>
          ) : null}

          <h2 className="mb-5 font-[family-name:var(--font-fraunces)] text-[2.1rem] leading-[1.06] font-semibold tracking-[-0.02em] text-white italic sm:text-[2.6rem]">
            {article.title}
          </h2>

          {article.summary ? (
            <p className="mb-7 line-clamp-3 text-[13px] leading-7 text-white/42">
              {article.summary}
            </p>
          ) : null}

          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-7 flex-none items-center justify-center rounded-full bg-white/10">
              <span className="font-mono text-[11px] text-white/50">
                {initial}
              </span>
            </div>
            {article.author ? (
              <span className="text-[12px] text-white/40">
                {article.author}
              </span>
            ) : null}
          </div>

          <span className="text-sm font-medium text-cyan-400/75 transition-colors group-hover:text-cyan-300">
            Read article →
          </span>
        </div>
      </div>
    </GlobalLink>
  )
}
