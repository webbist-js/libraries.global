"use client"

import { usePathname } from "next/navigation"

import GlobalLink from "@/components/global/GlobalLink"

export type NavLink = { label: string; href: string }

/** Strip an optional /{locale} prefix so matching works on bare paths too. */
function normalizePathname(pathname: string): string {
  return pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/"
}

/**
 * Header navigation with the active section rendered as an ink pill
 * (dark bg, white text) per the v2 designs.
 */
export function GlobalNavLinks({ links }: { readonly links: NavLink[] }) {
  const pathname = normalizePathname(usePathname() ?? "/")

  return (
    <nav
      aria-label="Main"
      className="hidden flex-1 items-center justify-center gap-0.5 md:flex"
    >
      {links.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`)

        return (
          <GlobalLink
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-full bg-(--t-ink-base) px-3.5 py-2 text-[15px] font-medium text-white"
                : "rounded-full px-3.5 py-2 text-[15px] font-medium text-(--t-ink-base) transition-colors hover:bg-(--t-bg-muted-2)"
            }
          >
            {link.label}
          </GlobalLink>
        )
      })}
    </nav>
  )
}

GlobalNavLinks.displayName = "GlobalNavLinks"

export default GlobalNavLinks
