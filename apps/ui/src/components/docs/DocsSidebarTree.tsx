"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import { SearchField } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

import { DOCS_SECTIONS, type DocsSectionKey } from "./docs.config"

export type DocsTreePage = {
  documentId: string
  title: string
  href: string
  active: boolean
}

export type DocsTree = Record<DocsSectionKey, DocsTreePage[]>

/** Left docs sidebar: filter input + the section tree with the active page
 * highlighted as an indigo chip. */
export function DocsSidebarTree({ tree }: { readonly tree: DocsTree }) {
  const [filter, setFilter] = useState("")
  const query = filter.trim().toLowerCase()

  return (
    <nav aria-label="Docs" className="flex flex-col gap-5">
      <SearchField
        id="docs-filter"
        placeholder="Filter docs"
        size="sm"
        onClear={() => setFilter("")}
        inputProps={{
          value: filter,
          onChange: (event) => setFilter(event.target.value),
          autoComplete: "off",
        }}
      />

      <GlobalLink
        className="text-[14px] font-medium transition-colors hover:text-(--t-ink-base)"
        href="/docs"
        style={{ color: T.ink.dim }}
      >
        ← All docs
      </GlobalLink>

      <ul className="m-0 flex list-none flex-col gap-5 p-0">
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

          return (
            <li key={section.key}>
              <p
                className="m-0 flex items-center gap-2.5 text-[15px] font-semibold"
                style={{ color: T.ink.base }}
              >
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full"
                  style={{ background: section.tintBg, color: section.tintFg }}
                >
                  <Icon height={15} icon={section.icon} width={15} />
                </span>
                {section.title}
              </p>

              <ul
                className="m-0 mt-2 flex list-none flex-col gap-0.5 border-l p-0 pl-3"
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
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
