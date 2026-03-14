import { ArrowUpRight, Search } from "lucide-react"
import type { Locale } from "next-intl"

import { Container } from "@/components/elementary/Container"
import KnowledgeGlobeCanvas from "@/components/home/KnowledgeGlobeCanvas"
import { Link } from "@/lib/navigation"

const NAV_ITEMS = [
  { href: "/#explore", label: "Global Map", active: true },
  { href: "/#search", label: "Find Your Library" },
  { href: "/#impact", label: "Impact Data" },
  { href: "/#about", label: "About" },
]

const METRICS = [
  { label: "Total Global Visitors Today", value: "1,245,890", width: "76%" },
  { label: "Digital Loans Today", value: "45,672", width: "34%" },
  { label: "New Libraries Joined", value: "12", width: "8%" },
]

const CATEGORY_TAGS = ["Public", "Academic", "Community"]

const HOMEPAGE_COPY = {
  cs: {
    brand: "libraries.global",
    currentLocation: "Poland",
    headline: "The World's Knowledge, Reimagined.",
    inputPlaceholder: "Search for a library, city, or country.",
    intro:
      "A prototype experience for a global library index. Spin the network, follow the flows, and pressure-test the visual direction before the CMS arrives.",
    label: "Global Library Explorer",
    statsTitle: "Library Insights",
  },
  en: {
    brand: "libraries.global",
    currentLocation: "Poland",
    headline: "The World's Knowledge, Reimagined.",
    inputPlaceholder: "Search for a library, city, or country.",
    intro:
      "A prototype experience for a global library index. Spin the network, follow the flows, and pressure-test the visual direction before the CMS arrives.",
    label: "Global Library Explorer",
    statsTitle: "Library Insights",
  },
} satisfies Record<
  Locale,
  {
    brand: string
    currentLocation: string
    headline: string
    inputPlaceholder: string
    intro: string
    label: string
    statsTitle: string
  }
>

function CountryClusterMap() {
  const nodes = [
    { delay: "0ms", x: 64, y: 52 },
    { delay: "120ms", x: 101, y: 36 },
    { delay: "240ms", x: 149, y: 58 },
    { delay: "360ms", x: 86, y: 82 },
    { delay: "480ms", x: 120, y: 92 },
    { delay: "600ms", x: 154, y: 84 },
    { delay: "720ms", x: 74, y: 112 },
    { delay: "840ms", x: 116, y: 122 },
    { delay: "960ms", x: 146, y: 116 },
  ]

  return (
    <svg
      aria-hidden
      className="h-auto w-full"
      viewBox="0 0 220 170"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="country-fill" x1="52" x2="170" y1="28" y2="140">
          <stop offset="0" stopColor="#5D84FF" stopOpacity="0.48" />
          <stop offset="1" stopColor="#9ED6FF" stopOpacity="0.16" />
        </linearGradient>
      </defs>

      <path
        d="M66 28 110 18l40 12 14 28-6 34 9 22-18 28-42 12-35-16-18-22-25-9 8-31-9-25 17-16 33-5Z"
        fill="url(#country-fill)"
        stroke="rgba(148, 203, 255, 0.45)"
        strokeWidth="2"
      />

      {nodes.map((node) => (
        <circle
          key={`${node.x}-${node.y}`}
          className="animate-pulse"
          cx={node.x}
          cy={node.y}
          fill="#DFF6FF"
          r="5"
          style={{ animationDelay: node.delay, transformOrigin: "center" }}
        />
      ))}

      <path
        d="M64 52 101 36 149 58 154 84 116 122 74 112 64 52Z"
        fill="none"
        opacity="0.5"
        stroke="#B9E7FF"
        strokeWidth="1"
      />
    </svg>
  )
}

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

            <aside
              className="relative z-30 mt-[470px] ml-auto w-full max-w-[340px] rounded-[32px] border border-[#6a93dc] bg-[linear-gradient(180deg,rgba(29,44,68,0.86)_0%,rgba(11,19,34,0.84)_100%)] p-5 shadow-[0_28px_100px_rgba(10,24,48,0.44)] backdrop-blur-xl sm:mt-[520px] lg:absolute lg:top-[430px] lg:right-6 lg:mt-0"
              id="impact"
            >
              <h2 className="text-[1.85rem] leading-none font-semibold text-white">
                {copy.statsTitle}
              </h2>

              <div className="mt-6 space-y-5">
                {METRICS.map((metric) => (
                  <div key={metric.label}>
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm text-white/72">{metric.label}</p>
                      <ArrowUpRight
                        className="size-4 text-[#79e08a]"
                        strokeWidth={2}
                      />
                    </div>
                    <div className="mt-1 text-[2.1rem] leading-none font-semibold text-white">
                      {metric.value}
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#5e8cff_0%,#7dc8ff_100%)]"
                        style={{ width: metric.width }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="my-6 h-px bg-white/10" />

              <div className="grid gap-6">
                <div>
                  <p className="text-sm text-white/56">Current Location</p>
                  <p className="mt-1 text-[2rem] leading-none font-medium text-white">
                    {copy.currentLocation}
                  </p>
                </div>

                <div className="mx-auto w-[68%]">
                  <CountryClusterMap />
                </div>

                <div>
                  <p className="text-sm text-white/56">Total Libraries</p>
                  <p className="mt-1 text-3xl font-semibold text-white">
                    1,368
                  </p>
                  <p className="text-sm text-white/46">
                    Libraries indexed in this view
                  </p>
                </div>

                <div>
                  <p className="mb-3 text-sm text-white/56">Top Categories</p>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORY_TAGS.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-sm text-white/76"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
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
