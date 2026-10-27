"use client"

import { usePathname } from "next/navigation"
import { useTranslations as useUiTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { navigationAttributes } from "@/lib/analytics-events"

export type NavLink = { label: string; href: string }

/** Strip an optional /{locale} prefix so matching works on bare paths too. */
function normalizePathname(pathname: string): string {
  return pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/"
}

/**
 * Header navigation with the active section rendered as an ink pill
 * (dark bg, white text) per the v2 designs.
 */
export function GlobalNavLinks({
  links,
  align = "center",
}: {
  readonly links: NavLink[]
  /** "start" sits the nav beside the logo (the full-bleed app header). */
  readonly align?: "center" | "start"
}) {
  const tUi = useUiTranslations("ui")

  const pathname = normalizePathname(usePathname() ?? "/")

  return (
    <nav
      aria-label={tUi("main")}
      className={`hidden flex-1 items-center gap-0.5 lg:flex ${align === "start" ? "justify-start" : "justify-center"}`}
    >
      {links.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`)

        return (
          <GlobalLink
            key={link.href}
            href={link.href}
            {...navigationAttributes(link.href)}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? align === "start"
                  ? // App header (Atlas design): light indigo chip
                    "rounded-full bg-(--t-accent-chip) px-3.5 py-2 text-base font-semibold text-(--t-accent-primary-hover)"
                  : "rounded-full bg-(--t-ink-base) px-3.5 py-2 text-base font-medium text-white"
                : "rounded-full px-3.5 py-2 text-base font-medium text-(--t-ink-base) transition-colors hover:bg-(--t-bg-muted-2)"
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
