import GlobalLink from "@/components/global/GlobalLink"
import { SECTION_RULE } from "@/components/home/homepage.constants"
import type {
  HomepageContinentSummary,
  SectionIntro,
} from "@/components/home/homepage.types"
import SectionHeader from "@/components/home/sections/SectionHeader"
import { T, TYPE_TINT } from "@/lib/design-tokens"

/** Segment shades for the per-country share bar (dark → light green). */
const BAR_SHADES = ["#2F5D3A", "#6D9A76", "#A9C8AE", "#CBDCCB"]

export type CountryBreakdown = Record<string, { name: string; count: number }[]>

const NAME_STYLE = {
  fontFamily: T.font.serif,
  fontWeight: 500,
  fontSize: "clamp(32px,3.4vw,48px)",
  lineHeight: 1,
  letterSpacing: "-0.015em",
} as const

/** How far the index has got: a row per continent with published records
 * (its countries' shares and the count), then the continents still waiting
 * for a first record. Counts are published records only. */
export function CoverageSection({
  intro,
  continents,
  countryBreakdown = {},
}: {
  readonly intro: SectionIntro
  readonly continents: HomepageContinentSummary[]
  readonly countryBreakdown?: CountryBreakdown
}) {
  if (continents.length === 0) return null

  const withRecords = continents
    .filter((c) => c.libraryCount > 0)
    .sort((a, b) => b.libraryCount - a.libraryCount)
  const empty = continents.filter((c) => c.libraryCount === 0)
  const row =
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-4 border-b py-7 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)_auto] md:gap-x-10"

  return (
    <section
      aria-labelledby="coverage-title"
      className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(80px,10vw,140px)] sm:px-8"
    >
      <SectionHeader id="coverage-title" intro={intro} textBeside />

      <div className="border-t-2" style={{ borderColor: SECTION_RULE }}>
        {withRecords.map((continent) => {
          const countries = countryBreakdown[continent.slug ?? ""] ?? []
          const total = continent.libraryCount

          return (
            <div
              key={continent.documentId}
              className={row}
              style={{ borderColor: T.border.line }}
            >
              <GlobalLink
                href={`/${continent.slug}`}
                className="no-underline hover:underline"
                style={{ ...NAME_STYLE, color: T.ink.base }}
              >
                {continent.name}
              </GlobalLink>

              <div className="col-span-2 row-start-2 md:col-span-1 md:col-start-2 md:row-start-1">
                <div
                  aria-hidden="true"
                  className="flex h-3.5 gap-px overflow-hidden rounded-full"
                  style={{ background: T.border.divider }}
                >
                  {countries.map((country, i) => (
                    <span
                      key={country.name}
                      className="block h-full"
                      style={{
                        width: `${(country.count / total) * 100}%`,
                        background:
                          BAR_SHADES[Math.min(i, BAR_SHADES.length - 1)],
                      }}
                    />
                  ))}
                </div>
                {countries.length > 0 ? (
                  <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[14px]">
                    {countries.map((country) => (
                      <li key={country.name} style={{ color: T.ink.dim }}>
                        <span
                          className="font-semibold"
                          style={{ color: T.ink.base }}
                        >
                          {country.name}
                        </span>{" "}
                        {country.count.toLocaleString("en-US")}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <p
                className="m-0 text-right"
                style={{
                  fontFamily: T.font.serif,
                  fontWeight: 500,
                  fontSize: "clamp(44px,4.6vw,66px)",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  color: TYPE_TINT.public.fg,
                }}
              >
                {total.toLocaleString("en-US")}
                <span className="sr-only">
                  {" "}
                  published {total === 1 ? "record" : "records"}
                </span>
              </p>
            </div>
          )
        })}

        {empty.length > 0 ? (
          <div className={row} style={{ borderColor: T.border.line }}>
            <p className="m-0" style={{ ...NAME_STYLE, color: T.ink.dim }}>
              Waiting
            </p>
            <ul className="col-span-2 row-start-2 m-0 flex list-none flex-wrap gap-2 p-0 md:col-span-1 md:col-start-2 md:row-start-1">
              {empty.map((continent) => (
                <li key={continent.documentId}>
                  <GlobalLink
                    href={`/${continent.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-4 py-2 text-[15px] font-semibold no-underline transition-colors hover:border-(--t-accent-primary)"
                    style={{ borderColor: T.border.hi, color: T.ink.base }}
                  >
                    {continent.name}
                    <span
                      aria-hidden="true"
                      style={{ color: T.accent.primary }}
                    >
                      +
                    </span>
                  </GlobalLink>
                </li>
              ))}
            </ul>
            <GlobalLink
              href="/contribute/index/new"
              className="text-right text-[15px] font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              Add the first library in your country
            </GlobalLink>
          </div>
        ) : null}
      </div>
    </section>
  )
}

CoverageSection.displayName = "CoverageSection"

export default CoverageSection
