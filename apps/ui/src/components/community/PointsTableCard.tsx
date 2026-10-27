import { POINTS_TABLE } from "@/lib/community/points"
import { T } from "@/lib/design-tokens"

/**
 * "How points work": what each approved contribution earns. A rail card for
 * the Community pages. Server-safe: no hooks.
 */
export function PointsTableCard() {
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
      <dl className="m-0">
        {POINTS_TABLE.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between gap-[10px] py-[9px] text-base"
            style={{ borderTop: `1px solid ${T.border.divider}` }}
          >
            <dt style={{ color: T.ink.base }}>{label}</dt>
            <dd
              className="m-0 font-bold"
              style={{ color: T.accent.primaryHover }}
            >
              +{value}
            </dd>
          </div>
        ))}
      </dl>
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
