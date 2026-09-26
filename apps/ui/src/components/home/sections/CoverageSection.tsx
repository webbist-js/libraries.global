import GlobalLink from "@/components/global/GlobalLink"
import type { HomepageContinentSummary } from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"

export function CoverageSection({
  continents,
}: {
  readonly continents: HomepageContinentSummary[]
}) {
  if (continents.length === 0) return null

  const max = Math.max(...continents.map((c) => c.libraryCount), 1)
  const sorted = [...continents].sort((a, b) => b.libraryCount - a.libraryCount)

  return (
    <section className="mx-auto grid w-full max-w-[1360px] grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-start gap-[clamp(24px,4vw,56px)] px-4 pt-[clamp(64px,8vw,104px)] sm:px-8">
      <div>
        <h2
          className="m-0"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            fontSize: "clamp(34px,4vw,50px)",
            letterSpacing: "-0.015em",
            color: T.ink.base,
          }}
        >
          Where the index reaches
        </h2>
        <p
          className="mt-3 max-w-[460px] text-[18px] leading-[1.6]"
          style={{ color: T.ink.dim }}
        >
          We&rsquo;ve only just started. Most of the world&rsquo;s libraries
          aren&rsquo;t documented here yet — and that&rsquo;s where you come in.
        </p>
        <GlobalLink
          href="/contribute"
          className="mt-5 inline-block rounded-full px-5 py-3 font-semibold text-white no-underline transition-colors hover:bg-[#2C2A48]"
          style={{ background: T.ink.base }}
        >
          Document a library near you
        </GlobalLink>
        <p className="mt-4 text-[14px]" style={{ color: T.ink.dim }}>
          Counts are published records only.
        </p>
      </div>

      <ul
        className="m-0 list-none overflow-hidden rounded-[24px] border bg-white p-0"
        style={{ borderColor: T.border.line }}
      >
        {sorted.map((continent, i) => {
          const n = continent.libraryCount
          const width = n > 0 ? `${Math.max((n / max) * 100, 4)}%` : "0%"

          return (
            <li
              key={continent.documentId}
              className="flex flex-wrap items-center gap-4 px-5 py-4"
              style={{
                borderTop: i > 0 ? `1px solid ${T.border.divider}` : undefined,
              }}
            >
              <GlobalLink
                href={`/${continent.slug}`}
                className="flex-[1_1_160px] text-[24px] no-underline hover:underline"
                style={{
                  fontFamily: T.font.serif,
                  fontWeight: 500,
                  color: T.ink.base,
                }}
              >
                {continent.name}
              </GlobalLink>
              <span
                aria-hidden="true"
                className="h-2.5 flex-[2_1_160px] overflow-hidden rounded-full"
                style={{ background: T.border.divider }}
              >
                <span
                  className="block h-full rounded-full"
                  style={{ width, background: T.accent.ok }}
                />
              </span>
              <span
                className="flex-[0_0_150px] text-right text-[15px]"
                style={{
                  color: n > 0 ? T.ink.base : T.ink.dim,
                  fontWeight: n > 0 ? 600 : 400,
                }}
              >
                {n > 0
                  ? `${n.toLocaleString("en-US")} published record${n === 1 ? "" : "s"}`
                  : "No records yet"}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

CoverageSection.displayName = "CoverageSection"

export default CoverageSection
