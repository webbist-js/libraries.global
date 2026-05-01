// apps/ui/src/app/[locale]/auth/_components/AuthLeftPanel.tsx
import { T } from "@/lib/design-tokens"

interface AuthLeftPanelProps {
  mode: "signin" | "register"
}

const STATS = [
  { value: "412,938", label: "Libraries Indexed" },
  { value: "197", label: "Countries" },
  { value: "4,218", label: "Contributions" },
]

export function AuthLeftPanel({ mode }: AuthLeftPanelProps) {
  const heading =
    mode === "signin" ? (
      <>
        Every library,{" "}
        <span
          style={{
            fontFamily: T.font.serif,
            fontStyle: "italic",
            fontWeight: 400,
          }}
        >
          on
        </span>
        <br />
        <span
          style={{
            fontFamily: T.font.serif,
            fontStyle: "italic",
            fontWeight: 400,
          }}
        >
          every continent.
        </span>
      </>
    ) : (
      <>
        Help index{" "}
        <span
          style={{
            fontFamily: T.font.serif,
            fontStyle: "italic",
            fontWeight: 400,
          }}
        >
          the
        </span>
        <br />
        <span style={{ fontWeight: 700 }}>world&apos;s</span>{" "}
        <span
          style={{
            fontFamily: T.font.serif,
            fontStyle: "italic",
            fontWeight: 400,
          }}
        >
          libraries.
        </span>
      </>
    )

  const subtext =
    mode === "signin"
      ? "Sign in to contribute additions, propose edits, and follow the librarians and regions you care about."
      : "Create a free account to propose library additions, correct entries, and help the project's 4,200 librarians keep the world's index current."

  return (
    <div
      className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex"
      style={{ width: "52%", background: "var(--t-bg-void)" }}
    >
      {/* Radial globe glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 65% 40%, rgba(127,223,255,0.06), transparent 60%), radial-gradient(ellipse 50% 80% at 55% 50%, rgba(92,149,255,0.08), transparent 55%)",
        }}
      />
      {/* Globe circle suggestion */}
      <div
        className="pointer-events-none absolute"
        style={{
          right: "-120px",
          top: "50%",
          transform: "translateY(-50%)",
          width: "520px",
          height: "520px",
          borderRadius: "50%",
          border: "1px solid rgba(127,223,255,0.08)",
          background:
            "radial-gradient(circle, rgba(127,223,255,0.04) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute"
        style={{
          right: "-60px",
          top: "50%",
          transform: "translateY(-50%)",
          width: "380px",
          height: "380px",
          borderRadius: "50%",
          border: "1px solid rgba(127,223,255,0.05)",
        }}
      />

      {/* Top eyebrow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".2em",
          textTransform: "uppercase",
          color: T.ink.faint,
        }}
      >
        <span
          style={{
            width: "28px",
            height: "1px",
            background: T.accent.aurora,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        § Join the Index
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col gap-8">
        {/* Headline */}
        <div>
          <h1
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(2.8rem, 5vw, 4.5rem)",
              fontWeight: 700,
              lineHeight: 0.92,
              letterSpacing: "-0.03em",
              color: T.ink.base,
              margin: 0,
            }}
          >
            {heading}
          </h1>
          <p
            style={{
              marginTop: "20px",
              fontSize: "15px",
              lineHeight: "1.65",
              color: T.ink.dim,
              maxWidth: "42ch",
              fontWeight: 300,
            }}
          >
            {subtext}
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "32px" }}>
          {STATS.map((stat) => (
            <div
              key={stat.label}
              style={{ display: "flex", flexDirection: "column", gap: "2px" }}
            >
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
                  fontSize: "9px",
                  letterSpacing: ".18em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                }}
              >
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Testimonial */}
        <div
          style={{
            border: `1px solid ${T.border.line}`,
            borderRadius: "16px",
            padding: "20px 22px",
            background: T.bg.surface,
            maxWidth: "360px",
          }}
        >
          <p
            style={{
              fontSize: "13.5px",
              lineHeight: "1.65",
              color: T.ink.dim,
              fontStyle: "italic",
              margin: "0 0 14px",
              fontWeight: 300,
            }}
          >
            &ldquo;An atlas of every reading-room on the planet — open,
            peer-edited, and finally indexed in one place.&rdquo;
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "50%",
                background: "rgba(127,223,255,0.15)",
                border: `1px solid ${T.border.line}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: T.font.mono,
                fontSize: "11px",
                color: T.accent.aurora,
                flexShrink: 0,
              }}
            >
              AR
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: T.ink.base,
                  fontWeight: 500,
                }}
              >
                Amélie Rault
              </p>
              <p
                style={{
                  margin: 0,
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                }}
              >
                Bibliothèque nationale de France · Verified librarian
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom decoration */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".12em",
          color: T.ink.ghost,
        }}
      >
        01 — 00
      </div>
    </div>
  )
}
