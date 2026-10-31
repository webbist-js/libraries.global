import type { ReactNode } from "react"

export type RecordMetric = {
  label: string
  value: ReactNode
  note?: ReactNode
  href?: string
  /** Recorded parts, not a claim about total real-world coverage. */
  segments?: readonly boolean[]
}

export function RecordMetrics({
  items,
}: {
  readonly items: readonly RecordMetric[]
}) {
  return (
    <div
      className="record-metrics"
      style={
        {
          "--record-metric-columns": Math.min(items.length, 4),
        } as React.CSSProperties
      }
    >
      {items.map((item) => {
        const content = (
          <>
            <span className="record-metric-label">{item.label}</span>
            <strong className="type-feature-title record-metric-value">
              {item.value}
            </strong>
            {item.segments?.length ? (
              <span className="record-meter" aria-hidden="true">
                {item.segments.map((done, index) => (
                  // eslint-disable-next-line react/no-array-index-key -- Meter slots represent fixed ordinal positions and never reorder.
                  <i key={index} data-recorded={done} />
                ))}
              </span>
            ) : null}
            {item.note ? (
              <span className="record-metric-note">{item.note}</span>
            ) : null}
          </>
        )

        return item.href ? (
          <a key={item.label} className="record-metric" href={item.href}>
            {content}
          </a>
        ) : (
          <div key={item.label} className="record-metric">
            {content}
          </div>
        )
      })}
    </div>
  )
}
