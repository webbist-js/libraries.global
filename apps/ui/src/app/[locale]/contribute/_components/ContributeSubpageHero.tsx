"use client"

import type React from "react"

import { Breadcrumb, ContributeHeroShell } from "@/components/ds"
import { T } from "@/lib/design-tokens"

interface ContributeSubpageHeroProps {
  /** Current page label shown after "Contribute /" */
  section: string
  /** Optional right-side element rendered opposite the breadcrumb */
  badge?: React.ReactNode
  /** Bold heading prefix e.g. "Index a" */
  heading: string
  /** Italic accent suffix e.g. "new library." */
  headingItalic: string
  /** Color for the italic portion — defaults to aurora */
  accentColor?: string
  /** Optional content appended after the italic (e.g. commas, line breaks) */
  headingAfter?: React.ReactNode
  /** Subtext paragraph */
  body: string
  minHeight?: string
  overlay?: string
}

export function ContributeSubpageHero({
  section,
  badge,
  heading,
  headingItalic,
  accentColor,
  headingAfter,
  body,
  minHeight,
  overlay,
}: ContributeSubpageHeroProps) {
  return (
    <ContributeHeroShell minHeight={minHeight} overlay={overlay}>
      {/* Breadcrumb row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "20px",
        }}
      >
        <Breadcrumb
          items={[
            { label: "Contribute", href: "/contribute" },
            { label: section },
          ]}
        />
        {badge && <div style={{ flexShrink: 0 }}>{badge}</div>}
      </div>

      {/* Heading */}
      <h1
        style={{
          fontFamily: T.font.serif,
          fontSize: "clamp(2.6rem, 5.5vw, 4.2rem)",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 0.95,
          color: T.ink.base,
          margin: "0 0 18px",
        }}
      >
        {heading}{" "}
        <em
          style={{
            fontStyle: "italic",
            fontWeight: 400,
            color: accentColor ?? T.accent.aurora,
          }}
        >
          {headingItalic}
        </em>
        {headingAfter}
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
        {body}
      </p>
    </ContributeHeroShell>
  )
}
