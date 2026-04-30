"use client"

import { DotHeroCanvas } from "@/components/ui/DotHeroCanvas"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

interface AddLibraryHeroProps {
  lastSavedAt?: Date | null
  /** Edit mode: shows different title/breadcrumb */
  libraryName?: string
}

function formatSavedTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  })
}

export function AddLibraryHero({
  lastSavedAt,
  libraryName,
}: AddLibraryHeroProps) {
  const isEditMode = !!libraryName

  return (
    <section
      data-transparent-header=""
      className="-mt-14 overflow-hidden"
      style={{
        position: "relative",
        background: T.bg.void,
        borderBottom: `1px solid ${T.border.line}`,
      }}
    >
      <DotHeroCanvas />

      {/* Fade overlay — blend into page */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(3,5,17,0) 0%, rgba(3,5,17,0.6) 100%)",
        }}
      />

      <div
        className="relative z-10 mx-auto w-full max-w-[1200px]"
        style={{ padding: "96px 24px 36px" }}
      >
        {/* Breadcrumb row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".2em",
              textTransform: "uppercase",
              color: T.ink.faint,
              margin: 0,
            }}
          >
            <Link
              href="/contribute"
              style={{
                color: T.ink.faint,
                textDecoration: "none",
                transition: "color 120ms",
              }}
              className="hover:text-white/60"
            >
              Contribute
            </Link>
            <span style={{ margin: "0 8px", opacity: 0.4 }}>/</span>
            <span style={{ color: T.ink.low }}>
              {isEditMode ? "Edit library" : "Add a library"}
            </span>
          </p>

          {/* Draft status */}
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: lastSavedAt ? T.accent.ok : T.ink.faint,
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: lastSavedAt ? T.accent.ok : T.ink.faint,
                flexShrink: 0,
                opacity: lastSavedAt ? 1 : 0.4,
              }}
            />
            {lastSavedAt
              ? `Draft saved · ${formatSavedTime(lastSavedAt)}`
              : "Draft not yet saved"}
          </p>
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(2.8rem, 5vw, 4.2rem)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 0.95,
            color: T.ink.base,
            margin: "0 0 18px",
          }}
        >
          {isEditMode ? (
            <>
              Suggest edits to{" "}
              <em
                style={{
                  fontStyle: "italic",
                  fontWeight: 400,
                  color: T.accent.aurora,
                }}
              >
                {libraryName}.
              </em>
            </>
          ) : (
            <>
              Index a{" "}
              <em
                style={{
                  fontStyle: "italic",
                  fontWeight: 400,
                  color: T.accent.aurora,
                }}
              >
                new library.
              </em>
            </>
          )}
        </h1>

        {/* Body */}
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "15px",
            color: T.ink.dim,
            maxWidth: "52ch",
            lineHeight: "1.65",
            margin: 0,
          }}
        >
          {isEditMode
            ? "Correct or update any details below. Your changes go to editorial review before going live."
            : "Seven steps, granular but forgiving. Drafts save automatically; submit only when you\u2019re ready for editorial review."}
        </p>
      </div>
    </section>
  )
}
