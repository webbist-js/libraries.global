import DotHeroCanvas from "@/components/ui/DotHeroCanvas"
import { T } from "@/lib/design-tokens"

const STATS = [
  { label: "Libraries Indexed", value: "147,392", sub: "Across 6+ continents" },
  { label: "Pending Review", value: "218", sub: "Avg. wait: 3 days" },
  { label: "Open Contributors", value: "9,840", sub: "Last 30 days" },
  { label: "Acceptance Rate", value: "96.2%", sub: "Verified contributors" },
]

export function ContributeHeroSection() {
  return (
    <section
      data-transparent-header=""
      className="relative -mt-14 overflow-hidden"
      style={{ minHeight: "480px", borderBottom: `1px solid ${T.border.line}` }}
    >
      <DotHeroCanvas />

      {/* Overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 100% at 30% 60%, rgba(127,223,255,0.06) 0%, transparent 60%), linear-gradient(to bottom, rgba(3,5,17,0) 0%, rgba(3,5,17,0.8) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 pt-36 pb-12 md:px-10">
        {/* Eyebrow */}
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: T.accent.aurora,
            opacity: 0.8,
            margin: "0 0 14px",
          }}
        >
          § The Contribution Plan · V.4 · April 2026
        </p>

        {/* H1 */}
        <h1
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(2.8rem, 6vw, 5rem)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 0.95,
            color: T.ink.base,
            margin: "0 0 20px",
          }}
        >
          Help us index the world&apos;s{" "}
          <em
            style={{ fontStyle: "italic", fontWeight: 400, color: T.ink.dim }}
          >
            reading rooms.
          </em>
        </h1>

        {/* Body */}
        <p
          style={{
            fontSize: "15px",
            color: T.ink.dim,
            maxWidth: "54ch",
            lineHeight: "1.7",
            margin: "0 0 36px",
          }}
        >
          Every entry in the atlas comes from somebody who walked in, read up,
          or works there. Add a library, refine an existing one, edit a docs
          page — every change is reviewed by editorial staff before it lands on
          the public map.
        </p>

        {/* Stats grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "1px",
            border: `1px solid ${T.border.line}`,
            borderRadius: "12px",
            overflow: "hidden",
            background: T.border.line,
            maxWidth: "680px",
          }}
        >
          {STATS.map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: "16px 18px",
                background: "rgba(255,255,255,0.02)",
                display: "flex",
                flexDirection: "column",
                gap: "3px",
              }}
            >
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "7px",
                  letterSpacing: ".2em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                }}
              >
                {stat.label}
              </span>
              <span
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "28px",
                  fontWeight: 400,
                  letterSpacing: "-0.03em",
                  color: T.ink.base,
                  lineHeight: 1,
                }}
              >
                {stat.value}
              </span>
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "8px",
                  color: T.ink.faint,
                }}
              >
                {stat.sub}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
