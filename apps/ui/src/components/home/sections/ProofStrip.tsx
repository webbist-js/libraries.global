import type { CSSProperties } from "react"

import type {
  Citation,
  HomepageStats,
  SectionIntro,
} from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"

function formatCount(n: number): string {
  return n.toLocaleString("en-US")
}

/** Live community proof: "this is our dataset", in four numbers. Community
 * counts are hidden while they're zero rather than shown as an empty boast. */
export function ProofStrip({
  intro,
  definition,
  stats,
}: {
  readonly intro: SectionIntro
  readonly definition: Citation
  readonly stats: HomepageStats | null
}) {
  const cells = stats
    ? [
        {
          value: stats.libraries,
          label:
            stats.libraries === 1
              ? "Library documented"
              : "Libraries documented",
          show: true,
        },
        {
          value: stats.countries,
          label: stats.countries === 1 ? "Country" : "Countries",
          show: true,
        },
        {
          value: stats.contributors,
          label: stats.contributors === 1 ? "Contributor" : "Contributors",
          show: stats.contributors > 0,
        },
        {
          value: stats.contributionsThisMonth,
          label:
            stats.contributionsThisMonth === 1
              ? "Contribution this month"
              : "Contributions this month",
          show: stats.contributionsThisMonth > 0,
        },
      ].filter((cell) => cell.show)
    : []

  return (
    <section
      aria-labelledby="proof-title"
      className="border-b bg-white"
      style={{ borderColor: T.border.line }}
    >
      <div className="mx-auto grid w-full max-w-[1360px] items-center gap-8 px-4 py-[clamp(28px,4vw,44px)] sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div>
          <h2
            id="proof-title"
            className="m-0 text-balance"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              fontSize: "clamp(26px,2.6vw,34px)",
              lineHeight: 1.15,
              color: T.ink.base,
            }}
          >
            {intro.title}
          </h2>
          {intro.text ? (
            <p
              className="mt-2 max-w-[520px] text-[16px] leading-[1.6]"
              style={{ color: T.ink.dim }}
            >
              {intro.text}
            </p>
          ) : null}
          {definition.quote ? (
            <figure
              className="m-0 mt-4 max-w-[540px] border-l-[3px] py-0.5 pl-4"
              style={{ borderColor: T.accent.primary }}
            >
              {definition.lead ? (
                <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
                  {definition.lead}
                </p>
              ) : null}
              <blockquote
                cite={definition.sourceUrl ?? undefined}
                className="m-0 mt-1 text-[20px] leading-[1.35] italic"
                style={{ fontFamily: T.font.serif, color: T.ink.base }}
              >
                “{definition.quote}”
              </blockquote>
              {definition.attribution ? (
                <figcaption
                  className="mt-1.5 text-[14px]"
                  style={{ color: T.ink.dim }}
                >
                  — {definition.attribution}
                  {definition.sourceLabel && definition.sourceUrl ? (
                    <>
                      ,{" "}
                      <a
                        href={definition.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-[3px]"
                        style={{ color: T.accent.primary }}
                      >
                        <cite className="not-italic">
                          {definition.sourceLabel}
                        </cite>
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </>
                  ) : null}
                </figcaption>
              ) : null}
            </figure>
          ) : null}
        </div>

        {cells.length > 0 ? (
          <dl
            className="m-0 grid [grid-template-columns:repeat(var(--proof-cols-sm),minmax(0,1fr))] gap-3 sm:[grid-template-columns:repeat(var(--proof-cols),minmax(0,1fr))]"
            style={
              {
                // No orphaned cell: 4 → 2×2 on phones, otherwise one row
                "--proof-cols-sm": cells.length === 4 ? 2 : cells.length,
                "--proof-cols": cells.length,
              } as CSSProperties
            }
          >
            {cells.map((cell) => (
              <div
                key={cell.label}
                className="flex flex-col-reverse justify-end gap-1 rounded-[18px] border p-4"
                style={{ borderColor: T.border.line, background: T.bg.surface }}
              >
                <dt
                  className="text-[14px] leading-[1.35]"
                  style={{ color: T.ink.dim }}
                >
                  {cell.label}
                </dt>
                <dd
                  className="m-0"
                  style={{
                    fontFamily: T.font.serif,
                    fontWeight: 500,
                    fontSize: "clamp(30px,3vw,40px)",
                    lineHeight: 1,
                    color: T.ink.base,
                  }}
                >
                  {formatCount(cell.value)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  )
}

ProofStrip.displayName = "ProofStrip"

export default ProofStrip
