"use client"

import { usePathname } from "next/navigation"
import type React from "react"
import { useEffect, useId, useRef, useState } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import type { NavLink } from "@/components/global/GlobalNavLinks"
import { T } from "@/lib/design-tokens"

function normalizePathname(pathname: string): string {
  return pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/"
}

/**
 * Collapsed header navigation for narrow screens (below `lg`). A disclosure
 * button opens a panel under the header with the main links and the actions
 * that don't fit in the bar (language, account, Contribute).
 */
export function GlobalMobileMenu({
  links,
  actions,
}: {
  readonly links: NavLink[]
  /** Server-rendered actions (locale switcher, auth, Contribute). */
  readonly actions: React.ReactNode
}) {
  const pathname = normalizePathname(usePathname() ?? "/")
  // Open "for" the page it was opened on, so any navigation closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname
  const setOpen = (v: boolean | ((prev: boolean) => boolean)) =>
    setOpenOn((prev) => {
      const next = typeof v === "function" ? v(prev === pathname) : v

      return next ? pathname : null
    })
  const panelId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setOpen(false)
      buttonRef.current?.focus()
    }
    window.addEventListener("keydown", onKey)

    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 items-center justify-center rounded-full border"
        style={{
          borderColor: T.border.line,
          background: T.bg.deep,
          color: T.ink.base,
        }}
      >
        <span className="sr-only">{open ? "Close menu" : "Menu"}</span>
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 top-14 bottom-0 z-[59] cursor-default"
            style={{ background: "rgba(23,22,43,.18)" }}
          />
          <div
            id={panelId}
            ref={panelRef}
            className="absolute inset-x-0 top-full z-[61] max-h-[calc(100dvh-56px)] overflow-auto border-b px-4 pt-3 pb-5 sm:px-8"
            style={{ background: T.bg.void, borderColor: T.border.line }}
          >
            <nav aria-label="Main">
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {links.map((link) => {
                  const active =
                    pathname === link.href ||
                    pathname.startsWith(`${link.href}/`)

                  return (
                    <li key={link.href}>
                      <GlobalLink
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        className="flex min-h-12 items-center rounded-2xl px-4 text-[17px] font-medium"
                        style={
                          active
                            ? { background: T.ink.base, color: "#fff" }
                            : { color: T.ink.base }
                        }
                      >
                        {link.label}
                      </GlobalLink>
                    </li>
                  )
                })}
              </ul>
            </nav>
            <div
              className="mt-3 flex flex-wrap items-center gap-3 border-t pt-4"
              style={{ borderColor: T.border.divider }}
            >
              {actions}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

GlobalMobileMenu.displayName = "GlobalMobileMenu"

export default GlobalMobileMenu
