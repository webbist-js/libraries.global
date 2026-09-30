import GlobalLink from "@/components/global/GlobalLink"
import type { HomepageStats } from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"

/** Live proof the index is real, in one line under the hero. Community
 * counts are hidden while they're zero rather than shown as an empty boast. */
export function StatsStrip({
  stats,
}: {
  readonly stats: HomepageStats | null
}) {
  if (!stats) return null

  const cells = [
    {
      value: stats.libraries,
      label:
        stats.libraries === 1 ? "library published" : "libraries published",
      show: true,
    },
    {
      value: stats.countries,
      label: stats.countries === 1 ? "country" : "countries",
      show: true,
    },
    {
      value: stats.contributors,
      label: stats.contributors === 1 ? "contributor" : "contributors",
      show: stats.contributors > 0,
    },
    {
      value: stats.contributionsThisMonth,
      label:
        stats.contributionsThisMonth === 1
          ? "change this month"
          : "changes this month",
      show: stats.contributionsThisMonth > 0,
    },
  ].filter((cell) => cell.show)

  return (
    <section
      aria-label="The index so far"
      className="border-b bg-white"
      style={{ borderColor: T.border.line }}
    >
      <div className="mx-auto flex w-full max-w-[1360px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-4 sm:px-8">
        <dl className="m-0 flex flex-wrap items-baseline gap-x-8 gap-y-2">
          {cells.map((cell) => (
            <div
              key={cell.label}
              className="flex flex-row-reverse items-baseline gap-2"
            >
              <dt className="text-[15px]" style={{ color: T.ink.dim }}>
                {cell.label}
              </dt>
              <dd
                className="m-0"
                style={{
                  fontFamily: T.font.serif,
                  fontWeight: 500,
                  fontSize: "28px",
                  lineHeight: 1,
                  color: T.ink.base,
                }}
              >
                {cell.value.toLocaleString("en-US")}
              </dd>
            </div>
          ))}
        </dl>
        <GlobalLink
          href="/knowledge/data-api/how-we-count"
          className="text-[15px] font-semibold underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
        >
          How we count
        </GlobalLink>
      </div>
    </section>
  )
}

StatsStrip.displayName = "StatsStrip"

export default StatsStrip
