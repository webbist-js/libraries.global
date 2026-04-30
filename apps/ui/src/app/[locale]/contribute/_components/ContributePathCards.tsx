"use client"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

interface ContributePathCardsProps {
  isSignedIn: boolean
  isVerifiedLibrarian: boolean
}

type RoleBadge = "ANY ROLE" | "WIKI EDITOR" | "EDITORIAL BOARD"
type RequiredRole = "any" | "wikiEditor" | "editorialBoard"

interface PathCard {
  pathId: string
  role: RoleBadge
  accentColor: string
  cardGlow: string
  heading: string
  headingItalic: string
  body: string
  meta: string
  lockedMeta: string
  href: string | null
  ctaLabel: string
  requiresRole: RequiredRole
}

const PATH_CARDS: PathCard[] = [
  {
    pathId: "PATH·01",
    role: "ANY ROLE",
    accentColor: T.accent.aurora,
    cardGlow:
      "radial-gradient(ellipse 55% 65% at 5% 90%, rgba(127,223,255,0.09) 0%, transparent 65%)",
    heading: "Add a ",
    headingItalic: "new library.",
    body: "Index a library that isn't on the atlas yet — from a public branch to a private monastic collection. Seven steps, autosaved as you go.",
    meta: "~ 12 MIN · 7 STEPS",
    lockedMeta: "~ 12 MIN · 7 STEPS",
    href: "/contribute/add",
    ctaLabel: "begin →",
    requiresRole: "any",
  },
  {
    pathId: "PATH·02",
    role: "ANY ROLE",
    accentColor: T.accent.aurora,
    cardGlow:
      "radial-gradient(ellipse 55% 65% at 95% 10%, rgba(127,223,255,0.08) 0%, transparent 65%)",
    heading: "Edit an ",
    headingItalic: "existing library.",
    body: "Refine a record that already exists — opening times, catalogue links, photography, descriptions. Changes shown side-by-side for moderators.",
    meta: "~ 4 MIN · DIFF REVIEW",
    lockedMeta: "~ 4 MIN · DIFF REVIEW",
    href: "/contribute/edit",
    ctaLabel: "find one →",
    requiresRole: "any",
  },
  {
    pathId: "PATH·03",
    role: "WIKI EDITOR",
    accentColor: T.accent.violet,
    cardGlow:
      "radial-gradient(ellipse 55% 65% at 5% 90%, rgba(163,144,255,0.11) 0%, transparent 65%)",
    heading: "Edit the ",
    headingItalic: "project docs.",
    body: "Contributor guides, API references, design docs, code recipes. Block editor or Markdown — both export the same way.",
    meta: "~ VARIES · MERGE REQUEST",
    lockedMeta: "~ VARIES · MERGE REQUEST",
    href: "/contribute/wiki",
    ctaLabel: "open editor →",
    requiresRole: "wikiEditor",
  },
  {
    pathId: "PATH·04",
    role: "EDITORIAL BOARD",
    accentColor: T.accent.gold,
    cardGlow: "none",
    heading: "Triage the ",
    headingItalic: "review queue.",
    body: "For editorial staff. 218 pending records await approval, with rejection or change-requests routed back to contributors — curated at your rate.",
    meta: "REQUIRES INVITE",
    lockedMeta: "REQUIRES INVITE",
    href: null,
    ctaLabel: "locked",
    requiresRole: "editorialBoard",
  },
]

function isCardLocked(
  card: PathCard,
  isSignedIn: boolean,
  isVerifiedLibrarian: boolean
): boolean {
  if (card.requiresRole === "any") return !isSignedIn
  if (card.requiresRole === "wikiEditor") return !isVerifiedLibrarian

  // editorialBoard — always locked (invite-only)
  return true
}

function roleLabel(isSignedIn: boolean, isVerifiedLibrarian: boolean): string {
  if (!isSignedIn) return "Sign in to contribute"
  if (isVerifiedLibrarian)
    return "Paths gated by your role · Verified Librarian"

  return "Paths gated by your role · Contributor"
}

