"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useId, useState } from "react"

import { SearchField } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

import { openSectionsByDefault } from "./docs-sections"
import type { DocsSection } from "./docs.config"

export type DocsTreePage = {
  documentId: string
  title: string
  href: string
  active: boolean
}

/** Pages by section slug. */
export type DocsTree = Record<string, DocsTreePage[]>

/** Left docs sidebar: filter input + the section tree with the active page
 * highlighted as an indigo chip. Sections collapse; only the one holding the
 * current page starts open, and filtering opens every section that matches. */
export function DocsSidebarTree({
  sections,
  tree,
}: {
  readonly sections: readonly DocsSection[]
  readonly tree: DocsTree
}) {
  const tUi = useUiTranslations("ui")
  const tArticle = useUiTranslations("editorial")

  const instanceId = useId()
  const [filter, setFilter] = useState("")
  const [open, setOpen] = useState<ReadonlySet<string>>(() =>
    openSectionsByDefault(tree)
  )
  const query = filter.trim().toLowerCase()
  const hasMatches = sections.some(
    (section) =>
      section.title.toLowerCase().includes(query) ||
      (tree[section.slug] ?? []).some((page) =>
        page.title.toLowerCase().includes(query)
      )
  )
  const allOpen = sections.every((s) => open.has(s.slug))

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)

      return next
    })

  return (
    <nav aria-label={tUi("knowledge")} className="docs-sidebar-tree">
      <div className="docs-tree-header">
        <SearchField
          id={`${instanceId}-docs-filter`}
          label={tArticle("filterGuides")}
          placeholder={tArticle("filterGuides")}
          className="bg-(--t-bg-surface) focus-within:ring-2 focus-within:ring-(--t-accent-primary) [&_input:focus-visible]:outline-none!"
          size="sm"
          onClear={() => setFilter("")}
          inputProps={{
            value: filter,
            onChange: (event) => setFilter(event.target.value),
            autoComplete: "off",
          }}
        />

        <div className="docs-tree-toolbar">
          <GlobalLink
            className="inline-flex min-h-10 items-center text-sm font-semibold no-underline transition-colors hover:text-(--t-accent-primary)"
            href="/knowledge"
          >
            ‹ {tArticle("allGuidesLabel")}
          </GlobalLink>
          {query ? null : (
            <button
              type="button"
              className="cursor-pointer rounded-full border-0 bg-transparent px-1 py-2 text-xs font-medium transition-colors hover:text-(--t-ink-base)"
              style={{ color: T.ink.dim }}
              onClick={() =>
                setOpen(
                  allOpen ? new Set() : new Set(sections.map((s) => s.slug))
                )
              }
            >
              {allOpen ? tArticle("collapseAll") : tArticle("expandAll")}
            </button>
          )}
        </div>
      </div>

      {query && !hasMatches ? (
        <p
          role="status"
          className="m-0 rounded-xl bg-(--t-bg-muted) p-3 text-sm text-(--t-ink-dim)"
        >
          {tArticle("noMatchingGuides")}
        </p>
      ) : null}
      <ul className="docs-tree-sections">
        {sections.map((section) => {
          const pages = tree[section.slug] ?? []
          const visiblePages =
            query && !section.title.toLowerCase().includes(query)
              ? pages.filter((page) => page.title.toLowerCase().includes(query))
              : pages
          const sectionMatches =
            !query || section.title.toLowerCase().includes(query)
          if (query && !sectionMatches && visiblePages.length === 0) {
            return null
          }
          const expanded = query ? true : open.has(section.slug)
          const listId = `${instanceId}-docs-tree-${section.slug}`

          return (
            <li key={section.slug}>
              <button
                type="button"
                aria-controls={listId}
                aria-expanded={expanded}
                className="docs-tree-section-toggle"
                style={{ color: T.ink.base }}
                onClick={() => toggle(section.slug)}
              >
                <span
                  aria-hidden="true"
                  className="docs-section-icon flex size-8 shrink-0 items-center justify-center rounded-[10px]"
                  style={{ background: section.tintBg, color: section.tintFg }}
                >
                  <Icon height={15} icon={section.icon} width={15} />
                </span>
                <span className="min-w-0 flex-1">{section.title}</span>
                <span
                  className="text-sm font-medium"
                  style={{ color: T.ink.faint }}
                >
                  <span aria-hidden="true">{visiblePages.length}</span>
                  <span className="sr-only">
                    {tArticle("articleCount", { count: visiblePages.length })}
                  </span>
                </span>
                <Icon
                  aria-hidden="true"
                  className="shrink-0 transition-transform"
                  height={14}
                  icon="mdi:chevron-down"
                  style={{
                    color: T.ink.dim,
                    transform: expanded ? undefined : "rotate(-90deg)",
                  }}
                  width={14}
                />
              </button>

              {expanded ? (
                <ul id={listId} className="docs-tree-pages">
                  {visiblePages.length === 0 ? (
                    <li
                      className="px-2.5 py-1.5 text-sm"
                      style={{ color: T.ink.faint }}
                    >
                      {tArticle("noPages")}
                    </li>
                  ) : (
                    visiblePages.map((page) => (
                      <li key={page.documentId}>
                        <GlobalLink
                          aria-current={page.active ? "page" : undefined}
                          className="docs-tree-page text-sm leading-normal no-underline hover:no-underline"
                          href={page.href}
                          style={
                            page.active
                              ? {
                                  background: T.accent.chip,
                                  color: T.accent.primaryHover,
                                  fontWeight: 600,
                                }
                              : undefined
                          }
                        >
                          {page.title}
                        </GlobalLink>
                      </li>
                    ))
                  )}
                  <li>
                    <GlobalLink
                      href={`/knowledge?section=${encodeURIComponent(section.slug)}`}
                      className="docs-tree-page docs-tree-open-section text-sm no-underline hover:no-underline"
                      aria-label={`${tArticle("openSection")} · ${section.title}`}
                    >
                      {tArticle("openSection")} ›
                    </GlobalLink>
                  </li>
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
