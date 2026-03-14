import { Search } from "lucide-react"
import type { Locale } from "next-intl"

import { Container } from "@/components/elementary/Container"
import KnowledgeGlobeCanvas from "@/components/home/KnowledgeGlobeCanvas"
import { Link } from "@/lib/navigation"

const NAV_ITEMS = [
  { href: "/#explore", label: "Global Map", active: true },
  { href: "/#search", label: "Find Your Library" },
  { href: "/#about", label: "About" },
]

const HOMEPAGE_COPY = {
  cs: {
    brand: "libraries.global",
    headline: "The World's Knowledge, Reimagined.",
    inputPlaceholder: "Search for a library, city, or country.",
    intro:
      "A prototype experience for a global library index. Spin the network, follow the flows, and pressure-test the visual direction before the CMS arrives.",
    label: "Global Library Explorer",
  },
  en: {
    brand: "libraries.global",
    headline: "The World's Knowledge, Reimagined.",
    inputPlaceholder: "Search for a library, city, or country.",
    intro:
      "A prototype experience for a global library index. Spin the network, follow the flows, and pressure-test the visual direction before the CMS arrives.",
    label: "Global Library Explorer",
  },
} satisfies Record<
  Locale,
  {
    brand: string
    headline: string
    inputPlaceholder: string
    intro: string
    label: string
  }
>

export function LibraryHomePage({ locale }: { readonly locale: Locale }) {
  const copy = HOMEPAGE_COPY[locale] ?? HOMEPAGE_COPY.en

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col overflow-hidden bg-[#050816] text-white"
      data-homepage="true"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(92,149,255,0.18),transparent_34%),radial-gradient(circle_at_70%_58%,rgba(103,221,255,0.12),transparent_22%),linear-gradient(180deg,#060914_0%,#050816_54%,#070b16_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0)_18%,rgba(255,255,255,0)_82%,rgba(255,255,255,0.03)_100%)] opacity-70" />

      <header className="relative z-20 border-b border-white/10 bg-black/10 backdrop-blur-xl">
        <Container className="flex h-18 items-center justify-between gap-6 py-3">
          <div className="flex items-center gap-8">
            <Link
              className="text-lg font-medium tracking-[0.02em] text-white/95"
              href="/"
            >
              {copy.brand}
            </Link>

            <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  className={
                    item.active
                      ? "relative text-[#8cb8ff] after:absolute after:-bottom-4 after:left-0 after:h-px after:w-full after:bg-[#7faeff]"
                      : "transition-colors hover:text-white"
                  }
                  href={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden text-xs tracking-[0.34em] text-white/45 uppercase lg:block">
            Prototype hero
          </div>
        </Container>
      </header>

      <main className="relative z-10 flex-1">
        <section
          className="relative min-h-[980px] overflow-hidden sm:min-h-[1040px] lg:min-h-[calc(100svh-4.5rem)]"
          id="explore"
        >
          <div className="absolute inset-y-0 left-1/2 z-0 h-full w-screen -translate-x-1/2">
            <KnowledgeGlobeCanvas />
          </div>

          <Container className="relative z-20 pt-8 pb-16 sm:pt-12 lg:pb-24">
            <div className="relative z-20 max-w-[720px] pt-6 sm:pt-10 lg:pt-18">
              <div className="mb-6 inline-flex items-center rounded-full border border-white/12 bg-white/5 px-4 py-2 text-xs tracking-[0.24em] text-white/60 uppercase backdrop-blur-sm">
                {copy.label}
              </div>

              <h1 className="max-w-[10ch] text-[clamp(3.6rem,9vw,7.8rem)] leading-[0.92] font-semibold tracking-[-0.06em] text-white [text-shadow:0_0_28px_rgba(174,226,255,0.22)]">
                {copy.headline}
              </h1>

              <p className="mt-6 max-w-[46ch] text-base leading-7 text-white/68 sm:text-lg">
                {copy.intro}
              </p>

              <div className="mt-10" id="search">
                <label className="sr-only" htmlFor="library-search">
                  Search libraries
                </label>
                <div className="flex items-center gap-3 rounded-[28px] border border-white/15 bg-white/96 px-5 py-4 text-slate-900 shadow-[0_28px_120px_rgba(58,136,255,0.16)]">
                  <Search className="size-5 text-slate-500" strokeWidth={1.8} />
                  <input
                    className="w-full bg-transparent text-base outline-none placeholder:text-slate-500 sm:text-lg"
                    id="library-search"
                    placeholder={copy.inputPlaceholder}
                    type="text"
                  />
                </div>
              </div>
            </div>
          </Container>
        </section>
      </main>

      <footer
        className="relative z-20 border-t border-white/10 bg-black/10 backdrop-blur-xl"
        id="about"
      >
        <Container className="flex flex-col gap-4 py-6 text-sm text-white/52 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-5">
            <Link
              className="transition-colors hover:text-white"
              href="/#privacy"
            >
              Privacy Policy
            </Link>
            <Link className="transition-colors hover:text-white" href="/#terms">
              Terms of Use
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {["Fb", "X", "YT"].map((label) => (
              <span
                key={label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-medium text-white/70"
              >
                {label}
              </span>
            ))}
          </div>
        </Container>
      </footer>
    </div>
  )
}

export default LibraryHomePage
