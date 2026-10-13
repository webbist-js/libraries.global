import { Icon } from "@iconify/react"
import Image from "next/image"
import { useTranslations, type Locale } from "next-intl"

import {
  articleMeta,
  JournalSideCard,
  SectionTag,
} from "@/components/blog/JournalCards"
import { sectionVisual } from "@/components/blog/journalLanding.helpers"
import GlobalLink from "@/components/global/GlobalLink"
import type { SectionIntro } from "@/components/home/homepage.types"
import SectionHeader from "@/components/home/sections/SectionHeader"
import { T } from "@/lib/design-tokens"
import type { JournalCardData, JournalTopStories } from "@/lib/journal-landing"
import { Link } from "@/lib/navigation"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

/** The lead story as a photo with its title on a white panel. Without a
 * cover, the section's tint and icon stand in. */
function LeadStory({
  article,
  editorsPick,
  locale,
}: {
  readonly article: JournalCardData
  readonly editorsPick: boolean
  readonly locale: Locale
}) {
  const t = useTranslations("editorial")
  const imgUrl = formatStrapiMediaUrl(article.heroImage?.url)
  const visual = sectionVisual(article.section)

  return (
    <Link
      href={`/journal/${article.section?.slug ?? "general"}/${article.slug}`}
      locale={locale}
      className="group relative flex min-h-[clamp(400px,36vw,520px)] overflow-hidden rounded-[24px] border no-underline transition-colors hover:border-(--t-accent-primary)"
      style={{ background: visual.bg, borderColor: T.border.line }}
    >
      {imgUrl ? (
        <Image
          alt={article.heroImage?.alternativeText ?? ""}
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          fill
          sizes="(min-width: 1024px) 900px, 100vw"
          src={imgUrl}
        />
      ) : (
        <span
          className="flex flex-1 flex-col items-center justify-center gap-2 pb-40 text-[14px] font-medium"
          style={{ color: visual.fg }}
        >
          <Icon aria-hidden="true" height={24} icon={visual.icon} width={24} />
          {t("noCover")}
        </span>
      )}

      <span className="absolute inset-x-2.5 bottom-2.5 flex flex-col gap-3 rounded-[18px] bg-white p-[clamp(20px,2.2vw,28px)] md:right-auto md:max-w-[64%]">
        <span className="flex flex-wrap gap-2">
          {editorsPick ? (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-semibold"
              style={{
                background: T.accent.chip,
                color: T.accent.primaryHover,
              }}
            >
              {t("editorPick")}
            </span>
          ) : null}
          <SectionTag section={article.section} />
        </span>
        <h3
          className="m-0 text-[clamp(26px,2.6vw,38px)] leading-[1.1] text-balance transition-colors group-hover:text-(--t-accent-primary)"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: T.ink.base,
          }}
        >
          {article.title}
        </h3>
        <span className="text-[14px]" style={{ color: T.ink.dim }}>
          {articleMeta(article, {
            locale,
            readingTime: t("readingTime", { minutes: article.readMinutes }),
          })}
        </span>
      </span>
    </Link>
  )
}

/** The Journal's top stories, as its landing page leads with them: the
 * editors' pick (else the newest) beside the next two. */
export function JournalSection({
  intro,
  stories,
  locale,
}: {
  readonly intro: SectionIntro
  readonly stories: JournalTopStories
  readonly locale: Locale
}) {
  const { featured, editorsPick, sideStories } = stories
  if (!featured) return null

  return (
    <section
      aria-labelledby="journal-title"
      data-homepage-surface="paper"
      className="mx-auto w-full max-w-[1360px] px-4 sm:px-8"
    >
      <SectionHeader
        id="journal-title"
        intro={intro}
        action={
          <GlobalLink
            href="/journal"
            className="font-semibold underline underline-offset-[3px]"
            style={{ color: T.accent.primary }}
          >
            Read the journal
          </GlobalLink>
        }
      />

      <div
        className={`grid grid-cols-1 gap-4 ${
          sideStories.length > 0
            ? "lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]"
            : ""
        }`}
      >
        <LeadStory
          article={featured}
          editorsPick={editorsPick}
          locale={locale}
        />
        {sideStories.length > 0 ? (
          <div className="flex flex-col gap-4">
            {sideStories.map((article) => (
              <JournalSideCard
                article={article}
                key={article.documentId}
                locale={locale}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

JournalSection.displayName = "JournalSection"

export default JournalSection
