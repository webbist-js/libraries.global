import GlobalLink from "@/components/global/GlobalLink"
import Emphasis from "@/components/home/Emphasis"
import type {
  HomepageContinentSummary,
  SectionIntro,
} from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"

/** Segment shades for the per-country share bar (dark → light green). */
const BAR_SHADES = ["#2F5D3A", "#4C7A56", "#7FA886", "#A9C7AD", "#CBDCCB"]

export type CountryBreakdown = Record<string, { name: string; count: number }[]>

export function CoverageSection({
  intro,
  continents,
  countryBreakdown = {},
  totalCountriesByContinent = {},
}: {
  readonly intro: SectionIntro
  readonly continents: HomepageContinentSummary[]
  readonly countryBreakdown?: CountryBreakdown
  readonly totalCountriesByContinent?: Record<string, number>
}) {
  if (continents.length === 0) return null

  const withRecords = continents
    .filter((c) => c.libraryCount > 0)
    .sort((a, b) => b.libraryCount - a.libraryCount)
  const empty = continents.filter((c) => c.libraryCount === 0)

  return (
    <section
      aria-labelledby="coverage-title"
      className="mx-auto grid w-full max-w-[1360px] grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-center gap-[clamp(24px,4vw,56px)] px-4 pt-[clamp(64px,8vw,104px)] sm:px-8"
    >
      <div>
        <h2
          id="coverage-title"
          className="m-0 text-balance"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            fontSize: "clamp(34px,4vw,50px)",
            lineHeight: 1.08,
            letterSpacing: "-0.015em",
            color: T.ink.base,
          }}
        >
          <Emphasis
            text={intro.title ?? ""}
            emStyle={{ color: T.accent.primary }}
          />
        </h2>
        {intro.text ? (
          <p
            className="mt-3 max-w-[460px] text-[18px] leading-[1.6]"
            style={{ color: T.ink.dim }}
          >
            {intro.text}
          </p>
        ) : null}
        <GlobalLink
          href="/contribute/add"
          className="mt-6 inline-block rounded-full border bg-white px-5 py-3 font-semibold no-underline transition-colors hover:border-(--t-accent-primary)"
          style={{ borderColor: T.border.hi, color: T.ink.base }}
        >
          Add the first library in your country
        </GlobalLink>
      </div>

      <div className="flex flex-col gap-4">
        {withRecords.map((continent) => {
          const countries = countryBreakdown[continent.slug ?? ""] ?? []
          const total = continent.libraryCount
          const totalCountries =
            totalCountriesByContinent[continent.slug ?? ""] ?? null
          const moreCountries =
            totalCountries != null
              ? Math.max(totalCountries - countries.length, 0)
              : null

          return (
            <div
              key={continent.documentId}
              className="rounded-[20px] border bg-white p-5"
              style={{ borderColor: T.border.line }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <GlobalLink
                  href={`/${continent.slug}`}
                  className="text-[24px] no-underline hover:underline"
                  style={{
                    fontFamily: T.font.serif,
                    fontWeight: 500,
                    color: T.ink.base,
                  }}
                >
                  {continent.name} <span aria-hidden="true">→</span>
                </GlobalLink>
                <span
                  className="text-[15px] font-semibold"
                  style={{ color: T.ink.base }}
                >
                  {total.toLocaleString("en-US")} published record
                  {total === 1 ? "" : "s"}
                </span>
              </div>

              {/* Country-share bar */}
              <div
                aria-hidden="true"
                className="mt-3 flex h-2.5 gap-px overflow-hidden rounded-full"
                style={{ background: "#E6EFE6" }}
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

              <p
                className="m-0 mt-2.5 text-[14px]"
                style={{ color: T.ink.dim }}
              >
                {countries.map((country, i) => (
                  <span key={country.name}>
                    {i > 0 ? " · " : ""}
                    <span style={{ color: T.ink.base, fontWeight: 600 }}>
                      {country.name}
                    </span>{" "}
                    {country.count}
                  </span>
                ))}
                {moreCountries != null && moreCountries > 0 ? (
                  <span>
                    {countries.length > 0 ? " · " : ""}
                    {moreCountries.toLocaleString("en-US")} more{" "}
                    {moreCountries === 1 ? "country" : "countries"}: none yet
                  </span>
                ) : null}
              </p>
            </div>
          )
        })}

        {empty.length > 0 ? (
          <div
            className="rounded-[20px] border bg-white p-5"
            style={{ borderColor: T.border.line }}
          >
            <p
              className="m-0 mb-3 text-[15px] font-semibold"
              style={{ color: T.ink.base }}
            >
              Waiting for a first record
            </p>
            <div className="flex flex-wrap gap-2">
              {empty.map((continent) => (
                <GlobalLink
                  key={continent.documentId}
                  href={`/${continent.slug}`}
                  className="rounded-full border px-3.5 py-1.5 text-[14px] font-medium no-underline transition-colors hover:border-(--t-accent-primary)"
                  style={{ borderColor: T.border.hi, color: T.ink.base }}
                >
                  {continent.name}{" "}
                  <span aria-hidden="true" style={{ color: T.ink.low }}>
                    +
                  </span>
                </GlobalLink>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

CoverageSection.displayName = "CoverageSection"

export default CoverageSection
