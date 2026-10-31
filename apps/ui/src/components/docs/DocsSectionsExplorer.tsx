import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import { EditorOnly } from "@/components/contribute/EditorOnly"
import type { DocsSection } from "@/components/docs/docs.config"
import GlobalLink from "@/components/global/GlobalLink"

import { sectionPreview } from "./docs-sections"

export type DocsPageRow = {
  documentId: string
  title: string
  href: string
  summary: string | null
  updatedLabel: string | null
  readMinutes: number | null
}

export type DocsSectionData = { section: DocsSection; rows: DocsPageRow[] }[]

/** Short, scannable previews; the section link opens the complete guide list. */
export function DocsSectionsExplorer({
  sections,
  focused = false,
}: {
  readonly sections: DocsSectionData
  readonly focused?: boolean
}) {
  const t = useTranslations("editorial")

  return (
    <section aria-labelledby={focused ? undefined : "docs-sections-heading"}>
      {!focused ? (
        <h2
          id="docs-sections-heading"
          className="type-small-heading m-0 mb-3 text-(--t-ink-dim)"
        >
          {t("allSections")}
        </h2>
      ) : null}
      {sections.length === 0 ? (
        <p className="rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-6 text-sm text-(--t-ink-dim)">
          {t("noSections")}
        </p>
      ) : (
        <div className={focused ? "grid gap-3" : "grid gap-3 md:grid-cols-2"}>
          {sections.map(({ section, rows }) => (
            <SectionCard
              key={section.slug}
              section={section}
              rows={rows}
              focused={focused}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function SectionCard({
  section,
  rows,
  focused,
}: {
  readonly section: DocsSection
  readonly rows: DocsPageRow[]
  readonly focused: boolean
}) {
  const t = useTranslations("editorial")
  const preview = sectionPreview(rows, focused)
  const href = `/knowledge?section=${section.slug}`
  const Heading = focused ? "h2" : "h3"

  return (
    <section
      id={section.slug}
      aria-labelledby={`docs-${section.slug}`}
      className="flex min-w-0 scroll-mt-40 flex-col rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: section.tintBg, color: section.tintFg }}
        >
          <Icon icon={section.icon} width={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
            <Heading id={`docs-${section.slug}`} className="type-h3 m-0">
              <GlobalLink
                href={href}
                className="transition-colors hover:text-(--t-accent-primary)"
              >
                {section.title}
              </GlobalLink>
            </Heading>
            <span className="shrink-0 text-xs text-(--t-ink-dim)">
              {t("guideCount", { count: rows.length })}
            </span>
          </div>
          {section.description ? (
            <p className="mt-1 mb-0 text-sm leading-relaxed text-(--t-ink-dim)">
              {section.description}
            </p>
          ) : null}
        </div>
      </div>
      {rows.length ? (
        <ul className="mt-4 mb-0 list-none p-0">
          {preview.rows.map((row) => (
            <li key={row.documentId} className="border-t border-(--t-divider)">
              <GlobalLink
                href={row.href}
                className="group flex min-h-11 items-baseline justify-between gap-3 py-3 text-sm transition-colors hover:text-(--t-accent-primary)"
              >
                <span className="min-w-0">
                  <span>{row.title}</span>
                  {focused && row.summary ? (
                    <span className="mt-2 block text-sm text-(--t-ink-dim)">
                      {row.summary}
                    </span>
                  ) : null}
                </span>
                {row.readMinutes != null ? (
                  <span className="shrink-0 text-xs text-(--t-ink-dim)">
                    {t("minutes", { minutes: row.readMinutes })}
                  </span>
                ) : null}
              </GlobalLink>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 border-t border-(--t-divider) pt-4 text-sm text-(--t-ink-dim)">
          <p className="m-0">{t("noWrittenPages")}</p>
          <EditorOnly kind="knowledge">
            <GlobalLink
              href={`/contribute/knowledge/new?type=knowledge&section=${section.slug}`}
              className="mt-2 inline-flex min-h-11 items-center font-semibold text-(--t-accent-primary)"
            >
              {t("writeFirstPage")}
            </GlobalLink>
          </EditorOnly>
        </div>
      )}
      {!focused ? (
        <GlobalLink
          href={href}
          className="mt-auto inline-flex min-h-11 items-center gap-1.5 pt-3 text-sm font-semibold text-(--t-accent-primary) hover:underline"
        >
          {preview.hidden > 0
            ? t("allGuides", { count: rows.length })
            : t("openSection")}
          <span className="sr-only">
            {t("inSection", { section: section.title })}
          </span>
          <Icon aria-hidden="true" icon="mdi:arrow-right" width={16} />
        </GlobalLink>
      ) : null}
    </section>
  )
}