export function ContributePathCards({
  isSignedIn,
  isVerifiedLibrarian,
}: ContributePathCardsProps) {
  return (
    <section
      style={{ background: T.bg.void }}
      className="mx-auto w-full max-w-[1296px] px-6 py-14 md:px-10"
    >
      {/* Section heading */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "24px",
          marginBottom: "28px",
        }}
      >
        <h2
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: T.ink.base,
            margin: 0,
            lineHeight: 1,
          }}
        >
          Choose a{" "}
          <em
            style={{
              fontStyle: "italic",
              fontWeight: 400,
              color: T.accent.aurora,
            }}
          >
            path.
          </em>
        </h2>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "8px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.ink.faint,
            textAlign: "right",
            lineHeight: 1.6,
            flexShrink: 0,
            paddingTop: "6px",
          }}
        >
          {roleLabel(isSignedIn, isVerifiedLibrarian)}
        </span>
      </div>

      {/* My Submissions shortcut */}
      <Link
        href="/contribute/submissions"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          padding: "14px 20px",
          borderRadius: "12px",
          border: `1px solid ${T.border.line}`,
          background: "rgba(255,255,255,0.02)",
          textDecoration: "none",
          marginBottom: "16px",
          transition: "background .15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "7px",
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: T.accent.aurora,
              background: "rgba(127,223,255,0.1)",
              border: "1px solid rgba(127,223,255,0.3)",
              borderRadius: "4px",
              padding: "3px 8px",
              flexShrink: 0,
            }}
          >
            Track
          </span>
          <span
            style={{
              fontFamily: T.font.serif,
              fontStyle: "italic",
              fontSize: "15px",
              color: T.ink.base,
            }}
          >
            My Submissions
          </span>
          <span
            style={{
              fontFamily: T.font.sans,
              fontSize: "13px",
              color: T.ink.faint,
            }}
          >
            — view status, editorial notes, and drafts in flight
          </span>
        </div>
        <span
          style={{
            fontFamily: T.font.serif,
            fontStyle: "italic",
            fontSize: "15px",
            color: T.accent.aurora,
            flexShrink: 0,
          }}
        >
          →
        </span>
      </Link>

      {/* 2×2 grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {PATH_CARDS.map((card) => {
          const locked = isCardLocked(card, isSignedIn, isVerifiedLibrarian)
          const dimText = locked ? "rgba(244,247,255,0.30)" : T.ink.base
          const dimBody = locked ? "rgba(244,247,255,0.28)" : T.ink.dim

          return (
            <div
              key={card.pathId}
              style={{
                border: `1px solid ${locked ? "rgba(255,255,255,0.05)" : T.border.line}`,
                borderRadius: "16px",
                padding: "28px 28px 24px",
                background: `${card.cardGlow}, rgba(255,255,255,0.02)`,
                display: "flex",
                flexDirection: "column",
                gap: "0",
                position: "relative",
                overflow: "hidden",
                minHeight: "240px",
              }}
            >
              {/* Top row: path id + role badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "20px",
                }}
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
                    padding: "3px 10px",
                    borderRadius: "999px",
                    border: `1px solid ${locked ? "rgba(255,255,255,0.10)" : card.accentColor + "55"}`,
                    fontFamily: T.font.mono,
                    fontSize: "7px",
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: locked ? T.ink.faint : card.accentColor,
                    background: locked
                      ? "transparent"
                      : card.accentColor + "15",
                  }}
                >
                  {card.role}
                </span>
              </div>

              {/* Heading */}
              <h3
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "clamp(1.4rem, 2.8vw, 2rem)",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.08,
                  color: dimText,
                  margin: "0 0 14px",
                }}
              >
                {card.heading}
                <em
                  style={{
                    fontStyle: "italic",
                    fontWeight: 400,
                    color: locked ? "rgba(244,247,255,0.22)" : card.accentColor,
                  }}
                >
                  {card.headingItalic}
                </em>
              </h3>

              {/* Body */}
              <p
                style={{
                  fontSize: "14px",
                  color: dimBody,
                  lineHeight: "1.65",
                  margin: "0 0 20px",
                  flexGrow: 1,
                }}
              >
                {card.body}
                {locked && (
                  <em
                    style={{
                      color: "rgba(244,247,255,0.20)",
                      fontStyle: "italic",
                    }}
                  >
                    {" "}
                    — Locked at your role.
                  </em>
                )}
              </p>

              {/* Dashed separator */}
              <div
                style={{
                  borderTop: "1px dashed rgba(255,255,255,0.08)",
                  marginBottom: "18px",
                }}
              />

              {/* Footer: meta left · CTA right */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: locked ? "rgba(244,247,255,0.18)" : T.ink.faint,
                  }}
                >
                  {locked ? card.lockedMeta : card.meta}
                </span>

                {locked || !card.href ? (
                  <span
                    style={{
                      fontFamily: T.font.serif,
                      fontStyle: "italic",
                      fontSize: "15px",
                      color: "rgba(244,247,255,0.20)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    locked
                  </span>
                ) : (
                  <Link
                    href={card.href}
                    style={{
                      fontFamily: T.font.serif,
                      fontStyle: "italic",
                      fontSize: "15px",
                      color: card.accentColor,
                      textDecoration: "none",
                      letterSpacing: "-0.01em",
                      transition: "opacity 150ms",
                    }}
                  >
                    {card.ctaLabel}
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
