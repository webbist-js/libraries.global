import { EARNED_PRO_ACTIVITY_DAYS, EARNED_PRO_POINTS } from "@repo/access"

import { POINTS_TABLE } from "@/lib/community/points"
import { T } from "@/lib/design-tokens"

const PREVIEW_COUNT = 4

/**
 * "How points work": what each approved contribution earns. A rail card for
 * the Community pages. Server-safe: no hooks.
 */
export function PointsTableCard() {
  const pointRows = POINTS_TABLE.map(([label, value]) => (
    <div
      key={label}
      className="flex justify-between gap-[10px] py-[9px] text-base"
      style={{ borderTop: `1px solid ${T.border.divider}` }}
    >
      <dt style={{ color: T.ink.base }}>{label}</dt>
      <dd
        className="m-0 shrink-0 font-bold tabular-nums"
        style={{ color: T.accent.primaryHover }}
      >
        +{value}
      </dd>
    </div>
  ))

  return (
    <section
      aria-labelledby="points-heading"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: 24,
        padding: "20px 22px",
      }}
    >
      <h2
        id="points-heading"
        className="type-h2 m-0 mb-[8px]"
        style={{
          color: T.ink.base,
        }}
      >
        How points work
      </h2>
      <div className="my-4 rounded-2xl bg-(--t-accent-chip) p-4 text-sm leading-relaxed text-(--t-ink-base)">
        <h3 className="type-small-heading m-0">
          Earn Pro through contributions
        </h3>
        <p className="mt-2 mb-0">
          With at least {EARNED_PRO_POINTS.toLocaleString("en-GB")} points, you
          get Pro for {EARNED_PRO_ACTIVITY_DAYS} days from your latest accepted
          contribution. Each accepted contribution restarts that window,
          including discussions, event feeds and option suggestions.
        </p>
        <p className="mt-2 mb-0">
          After {EARNED_PRO_ACTIVITY_DAYS} days without an accepted
          contribution, earned Pro expires. Another accepted contribution
          restores it if you still have at least{" "}
          {EARNED_PRO_POINTS.toLocaleString("en-GB")} points.
        </p>
      </div>
      <dl className="m-0">{pointRows.slice(0, PREVIEW_COUNT)}</dl>
      {pointRows.length > PREVIEW_COUNT && (
        <details className="group">
          <summary className="min-h-11 cursor-pointer rounded-lg py-3 text-sm font-semibold text-(--t-accent-primary) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary)">
            <span className="group-open:hidden">
              Show more ({pointRows.length - PREVIEW_COUNT})
            </span>
            <span className="hidden group-open:inline">Show less</span>
          </summary>
          <dl className="m-0">{pointRows.slice(PREVIEW_COUNT)}</dl>
        </details>
      )}
      <p
        className="m-0 mt-[10px] text-sm leading-normal"
        style={{ color: T.ink.dim }}
      >
        Daily streak and drive completion bonuses add points but don’t restart
        the Pro window.
      </p>
      <p
        className="m-0 mt-[10px] text-sm leading-normal"
        style={{ color: T.ink.dim }}
      >
        Rejected or reverted changes earn nothing. Staff verification doesn’t
        depend on points.
      </p>
    </section>
  )
}
