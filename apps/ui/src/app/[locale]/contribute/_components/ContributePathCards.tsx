"use client"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { auroraCtaSm } from "@/lib/styles"

interface ContributePathCardsProps {
  isSignedIn: boolean
  isVerifiedLibrarian: boolean
}

type RoleBadge = "ANY ROLE" | "WIKI EDITOR" | "EDITORIAL BOARD"

interface PathCard {
  pathId: string
  role: RoleBadge
  heading: string
  headingItalic: string
  body: string
  meta: string
  href: string | null
  ctaLabel: string | null
  locked: boolean
}

const ROLE_BADGE_STYLES: Record<
  RoleBadge,
  { background: string; color: string }
> = {
  "ANY ROLE": {
    background: "rgba(127,223,255,0.12)",
    color: T.accent.aurora,
  },
  "WIKI EDITOR": {
    background: "rgba(163,144,255,0.12)",
    color: T.accent.violet,
  },
  "EDITORIAL BOARD": {
    background: "rgba(232,201,138,0.12)",
    color: T.accent.gold,
  },
}

const PATH_CARDS: PathCard[] = [
  {
    pathId: "PATH-01",
    role: "ANY ROLE",
    heading: "Add a ",
    headingItalic: "new library.",
    body: "Index a library that isn't on the atlas yet — from a public branch to a private monastic collection. Seven steps, autosaved as you go.",
    meta: "~12 MIN · 7 STEPS",
    href: "/contribute/add",
    ctaLabel: "begin →",
    locked: false,
  },
  {
    pathId: "PATH-02",
    role: "ANY ROLE",
    heading: "Edit an ",
    headingItalic: "existing library.",
    body: "Refine a record that already exists — opening links, photography, descriptions. Changes shown side-by-side for moderators.",
    meta: "~6 MIN · DIFF REVIEW",
    href: "/contribute/edit",
    ctaLabel: "find one →",
    locked: false,
  },
  {
    pathId: "PATH-03",
    role: "WIKI EDITOR",
    heading: "Edit the ",
    headingItalic: "project docs.",
    body: "Contributor guides, API references, design docs, code recipes. Block editor or Markdown — both export the same way.",
    meta: "~VARIES · MERGE REQUEST",
    href: "/contribute/wiki",
    ctaLabel: "open editor →",
    locked: true,
  },
  {
    pathId: "PATH-04",
    role: "EDITORIAL BOARD",
    heading: "Triage the ",
    headingItalic: "review queue.",
    body: "For editorial staff. 218 pending records await approval, with rejection or change-requests routed back to contributors — curated at your rate.",
    meta: "REQUIRES 1/N+1",
    href: null,
    ctaLabel: null,
    locked: true,
  },
]

export function ContributePathCards({
  isSignedIn: _isSignedIn,
  isVerifiedLibrarian: _isVerifiedLibrarian,
}: ContributePathCardsProps) {
  return (
    <section
      style={{ background: T.bg.void }}
      className="mx-auto w-full max-w-5xl px-6 py-14 md:px-10"
    >
      {/* Section heading */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "28px",
        }}
      >
        <h2
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: T.ink.base,
            margin: 0,
          }}
        >
          Choose a{" "}
          <em style={{ fontStyle: "italic", fontWeight: 400 }}>path.</em>
        </h2>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "8px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          Paths gated by your role · Verified Librarian
        </span>
      </div>

      {/* 2×2 grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "16px",
        }}
      >
        {PATH_CARDS.map((card) => {
          const badgeStyle = ROLE_BADGE_STYLES[card.role]

          return (
            <div
              key={card.pathId}
              style={{
                border: `1px solid ${T.border.line}`,
                borderRadius: "16px",
                padding: "28px",
                background: "rgba(255,255,255,0.02)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Top row: path id + role badge */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "8px",
                    letterSpacing: ".18em",
                    textTransform: "uppercase",
                    color: T.ink.faint,
                  }}
                >
                  {card.pathId}
                </span>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontFamily: T.font.mono,
                    fontSize: "7px",
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    background: badgeStyle.background,
                    color: badgeStyle.color,
                  }}
                >
                  {card.role}
                </span>
              </div>

              {/* Heading */}
              <h3
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                  color: T.ink.base,
                  margin: 0,
                }}
              >
                {card.heading}
                <em
                  style={{
                    fontStyle: "italic",
                    fontWeight: 400,
                    color: T.ink.dim,
                  }}
                >
                  {card.headingItalic}
                </em>
              </h3>

              {/* Body */}
              <p
                style={{
                  fontSize: "14px",
                  color: T.ink.dim,
                  lineHeight: "1.65",
                  margin: 0,
                  flexGrow: 1,
                }}
              >
                {card.body}
              </p>

              {/* Footer: CTA + meta */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "4px",
                }}
              >
                {card.locked || !card.href ? (
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "9px",
                      letterSpacing: ".14em",
                      textTransform: "uppercase",
                      color: T.ink.faint,
                      opacity: 0.5,
                    }}
                  >
                    locked
                  </span>
                ) : (
                  <Link href={card.href} className={auroraCtaSm}>
                    {card.ctaLabel}
                  </Link>
                )}

                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: T.ink.faint,
                  }}
                >
                  {card.meta}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
