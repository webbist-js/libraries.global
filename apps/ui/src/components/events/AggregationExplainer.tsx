import { T } from "@/lib/design-tokens"

const STEPS = [
  {
    label: "Crawl",
    body: "Provider adapters poll each source every 30 minutes and accept webhooks where available. A normalised mapping is performed to achieve a uniform event structure. The most authoritative provider wins for duplicate detection.",
  },
  {
    label: "Parse",
    body: "Same-event detection over time (venue, start, title with fuzzy matching at a 0.85 threshold). The most authoritative provider wins. All events display their original provider source.",
  },
  {
    label: "Score",
    body: "Submit to a filtered list by title, library, or category. To submit via MQ, filter by city, library, or category. All data via API at api.libraries.global with full provenance.",
  },
]

export function AggregationExplainer() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-(--t-border-line) bg-(--t-bg-deep) px-8 py-10 shadow-[0_32px_80px_rgba(0,0,0,0.15)] sm:px-12 sm:py-12">
      {/* Gradient overlays matching LocationContributeCTA */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_120%_at_-8%_50%,rgba(127,223,255,0.07),transparent_58%),radial-gradient(ellipse_65%_90%_at_108%_50%,rgba(163,148,255,0.13),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(90,150,90,0.04)_0%,transparent_38%,rgba(163,144,255,0.06)_100%)]" />

      <div className="relative">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
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
              fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
              fontWeight: 400,
              letterSpacing: "-.025em",
              color: T.ink.base,
              margin: 0,
            }}
          >
            How we{" "}
            <em
              style={{ fontStyle: "italic", color: T.ink.dim, fontWeight: 300 }}
            >
              aggregate.
            </em>
          </h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.label}>
              <div className="mb-3 flex items-center gap-3">
                <span
                  style={{
                    fontFamily: T.font.serif,
                    fontSize: "2rem",
                    lineHeight: 1,
                    color: "rgba(127,223,255,0.18)",
                    fontWeight: 400,
                    letterSpacing: "-.03em",
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
                style={{
                  fontSize: "14px",
                  lineHeight: 1.65,
                  color: T.ink.faint,
                  margin: 0,
                }}
              >
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
