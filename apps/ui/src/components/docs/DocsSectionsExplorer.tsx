"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import {
  DOCS_SECTIONS,
  type DocsSectionKey,
} from "@/components/docs/docs.config"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

export type DocsPageRow = {
  documentId: string
  title: string
  href: string
  summary: string | null
  updatedLabel: string | null
  readMinutes: number | null
}

export type DocsSectionData = Record<DocsSectionKey, DocsPageRow[]>

function SectionChip({ count }: { readonly count: number }) {
  if (count === 0) {
    return (
      <span
        className="shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold"
        style={{ background: "#F5EEDC", color: "#6B5420" }}
      >
        Planned
      </span>
    )
  }

  return (
    <span
      className="shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold"
      style={{ background: T.bg.muted, color: T.ink.dim }}
    >
      {count} page{count === 1 ? "" : "s"}
    </span>
  )
}

export function DocsSectionsExplorer({
  sections,
}: {
  readonly sections: DocsSectionData
}) {
  const [active, setActive] = useState<"all" | DocsSectionKey>("all")

  const totalPages = DOCS_SECTIONS.reduce(
    (sum, s) => sum + sections[s.key].length,
    0
  )
  const visibleSections =
    active === "all"
      ? DOCS_SECTIONS
      : DOCS_SECTIONS.filter((s) => s.key === active)

  const tabs: { key: "all" | DocsSectionKey; label: string; count: number }[] =
    [
      { key: "all", label: "All sections", count: totalPages },
      ...DOCS_SECTIONS.map((s) => ({
        key: s.key,
        label: s.title,
        count: sections[s.key].length,
      })),
    ]

  return (
    <div>
      {/* Section tabs */}
      <div
        aria-label="Docs sections"
        className="flex flex-wrap gap-x-1 gap-y-1 border-b"
        role="tablist"
        style={{ borderColor: T.border.line }}
      >
        {tabs.map((tab) => {
          const selected = active === tab.key

          return (
            <button
              key={tab.key}
              aria-selected={selected}
              className="-mb-px flex items-center gap-1.5 border-b-[3px] px-3 pt-1 pb-2.5 text-[15px] transition-colors"
              onClick={() => setActive(tab.key)}
              role="tab"
              style={{
                borderColor: selected ? T.accent.primary : "transparent",
                color: T.ink.base,
                fontWeight: selected ? 700 : 500,
              }}
              type="button"
            >
              {tab.label}
              <span style={{ color: T.ink.low, fontWeight: 500 }}>
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-3 mb-0 text-[15px]" style={{ color: T.ink.dim }}>
        {totalPages} page{totalPages === 1 ? "" : "s"} so far. Most sections
        still need writing.
      </p>

      {/* Section cards */}
      <div className="mt-5 flex flex-col gap-5">
        {visibleSections.map((section) => {
          const rows = sections[section.key]

          return (
            <section
              aria-labelledby={`docs-${section.key}`}
              className="rounded-[20px] border p-6"
              id={section.key}
              key={section.key}
              style={{ background: T.bg.deep, borderColor: T.border.line }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: section.tintBg,
                      color: section.tintFg,
                    }}
                  >
                    <Icon height={20} icon={section.icon} width={20} />
                  </span>
                  <div>
                    <h2
                      className="m-0"
                      id={`docs-${section.key}`}
                      style={{
                        fontFamily: T.font.serif,
                        fontSize: "24px",
                        fontWeight: 500,
                        color: T.ink.base,
                      }}
                    >
                      {section.title}
                    </h2>
                    <p
                      className="mt-1 mb-0 text-[15px]"
                      style={{ color: T.ink.dim }}
                    >
                      {section.description}
                    </p>
                  </div>
                </div>
                <SectionChip count={rows.length} />
              </div>

              {rows.length === 0 ? (
                <div
                  className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-4"
                  style={{ borderColor: T.border.divider }}
                >
                  <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
                    No pages written yet.
                  </p>
                  <GlobalLink
                    className="inline-flex items-center gap-1 text-[15px] font-semibold underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-current"
                    href={`/contribute/docs/new?section=${section.key}`}
                    style={{ color: T.accent.primary }}
                  >
                    Write the first page
                    <Icon
                      aria-hidden="true"
                      height={14}
                      icon="mdi:arrow-right"
                      width={14}
                    />
                  </GlobalLink>
                </div>
              ) : (
                <ul className="m-0 mt-5 list-none p-0">
                  {rows.map((row) => (
                    <li
                      className="border-t"
                      key={row.documentId}
                      style={{ borderColor: T.border.divider }}
                    >
                      <GlobalLink
                        className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3.5"
                        href={row.href}
                      >
                        <span className="min-w-0">
                          <span
                            className="block text-[17px] font-semibold underline decoration-transparent underline-offset-[3px] transition-colors group-hover:decoration-current"
                            style={{
                              fontFamily: T.font.serif,
                              color: T.ink.base,
                            }}
                          >
                            {row.title}
                          </span>
                          {row.summary ? (
                            <span
                              className="mt-1 block max-w-[64ch] text-[14px] leading-[1.5]"
                              style={{ color: T.ink.dim }}
                            >
                              {row.summary}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className="flex shrink-0 items-center gap-4 text-[14px]"
                          style={{ color: T.ink.low }}
                        >
                          {row.readMinutes != null ? (
                            <span className="inline-flex items-center gap-1">
                              <Icon
                                aria-hidden="true"
                                height={14}
                                icon="mdi:clock-outline"
                                width={14}
                              />
                              {row.readMinutes} min read
                            </span>
                          ) : null}
                          {row.updatedLabel ? (
                            <span>Updated {row.updatedLabel}</span>
                          ) : null}
                        </span>
                      </GlobalLink>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
