import type { SupporterCosts } from "@repo/shared-data"

import { T } from "@/lib/design-tokens"

export function RunningCosts({
  costs,
  locale,
}: {
  readonly costs: SupporterCosts | null
  readonly locale: string
}) {
  if (!costs) return null
  const month = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(costs.month))
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: costs.currency,
    maximumFractionDigits: 2,
  })
  const covered =
    costs.supportIncome == null || costs.runningCosts === 0
      ? null
      : Math.round((costs.supportIncome / costs.runningCosts) * 100)
  const currentMonth =
    new Date().toISOString().slice(0, 7) === costs.month.slice(0, 7)

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold">
        <span>
          {currentMonth
            ? "This month’s running costs"
            : `Running costs · ${month}`}
        </span>
        <span style={{ color: covered != null ? T.accent.ok : T.ink.base }}>
          {covered != null
            ? `${covered}% covered`
            : money.format(costs.runningCosts)}
        </span>
      </div>
      {covered != null ? (
        <progress
          aria-label={`Running costs covered for ${month}`}
          value={Math.min(100, covered)}
          max={100}
          className="mt-2 block h-2.5 w-full appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:bg-(--t-accent-ok) [&::-webkit-progress-bar]:bg-(--t-bg-muted) [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-(--t-accent-ok)"
        />
      ) : null}
      {costs.breakdown ? (
        <details className="group mt-2 text-sm">
          <summary
            className="cursor-pointer list-none font-semibold underline underline-offset-2 [&::-webkit-details-marker]:hidden"
            style={{ color: T.accent.primary }}
          >
            Where the money goes
          </summary>
          <p className="mt-2 mb-0" style={{ color: T.ink.dim }}>
            {money.format(costs.runningCosts)} in costs
            {costs.supportIncome != null
              ? ` · ${money.format(costs.supportIncome)} in support`
              : ""}{" "}
            · {month}
          </p>
          <p
            className="mt-2 mb-0 leading-relaxed whitespace-pre-line"
            style={{ color: T.ink.dim }}
          >
            {costs.breakdown}
          </p>
        </details>
      ) : null}
    </div>
  )
}
