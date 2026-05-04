import { T } from "@/lib/design-tokens"

const STEPS = [
  {
    label: "Crawl",
    icon: "→",
    body: "Provider adapters poll each source every 30 minutes and accept webhooks where available. A normalised mapping is performed to achieve a uniform event structure. The most authoritative provider wins for duplicate detection.",
  },
  {
    label: "Parse",
    icon: "→",
    body: "Same-event detection over time (venue, start, title with fuzzy matching at a 0.85 threshold). The most authoritative provider wins. All events display their original provider source.",
  },
  {
    label: "Score",
    icon: null,
    body: "Submit to a filtered list by title, library, or category. To submit via MQ, filter by city, library, or category. All data via API at api.libraries.global with full provenance.",
  },
]

export function AggregationExplainer() {
  return (
    <div
      className="rounded-3xl border border-(--t-border-line) p-8 sm:p-10"
      style={{ background: T.bg.deep }}
    >
      {/* Header */}
      <div className="mb-8 flex items-center gap-2">
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          § 06 ·
        </span>
        <h2
          style={{
            fontFamily: T.font.serif,
            fontSize: "1.4rem",
            fontWeight: 400,
            color: T.ink.base,
          }}
        >
          How we{" "}
          <em style={{ fontStyle: "italic", color: T.ink.dim }}>aggregate.</em>
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <div key={step.label} className="relative">
            {/* Step number */}
            <div className="mb-3 flex items-center gap-3">
              <span
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "2rem",
                  lineHeight: 1,
                  color: "rgba(127,223,255,0.2)",
                  fontWeight: 400,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".22em",
                  textTransform: "uppercase",
                  color: T.ink.low,
                }}
              >
                {step.label}
              </span>
            </div>
            <p
              className="text-sm leading-relaxed"
              style={{ color: T.ink.faint }}
            >
              {step.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
