import { Breadcrumb, ContributeHeroShell } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

interface ContributeStats {
  libraryCount: number
  myPending?: number
  myApproved?: number
  myTotal?: number
}

interface ContributeHeroSectionProps {
  stats: ContributeStats
  isSignedIn: boolean
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`

  return String(n)
}

export function ContributeHeroSection({
  stats,
  isSignedIn,
}: ContributeHeroSectionProps) {
  const statCells = isSignedIn
    ? [
        {
          label: "Libraries Indexed",
          value: fmt(stats.libraryCount),
          sub: "Across 6+ continents",
        },
        {
          label: "My Submissions",
          value: String(stats.myTotal ?? 0),
          sub: "Total contributions",
        },
        {
          label: "Under Review",
          value: String(stats.myPending ?? 0),
          sub: "Awaiting editorial review",
        },
        {
          label: "Accepted",
          value: String(stats.myApproved ?? 0),
          sub: "Approved & published",
        },
      ]
    : [
        {
          label: "Libraries Indexed",
          value: fmt(stats.libraryCount),
          sub: "Across 6+ continents",
        },
        {
          label: "Reviewed",
          value: "by editors",
          sub: "Every change is verified",
        },
        {
          label: "Types",
          value: "14",
          sub: "National to mobile",
        },
        {
          label: "Open Source",
          value: "forever",
          sub: "CC-BY licensed data",
        },
      ]

  return (
    <ContributeHeroShell
      minHeight="520px"
      overlay="radial-gradient(ellipse 60% 80% at 70% 30%, var(--t-aurora-soft) 0%, transparent 55%), linear-gradient(to bottom, transparent 0%, var(--t-bg-space) 100%)"
    >
      {/* Breadcrumb */}
      <div style={{ marginBottom: "20px" }}>
        <Breadcrumb
          items={[{ label: "Home", href: "/" }, { label: "Contribute" }]}
        />
      </div>

      {/* Eyebrow */}
      <p
        style={{
          fontFamily: T.font.mono,
          fontSize: "9px",
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: T.accent.aurora,
          opacity: 0.75,
          margin: "0 0 18px",
        }}
      >
        § The Contribution Plan · V.4 · April 2026
      </p>

      {/* H1 */}
      <h1
        style={{
          fontFamily: T.font.serif,
          fontSize: "clamp(3.2rem, 7vw, 6rem)",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 0.92,
          color: T.ink.base,
          margin: "0 0 24px",
        }}
      >
        Help us index the world&apos;s
        <br />
        <em
          style={{
            fontStyle: "italic",
            fontWeight: 400,
            color: T.ink.dim,
          }}
        >
          reading rooms.
        </em>
      </h1>

      {/* Body */}
      <p
        style={{
          fontSize: "15px",
          color: T.ink.dim,
          maxWidth: "52ch",
          lineHeight: "1.72",
          margin: "0 0 40px",
        }}
      >
        Every entry in the atlas comes from somebody who walked in, read up, or
        works there. Add a library, refine an existing one, edit a docs page —
        every change is reviewed by editorial staff before it lands on the
        public map.
      </p>

      {/* CTA row */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "36px",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/contribute/add"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 22px",
            borderRadius: "8px",
            border: "1px solid var(--t-aurora-edge)",
            background: "var(--t-aurora-soft)",
            color: T.accent.aurora,
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".16em",
            textTransform: "uppercase",
            textDecoration: "none",
            transition: "background .15s",
          }}
        >
          Add a library →
        </Link>
        <Link
          href="/contribute/submissions"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 22px",
            borderRadius: "8px",
            border: `1px solid ${T.border.hi}`,
            background: T.bg.surface,
            color: T.ink.dim,
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".16em",
            textTransform: "uppercase",
            textDecoration: "none",
            transition: "background .15s",
          }}
        >
          My submissions →
        </Link>
      </div>

      {/* Stats panel */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          border: `1px solid ${T.border.line}`,
          borderRadius: "14px",
          overflow: "hidden",
          background: T.bg.deep,
          backdropFilter: "blur(8px)",
        }}
      >
        {statCells.map((stat, i) => (
          <div
            key={stat.label}
            style={{
              padding: "20px 22px 18px",
              borderRight:
                i < statCells.length - 1
                  ? `1px solid ${T.border.line}`
                  : undefined,
              display: "flex",
              flexDirection: "column",
              gap: "4px",
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
                fontSize: "32px",
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
                fontFamily: T.font.sans,
                fontSize: "11px",
                color: T.ink.low,
                marginTop: "2px",
              }}
            >
              {stat.sub}
            </span>
          </div>
        ))}
      </div>
    </ContributeHeroShell>
  )
}
