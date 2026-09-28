import { ImageOff } from "lucide-react"
import Image from "next/image"

import GlobalLink from "@/components/global/GlobalLink"
import type { SectionIntro } from "@/components/home/homepage.types"
import { formatDate } from "@/lib/article-helpers"
import { T } from "@/lib/design-tokens"
import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

/** The latest journal story, as one card beside the steward prompt. */
export function JournalCard({
  intro,
  article,
}: {
  readonly intro: SectionIntro
  readonly article: BlogArticleSummary
}) {
  const imgUrl = formatStrapiMediaUrl(article.heroImage?.url) ?? null
  const date = formatDate(article.publishedAt ?? article.updatedAt, "short")
  const kind = article.category?.name ?? article.section?.name ?? "Feature"
  const byline = [article.author ? `By ${article.author}` : null, date]
    .filter(Boolean)
    .join(" · ")

  return (
    <section aria-labelledby="journal-title">
      <GlobalLink
        href={`/journal/${article.section?.slug ?? "general"}/${article.slug}`}
        className="group grid h-full overflow-hidden rounded-[24px] border bg-white no-underline transition-colors hover:border-(--t-accent-primary) sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]"
        style={{ borderColor: T.border.line }}
      >
        <div className="relative min-h-[200px]">
          {imgUrl ? (
            <Image
              src={imgUrl}
              alt={article.heroImage?.alternativeText ?? ""}
              fill
              sizes="(min-width: 1024px) 280px, 100vw"
              className="object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-[14px] font-medium"
              style={{ background: T.bg.muted, color: T.ink.dim }}
            >
              <ImageOff
                aria-hidden="true"
                className="size-5"
                strokeWidth={1.6}
              />
              No image yet
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2.5 p-[clamp(20px,2.5vw,28px)]">
          <p
            className="m-0 text-[14px] font-semibold"
            style={{ color: T.accent.ember }}
          >
            {intro.title ?? "From the journal"} · {kind}
          </p>
          <h2
            id="journal-title"
            className="m-0 group-hover:underline"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              fontSize: "clamp(24px,2.4vw,30px)",
              lineHeight: 1.15,
              color: T.ink.base,
            }}
          >
            {article.title}
          </h2>
          {article.summary ? (
            <p
              className="m-0 line-clamp-3 text-[16px] leading-[1.6]"
              style={{ color: T.ink.dim }}
            >
              {article.summary}
            </p>
          ) : null}
          {byline ? (
            <p
              className="m-0 mt-auto pt-2 text-[14px]"
              style={{ color: T.ink.dim }}
            >
              {byline}
            </p>
          ) : null}
        </div>
      </GlobalLink>
    </section>
  )
}

JournalCard.displayName = "JournalCard"

export default JournalCard
