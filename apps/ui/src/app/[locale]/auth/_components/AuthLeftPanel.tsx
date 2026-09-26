// apps/ui/src/app/[locale]/auth/_components/AuthLeftPanel.tsx
import { T } from "@/lib/design-tokens"

interface AuthLeftPanelProps {
  mode: "signin" | "register"
}

// Qualitative, honest value props — no invented numbers.
const PRINCIPLES = [
  { value: "Open", label: "CC-licensed records" },
  { value: "Community-run", label: "Peer-reviewed edits" },
  { value: "Independent", label: "No ads, no tracking" },
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
      : "Create a free account to propose library additions, correct entries, and help librarians and readers keep the world's index current."

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
            "radial-gradient(ellipse 70% 60% at 65% 40%, rgba(67,56,202,0.08), transparent 60%), radial-gradient(ellipse 50% 80% at 55% 50%, rgba(92,149,255,0.08), transparent 55%)",
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
          border: "1px solid rgba(67,56,202,0.08)",
          background:
            "radial-gradient(circle, rgba(67,56,202,0.08) 0%, transparent 70%)",
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
          border: "1px solid rgba(67,56,202,0.08)",
        }}
      />

      {/* Top eyebrow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontFamily: T.font.sans,
          fontSize: "13px",
          color: T.ink.faint,
        }}
      >
        <span
          style={{
            width: "28px",
            height: "2px",
            borderRadius: "2px",
            background: T.accent.primary,
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        Join the index
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col gap-8">
        {/* Headline */}
        <div>
          <h1
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(2.8rem, 5vw, 4.5rem)",
              fontWeight: 500,
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
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
            }}
          >
            {subtext}
          </p>
        </div>

        {/* Project principles — qualitative, no invented figures */}
        <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
          {PRINCIPLES.map((item) => (
            <div
              key={item.value}
              style={{ display: "flex", flexDirection: "column", gap: "2px" }}
            >
              <span
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "24px",
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: T.ink.base,
                  lineHeight: 1.1,
                }}
              >
                {item.value}
              </span>
              <span
                style={{
                  fontFamily: T.font.sans,
                  fontSize: "14px",
                  color: T.ink.dim,
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Editorial covenant — project copy, not an endorsement */}
        <div
          style={{
            borderLeft: `2px solid ${T.accent.primary}`,
            paddingLeft: "16px",
            maxWidth: "360px",
          }}
        >
          <p
            style={{
              fontFamily: T.font.serif,
              fontSize: "15px",
              lineHeight: "1.65",
              color: T.ink.dim,
              fontStyle: "italic",
              margin: "0 0 8px",
            }}
          >
            &ldquo;A name on an entry is a small act of trust between a
            librarian and a reader.&rdquo;
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              fontWeight: 600,
              color: T.ink.low,
            }}
          >
            Editorial covenant
          </p>
        </div>
      </div>

      {/* Bottom line */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          fontFamily: T.font.sans,
          fontSize: "13px",
          color: T.ink.low,
        }}
      >
        Independent and open source
      </div>
    </div>
  )
}
