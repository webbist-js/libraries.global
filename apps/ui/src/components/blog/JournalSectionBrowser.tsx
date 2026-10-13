import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { JournalSectionWithCount } from "@/lib/journal-landing"

import {
  journalHref,
  sectionVisual,
  type JournalQuery,
} from "./journalLanding.helpers"

export function JournalHeading({
  id,
  children,
  italic,
}: {
  readonly id: string
  readonly children: ReactNode
  readonly italic?: string
}) {
  return (
    <h2
      className="m-0 text-[clamp(28px,3vw,38px)] leading-[1.05]"
      id={id}
      style={{
        fontFamily: T.font.serif,
        fontWeight: 500,
        letterSpacing: "-0.02em",
        color: T.ink.base,
      }}
    >
      {children}
      {italic ? (
        <>
          {" "}
          <em style={{ fontWeight: 400, color: T.accent.primary }}>{italic}</em>
        </>
      ) : null}
    </h2>
  )
}

/** "Browse by section": one card per section, each filtering the list. */
export function JournalSectionBrowser({
  sections,
  total,
  query,
}: {
  readonly sections: JournalSectionWithCount[]
  readonly total: number
  readonly query: JournalQuery
}) {
  const t = useTranslations("editorial")
  if (sections.length === 0) return null

  return (
    <section aria-labelledby="journal-sections" className="mt-14">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <JournalHeading id="journal-sections">
          {t.rich("browseSections", {
            em: (chunks) => (
              <em style={{ fontWeight: 400, color: T.accent.primary }}>
                {chunks}
              </em>
            ),
          })}
        </JournalHeading>
        <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
          {t("articlesInSections", {
            articles: t("articleCount", { count: total }),
            sections: t("sectionCount", { count: sections.length }),
          })}
        </p>
      </div>

      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 p-0">
        {sections.map((section) => {
          const visual = sectionVisual(section)
          const active = query.section === section.slug

          return (
            <li key={section.documentId}>
              <GlobalLink
                aria-current={active ? "true" : undefined}
                className="flex h-full flex-col rounded-[18px] border p-4 transition-[border-color,box-shadow] duration-300 hover:border-[#B9B4F5] hover:shadow-[0_12px_28px_rgba(23,22,43,.08)]"
                href={journalHref(
                  query,
                  { section: active ? null : section.slug },
                  "all-articles"
                )}
                style={{
                  background: T.bg.deep,
                  borderColor: active ? T.accent.primary : T.border.line,
                }}
              >
                <span className="flex items-start justify-between gap-2">
                  <span
                    aria-hidden="true"
                    className="flex size-9 items-center justify-center rounded-[10px]"
                    style={{ background: visual.bg, color: visual.fg }}
                  >
                    <Icon height={18} icon={visual.icon} width={18} />
                  </span>
                  <span
                    className="text-[24px] leading-none"
                    style={{
                      fontFamily: T.font.serif,
                      color: T.ink.base,
                    }}
                  >
                    <span aria-hidden="true">{section.count}</span>
                    <span className="sr-only">
                      {t("articleCount", { count: section.count })}
                    </span>
                  </span>
                </span>
                <span
                  className="mt-4 text-[15px] font-semibold"
                  style={{ color: T.ink.base }}
                >
                  {section.name}
                </span>
                {section.description ? (
                  <span
                    className="mt-1 text-[13px] leading-[1.45]"
                    style={{ color: T.ink.dim }}
                  >
                    {section.description}
                  </span>
                ) : null}
              </GlobalLink>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
