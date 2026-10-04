import { Icon } from "@iconify/react"
import Image from "next/image"
import type { Locale } from "next-intl"
import type { ReactNode } from "react"

import { formatDate } from "@/lib/article-helpers"
import { T } from "@/lib/design-tokens"
import type { JournalCardData } from "@/lib/journal-landing"
import { Link } from "@/lib/navigation"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

import { sectionVisual } from "./journalLanding.helpers"

const CARD_HOVER =
  "transition-[border-color,box-shadow] duration-300 hover:border-[#B9B4F5] hover:shadow-[0_12px_28px_rgba(23,22,43,.08)]"

function articleHref(article: JournalCardData) {
  return `/journal/${article.section?.slug ?? "general"}/${article.slug}`
}

/** Links in the article's own language, which may differ from the page's. */
function ArticleLink({
  article,
  locale,
  className,
  children,
}: {
  readonly article: JournalCardData
  readonly locale: Locale
  readonly className?: string
  readonly children: ReactNode
}) {
  return (
    <Link
      className={className}
      href={articleHref(article)}
      locale={locale}
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      {children}
    </Link>
  )
}

/** "Alex Bennett · 20 Apr 2026 · 9 min read" */
export function articleMeta(
  article: JournalCardData,
  { withAuthor = true }: { withAuthor?: boolean } = {}
) {
  return [
    withAuthor ? article.author : null,
    formatDate(article.publishedAt ?? article.updatedAt, "short"),
    `${article.readMinutes} min read`,
  ]
    .filter(Boolean)
    .join(" · ")
}

export function SectionTag({
  section,
}: {
  readonly section: JournalCardData["section"]
}) {
  if (!section) return null
  const visual = sectionVisual(section)

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold"
      style={{ background: visual.bg, color: visual.fg }}
    >
      <Icon aria-hidden="true" height={14} icon={visual.icon} width={14} />
      {section.name}
    </span>
  )
}

