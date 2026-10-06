"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import { SearchField } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

import { openSectionsByDefault } from "./docs-sections"
import { DOCS_SECTIONS, type DocsSectionKey } from "./docs.config"

export type DocsTreePage = {
  documentId: string
  title: string
  href: string
  active: boolean
}

export type DocsTree = Record<DocsSectionKey, DocsTreePage[]>

/** Left docs sidebar: filter input + the section tree with the active page
 * highlighted as an indigo chip. Sections collapse; only the one holding the
 * current page starts open, and filtering opens every section that matches. */
export function DocsSidebarTree({ tree }: { readonly tree: DocsTree }) {
  const [filter, setFilter] = useState("")
  const [open, setOpen] = useState<ReadonlySet<DocsSectionKey>>(() =>
    openSectionsByDefault(tree)
  )
  const query = filter.trim().toLowerCase()
  const allOpen = DOCS_SECTIONS.every((s) => open.has(s.key))

  const toggle = (key: DocsSectionKey) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)

      return next
    })

  return (
    <nav aria-label="Knowledge" className="flex flex-col gap-5">
      <SearchField
        id="docs-filter"
        placeholder="Filter articles"
        size="sm"
        onClear={() => setFilter("")}
        inputProps={{
          value: filter,
          onChange: (event) => setFilter(event.target.value),
          autoComplete: "off",
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <GlobalLink
          className="text-[14px] font-medium transition-colors hover:text-(--t-ink-base)"
          href="/knowledge"
          style={{ color: T.ink.dim }}
        >
          ← All articles
        </GlobalLink>
        {query ? null : (
          <button
            type="button"
            className="cursor-pointer rounded-full border-0 bg-transparent p-0 text-[13px] font-medium transition-colors hover:text-(--t-ink-base)"
            style={{ color: T.ink.dim }}
            onClick={() =>
              setOpen(
                allOpen ? new Set() : new Set(DOCS_SECTIONS.map((s) => s.key))
              )
            }
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {DOCS_SECTIONS.map((section) => {
          const pages = tree[section.key] ?? []
          const visiblePages = query
            ? pages.filter((page) => page.title.toLowerCase().includes(query))
            : pages
          const sectionMatches =
            !query || section.title.toLowerCase().includes(query)
          if (query && !sectionMatches && visiblePages.length === 0) {
            return null
          }
          const expanded = query ? true : open.has(section.key)
          const listId = `docs-tree-${section.key}`

          return (
            <li key={section.key}>
              <button
                type="button"
                aria-controls={listId}
                aria-expanded={expanded}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border-0 bg-transparent px-1 py-1 text-left text-[15px] font-semibold transition-colors hover:bg-(--t-bg-muted)"
                style={{ color: T.ink.base }}
                onClick={() => toggle(section.key)}
              >
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full"
                  style={{ background: section.tintBg, color: section.tintFg }}
                >
                  <Icon height={15} icon={section.icon} width={15} />
                </span>
                <span className="min-w-0 flex-1">{section.title}</span>
                <span
                  className="text-[13px] font-medium"
                  style={{ color: T.ink.faint }}
                >
                  {visiblePages.length}
                  <span className="sr-only">
                    {visiblePages.length === 1 ? " article" : " articles"}
                  </span>
                </span>
                <Icon
                  aria-hidden="true"
                  className="shrink-0 transition-transform"
                  height={18}
                  icon="mdi:chevron-down"
                  style={{
                    color: T.ink.dim,
                    transform: expanded ? undefined : "rotate(-90deg)",
                  }}
                  width={18}
                />
              </button>

              {expanded ? (
                <ul
                  id={listId}
                  className="m-0 mt-2 ml-4 flex list-none flex-col gap-0.5 border-l p-0 pl-3"
                  style={{ borderColor: T.border.divider }}
                >
                  {visiblePages.length === 0 ? (
                    <li
                      className="px-2.5 py-1.5 text-[13px]"
                      style={{ color: T.ink.faint }}
                    >
                      No pages yet
                    </li>
                  ) : (
                    visiblePages.map((page) => (
                      <li key={page.documentId}>
                        <GlobalLink
                          aria-current={page.active ? "page" : undefined}
                          className="block rounded-[8px] px-2.5 py-1.5 text-[14px] transition-colors hover:bg-(--t-bg-muted)"
                          href={page.href}
                          style={
                            page.active
                              ? {
                                  background: T.accent.chip,
                                  color: T.accent.primaryHover,
                                  fontWeight: 600,
                                }
                              : { color: T.ink.dim }
                          }
                        >
                          {page.title}
                        </GlobalLink>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
