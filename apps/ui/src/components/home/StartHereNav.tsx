import { Landmark, Map, ScrollText, Users } from "lucide-react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

const ROUTES = [
  {
    title: "Explore the map",
    desc: "Libraries by country, region or city.",
    href: "/map",
    bg: "#fff",
    border: "var(--t-border-line)",
    Icon: Map,
  },
  {
    title: "Browse the directory",
    desc: "Search and filter libraries worldwide.",
    href: "/index",
    bg: "#fff",
    border: "var(--t-border-line)",
    Icon: Landmark,
  },
  {
    title: "Read the journal",
    desc: "Stories and notes from the library community.",
    href: "/blog",
    bg: "#fff",
    border: "var(--t-border-line)",
    Icon: ScrollText,
  },
  {
    title: "Help build the index",
    desc: "Add libraries and improve records.",
    href: "/contribute",
    bg: "#F8EEDC",
    border: "#EBDDC0",
    Icon: Users,
  },
] as const

export function StartHereNav() {
  return (
    <nav
      aria-label="Start here"
      className="mx-auto grid w-full max-w-[1360px] grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3.5 px-4 pt-4 sm:px-8"
    >
      {ROUTES.map(({ title, desc, href, bg, border, Icon }) => (
        <GlobalLink
          key={title}
          href={href}
          className="group flex items-center gap-4 rounded-[20px] border p-[18px_20px] no-underline transition-colors hover:border-(--t-accent-primary)"
          style={{ background: bg, borderColor: border }}
        >
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full border bg-white"
            style={{ borderColor: T.border.line }}
          >
            <Icon
              className="size-6"
              strokeWidth={1.6}
              style={{ color: T.ink.base }}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block text-[22px]"
              style={{
                fontFamily: T.font.serif,
                fontWeight: 500,
                color: T.ink.base,
              }}
            >
              {title}
            </span>
            <span
              className="mt-0.5 block text-[15px] leading-[1.45]"
              style={{ color: T.ink.dim }}
            >
              {desc}
            </span>
          </span>
          <span
            aria-hidden="true"
            className="text-[20px] opacity-0 transition-opacity group-hover:opacity-100"
            style={{ color: T.accent.primary }}
          >
            →
          </span>
        </GlobalLink>
      ))}
    </nav>
  )
}

StartHereNav.displayName = "StartHereNav"

export default StartHereNav