/** Hero image, or the section's tint with its icon and the article's place. */
function ArticleThumb({
  article,
  className,
  sizes,
}: {
  readonly article: JournalCardData
  readonly className?: string
  readonly sizes: string
}) {
  const visual = sectionVisual(article.section)
  const imgUrl = article.heroImage?.url
    ? formatStrapiMediaUrl(article.heroImage.url)
    : null

  return (
    <div
      className={cn("relative overflow-hidden rounded-[14px]", className)}
      style={{ background: visual.bg, color: visual.fg }}
    >
      {imgUrl ? (
        <Image
          alt={article.heroImage?.alternativeText ?? ""}
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          fill
          sizes={sizes}
          src={imgUrl}
        />
      ) : (
        <Icon
          aria-hidden="true"
          className="absolute bottom-3 left-3"
          height={22}
          icon={visual.icon}
          width={22}
        />
      )}
      {article.place ? (
        <span
          className={cn(
            "absolute right-3 bottom-3 text-[12px] font-semibold",
            imgUrl && "rounded-full bg-white/90 px-2 py-0.5"
          )}
          style={imgUrl ? { color: T.ink.base } : undefined}
        >
          {article.place}
        </span>
      ) : null}
    </div>
  )
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/** The lead story: image left, badges, title, summary and byline right. */
export function JournalFeatureCard({
  article,
  editorsPick,
  locale,
}: {
  readonly article: JournalCardData
  readonly editorsPick: boolean
  readonly locale: Locale
}) {
  const imgUrl = article.heroImage?.url
    ? formatStrapiMediaUrl(article.heroImage.url)
    : null

  return (
    <ArticleLink
      article={article}
      className={cn(
        "group grid grid-cols-1 overflow-hidden rounded-[24px] border md:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]",
        CARD_HOVER
      )}
      locale={locale}
    >
      <div className="relative m-2 aspect-[4/3] overflow-hidden rounded-[18px] md:aspect-auto md:min-h-[300px]">
        {imgUrl ? (
          <Image
            alt={article.heroImage?.alternativeText ?? ""}
            className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            fill
            priority
            sizes="(min-width: 1024px) 400px, 100vw"
            src={imgUrl}
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-[18px] border border-dashed"
            style={{ background: T.bg.surface, borderColor: T.border.hi }}
          >
            <Icon
              aria-hidden="true"
              height={26}
              icon="mdi:image-outline"
              style={{ color: T.ink.faint }}
              width={26}
            />
            <span className="text-[13px]" style={{ color: T.ink.low }}>
              No cover photo yet
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col justify-center p-6 lg:p-8">
        <div className="mb-3 flex flex-wrap gap-2">
          {editorsPick ? (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-semibold"
              style={{
                background: T.accent.chip,
                color: T.accent.primaryHover,
              }}
            >
              Editor&rsquo;s pick
            </span>
          ) : null}
          <SectionTag section={article.section} />
        </div>

        <h3
          className="m-0 text-[clamp(26px,2.6vw,34px)] leading-[1.1]"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            letterSpacing: "-0.015em",
            color: T.ink.base,
          }}
        >
          {article.title}
        </h3>

        {article.summary ? (
          <p
            className="m-0 mt-3 line-clamp-3 text-[16px] leading-[1.55]"
            style={{ color: T.ink.dim }}
          >
            {article.summary}
          </p>
        ) : null}

        <p
          className="m-0 mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]"
          style={{ color: T.ink.dim }}
        >
          {article.author ? (
            <>
              <span
                aria-hidden="true"
                className="flex size-7 flex-none items-center justify-center rounded-full text-[12px] font-semibold"
                style={{
                  background: "var(--tint-national-bg)",
                  color: "var(--tint-national-fg)",
                }}
              >
                {initialsOf(article.author)}
              </span>
              <span className="font-semibold" style={{ color: T.ink.base }}>
                {article.author}
              </span>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          {articleMeta(article, { withAuthor: false })}
        </p>
      </div>
    </ArticleLink>
  )
}

/** A compact story beside the lead: tag, title, byline. */
export function JournalSideCard({
  article,
  locale,
}: {
  readonly article: JournalCardData
  readonly locale: Locale
}) {
  return (
    <ArticleLink
      article={article}
      className={cn(
        "group flex flex-1 flex-col rounded-[20px] border p-5",
        CARD_HOVER
      )}
      locale={locale}
    >
      <div>
        <SectionTag section={article.section} />
      </div>
      <h3
        className="m-0 mt-3 mb-4 text-[21px] leading-[1.2] transition-colors group-hover:text-(--t-accent-primary)"
        style={{ fontFamily: T.font.serif, fontWeight: 500, color: T.ink.base }}
      >
        {article.title}
      </h3>
      <p className="m-0 mt-auto text-[13px]" style={{ color: T.ink.dim }}>
        {articleMeta(article)}
      </p>
    </ArticleLink>
  )
}

function SectionLabel({
  section,
}: {
  readonly section: JournalCardData["section"]
}) {
  if (!section) return null

  return (
    <p
      className="m-0 mb-1 text-[13px] font-semibold"
      style={{ color: sectionVisual(section).fg }}
    >
      {section.name}
    </p>
  )
}

/** Grid card in "All articles". */
export function JournalArticleCard({
  article,
  locale,
}: {
  readonly article: JournalCardData
  readonly locale: Locale
}) {
  return (
    <ArticleLink
      article={article}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-[20px] border",
        CARD_HOVER
      )}
      locale={locale}
    >
      <ArticleThumb
        article={article}
        className="m-2 aspect-[16/10]"
        sizes="(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw"
      />
      <div className="flex flex-1 flex-col px-4 pt-2 pb-4">
        <SectionLabel section={article.section} />
        <h3
          className="m-0 text-[20px] leading-[1.2] transition-colors group-hover:text-(--t-accent-primary)"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            color: T.ink.base,
          }}
        >
          {article.title}
        </h3>
        {article.summary ? (
          <p
            className="m-0 mt-2 line-clamp-2 text-[14px] leading-[1.5]"
            style={{ color: T.ink.dim }}
          >
            {article.summary}
          </p>
        ) : null}
        <p
          className="m-0 mt-auto pt-4 text-[13px]"
          style={{ color: T.ink.dim }}
        >
          {articleMeta(article)}
        </p>
      </div>
    </ArticleLink>
  )
}

/** Row in the list view of "All articles". */
export function JournalArticleRow({
  article,
  locale,
}: {
  readonly article: JournalCardData
  readonly locale: Locale
}) {
  return (
    <ArticleLink
      article={article}
      className={cn(
        "group flex items-stretch gap-4 rounded-[20px] border p-2 pr-5",
        CARD_HOVER
      )}
      locale={locale}
    >
      <ArticleThumb
        article={{ ...article, place: null }}
        className="aspect-[4/3] w-[104px] flex-none sm:w-[168px]"
        sizes="168px"
      />
      <div className="flex min-w-0 flex-1 flex-col py-2">
        <SectionLabel section={article.section} />
        <h3
          className="m-0 text-[19px] leading-[1.2] transition-colors group-hover:text-(--t-accent-primary)"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            color: T.ink.base,
          }}
        >
          {article.title}
        </h3>
        {article.summary ? (
          <p
            className="m-0 mt-1.5 line-clamp-2 hidden text-[14px] leading-[1.5] sm:block"
            style={{ color: T.ink.dim }}
          >
            {article.summary}
          </p>
        ) : null}
        <p
          className="m-0 mt-auto pt-2 text-[13px]"
          style={{ color: T.ink.dim }}
        >
          {[articleMeta(article), article.place].filter(Boolean).join(" · ")}
        </p>
      </div>
    </ArticleLink>
  )
}
