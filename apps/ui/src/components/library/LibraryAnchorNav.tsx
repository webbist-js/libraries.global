"use client"

import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { Container } from "@/components/elementary/Container"
import type { AnchorItem } from "@/components/library/library-anchors"
import { T } from "@/lib/design-tokens"

/**
 * Sticky "On this page" tabs under the 56px header, on the hero band's
 * colour. The tab for the section in view is marked as current.
 */
export function LibraryAnchorNav({ items }: { readonly items: AnchorItem[] }) {
  const tUi = useUiTranslations("ui")

  const [current, setCurrent] = useState<string | null>(null)

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.href.slice(1)))
      .filter((el): el is HTMLElement => el !== null)
    if (sections.length === 0) return
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting)
            visible.set(entry.target.id, entry.boundingClientRect.top)
          else visible.delete(entry.target.id)
        }
        // The topmost section in the reading band wins.
        const first = sections.find((s) => visible.has(s.id))
        setCurrent(first ? `#${first.id}` : null)
      },
      { rootMargin: "-120px 0px -55% 0px" }
    )
    for (const s of sections) observer.observe(s)

    return () => observer.disconnect()
  }, [items])

  return (
    <nav
      data-sticky-navigation=""
      aria-label={tUi("on_this_page")}
      className="sticky top-(--sticky-header-height) z-5 border-b"
      style={{ background: T.bg.space, borderColor: T.border.line }}
    >
      <Container>
        <ul className="m-0 -mx-1 flex list-none gap-4 overflow-x-auto p-0 [scrollbar-width:none]">
          {items.map((item) => {
            const active = current === item.href

            return (
              <li key={item.href} className="shrink-0">
                <a
                  href={item.href}
                  aria-current={active ? "location" : undefined}
                  className="flex min-h-13 items-center gap-[7px] border-b-2 px-1 py-3 text-[14px] font-medium whitespace-nowrap no-underline transition-colors hover:text-(--t-accent-primary)"
                  style={{
                    color: active ? T.accent.primary : T.ink.dim,
                    borderColor: active ? T.accent.primary : "transparent",
                  }}
                >
                  {item.label}
                  {item.pro ? (
                    <span
                      className="rounded-full px-1.5 text-[11px] font-bold"
                      style={{
                        background: T.accent.chip,
                        color: T.accent.primary,
                      }}
                    >
                      Pro
                    </span>
                  ) : null}
                </a>
              </li>
            )
          })}
        </ul>
      </Container>
    </nav>
  )
}
