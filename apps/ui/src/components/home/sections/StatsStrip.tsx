import { useTranslations as useUiTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import type { HomepageStats } from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"

/** Live proof the index is real, beneath the hero search. Community
 * counts are hidden while they're zero rather than shown as an empty boast. */
export function StatsStrip({
  stats,
}: {
  readonly stats: HomepageStats | null
}) {
  const tUi = useUiTranslations("ui")

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
      aria-label={tUi("the_index_so_far")}
      className="mt-6 border-t pt-5 sm:pt-6"
      style={{ borderColor: T.border.line }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p
          className="m-0 text-xs font-semibold tracking-[0.12em] uppercase"
          style={{ color: T.ink.dim }}
        >
          {tUi("the_index_so_far")}
        </p>
        <GlobalLink
          href="/knowledge/data-api/how-we-count"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-(--t-accent-primary) no-underline transition-colors hover:text-(--t-accent-primary-hover) hover:underline hover:underline-offset-4"
        >
          How we count
          <span aria-hidden="true">→</span>
        </GlobalLink>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-5 sm:auto-cols-fr sm:grid-flow-col sm:grid-cols-none">
        {cells.map((cell) => (
          <div key={cell.label} className="flex min-w-0 flex-col gap-2">
            <dt
              className="order-2 text-sm leading-5"
              style={{ color: T.ink.dim }}
            >
              {cell.label}
            </dt>
            <dd
              className="type-stat order-1 m-0"
              style={{
                color: T.ink.base,
              }}
            >
              {cell.value.toLocaleString("en-US")}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

StatsStrip.displayName = "StatsStrip"

export default StatsStrip
