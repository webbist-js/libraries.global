import { BookOpen } from "lucide-react"
import Image from "next/image"
import type { Locale } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import {
  homepageLinkAttributes,
  homepageContentAttributes,
} from "@/components/home/homepage.analytics"
import type { LinkCard, SectionIntro } from "@/components/home/homepage.types"
import SectionHeader from "@/components/home/sections/SectionHeader"
import type { JournalTopStories } from "@/lib/journal-landing"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

export function HomeEditorialSection({
  intro,
  stories,
  links,
  locale,
}: {
  readonly intro: SectionIntro
  readonly stories: JournalTopStories
  readonly links: readonly LinkCard[]
  readonly locale: Locale
}) {
  const articles = [stories.featured, ...stories.sideStories]
    .filter((article) => article !== null)
    .slice(0, 2)

  return (
    <section
      className="home-frame home-editorial"
      data-homepage-surface="paper"
      aria-label="Journal and Knowledge"
    >
      <div>
        <SectionHeader
          id="home-journal-title"
          intro={intro}
          action={
            <GlobalLink
              href="/journal"
              {...homepageLinkAttributes("/journal")}
              className="home-text-link"
            >
              All stories
            </GlobalLink>
          }
        />
        {articles.length ? (
          <div className="home-stories">
            {articles.map((article) => {
              const image = formatStrapiMediaUrl(article.heroImage?.url)

              return (
                <GlobalLink
                  key={article.documentId}
                  href={`/journal/${article.section?.slug ?? "general"}/${article.slug}`}
                  {...homepageContentAttributes("journal", article.documentId)}
                  className="home-editorial-card"
                  lang={article.locale ?? locale}
                >
                  <div className="home-card-image">
                    {image ? (
                      <Image
                        fill
                        src={image}
                        alt={article.heroImage?.alternativeText ?? ""}
                        sizes="(min-width: 1100px) 420px, (min-width: 700px) 45vw, 90vw"
                      />
                    ) : (
                      <span className="home-image-fallback">
                        <BookOpen aria-hidden="true" size={40} />
                      </span>
                    )}
                  </div>
                  <h3 className="type-h3">{article.title}</h3>
                  <p className="home-card-summary">
                    {article.summary}{" "}
                    <span className="home-reading-time">
                      · {article.readMinutes} min read
                    </span>
                  </p>
                </GlobalLink>
              )
            })}
          </div>
        ) : (
          <p className="home-section-copy">
            Stories, field notes and perspectives from the world of libraries.{" "}
            <GlobalLink
              href="/journal"
              {...homepageLinkAttributes("/journal")}
              className="home-text-link"
            >
              Explore the Journal
            </GlobalLink>
          </p>
        )}
      </div>
      <nav aria-labelledby="home-knowledge-title" className="home-knowledge">
        <h2 id="home-knowledge-title" className="type-h3">
          Knowledge &amp; help
        </h2>
        <ul className="home-link-rows">
          {links.map((link) => (
            <li key={link.title}>
              <GlobalLink
                href={link.href}
                {...homepageLinkAttributes(link.href)}
              >
                {link.title}
              </GlobalLink>
            </li>
          ))}
        </ul>
        <GlobalLink
          href="/knowledge"
          {...homepageLinkAttributes("/knowledge")}
          className="home-text-link"
        >
          All guides
        </GlobalLink>
      </nav>
    </section>
  )
}
