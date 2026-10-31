import { Globe, Library, SquarePen, Users } from "lucide-react"
import { useTranslations as useUiTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import type { HomepageStats } from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"

/** Live proof the index is real. Community
 * counts are hidden while they're zero rather than shown as an empty boast. */
export function StatsStrip({
  stats,
  appearance = "default",
}: {
  readonly stats: HomepageStats | null
  readonly appearance?: "default" | "hero"
}) {
  const tUi = useUiTranslations("ui")

  if (!stats) return null
  const hero = appearance === "hero"

  const cells = [
    {
      value: stats.libraries,
      label:
        stats.libraries === 1 ? "library published" : "libraries published",
      show: true,
      icon: Library,
    },
    {
      value: stats.countries,
      label: stats.countries === 1 ? "country" : "countries",
      show: true,
      icon: Globe,
    },
    {
      value: stats.contributors,
      label: stats.contributors === 1 ? "contributor" : "contributors",
      show: stats.contributors > 0,
      icon: Users,
    },
    {
      value: stats.contributionsThisMonth,
      label:
        stats.contributionsThisMonth === 1
          ? "change this month"
          : "changes this month",
      show: stats.contributionsThisMonth > 0,
      icon: SquarePen,
    },
  ].filter((cell) => cell.show)

  return (
    <section
      aria-label={tUi("the_index_so_far")}
      className={hero ? "home-hero-stats-strip" : "mt-6 border-t pt-5 sm:pt-6"}
      style={{ borderColor: T.border.line }}
    >
      <div
        className={
          hero
            ? "home-hero-stats-meta"
            : "mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
        }
      >
        <p
          className={
            hero
              ? "type-label m-0"
              : "m-0 text-xs font-semibold tracking-[0.12em] uppercase"
          }
          style={{ color: hero ? "var(--home-lavender)" : T.ink.dim }}
        >
          {tUi("the_index_so_far")}
        </p>
        {hero ? (
          <p className="home-hero-stats-intro">
            An open record, built together.
          </p>
        ) : null}
        <GlobalLink
          href="/knowledge/data-api/how-we-count"
          className={
            hero
              ? "home-hero-stats-method"
              : "inline-flex items-center gap-1.5 text-sm font-medium text-(--t-accent-primary) no-underline transition-colors hover:text-(--t-accent-primary-hover) hover:underline hover:underline-offset-4"
          }
        >
          How we count
        </GlobalLink>
      </div>
      <dl
        className={
          hero
            ? "home-hero-stats-values"
            : "m-0 grid grid-cols-2 gap-x-6 gap-y-5 sm:auto-cols-max sm:grid-flow-col sm:grid-cols-none sm:gap-x-10"
        }
      >
        {cells.map((cell) => {
          const Icon = cell.icon

          return (
            <div key={cell.label} className="flex min-w-0 flex-col gap-2">
              <dt
                className={
                  hero
                    ? "home-hero-stat-label order-2"
                    : "order-2 text-sm leading-5"
                }
                style={{ color: hero ? "var(--home-on-dark)" : T.ink.dim }}
              >
                {hero ? (
                  <Icon aria-hidden="true" size={18} strokeWidth={1.6} />
                ) : null}
                {cell.label}
              </dt>
              <dd
                className={
                  hero
                    ? "type-stat order-1 m-0 tabular-nums"
                    : "type-stat order-1 m-0"
                }
                style={{
                  color: hero ? "var(--t-ink-inverse)" : T.ink.base,
                }}
              >
                {cell.value.toLocaleString("en-US")}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}

StatsStrip.displayName = "StatsStrip"

export default StatsStrip
