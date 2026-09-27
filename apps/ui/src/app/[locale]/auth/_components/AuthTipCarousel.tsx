"use client"

// apps/ui/src/app/[locale]/auth/_components/AuthTipCarousel.tsx

import { Icon } from "@iconify/react"
import { useState } from "react"

import { T } from "@/lib/design-tokens"

export interface AuthTip {
  title: string
  body: string
}

const navButtonClassName =
  "flex size-11 cursor-pointer items-center justify-center transition-colors hover:bg-(--t-bg-surface)"

export function AuthTipCarousel({ tips }: { tips: readonly AuthTip[] }) {
  const [index, setIndex] = useState(0)
  const step = (delta: number) =>
    setIndex((i) => (i + delta + tips.length) % tips.length)

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Tips"
      className="flex flex-col p-6"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: "20px",
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1"
          style={{
            background: T.accent.chip,
            color: T.accent.primary,
            borderRadius: "999px",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          <Icon icon="mdi:lightbulb-outline" width={16} aria-hidden="true" />
          Tip
        </span>
        <span style={{ fontSize: "14px", color: T.ink.dim }}>
          {index + 1} of {tips.length}
        </span>
      </div>

      {/* Every tip shares one grid cell, so the card is always as tall as the
          longest tip and does not jump when paging. */}
      <div aria-live="polite" className="mt-4 grid flex-1">
        {tips.map((tip, i) => (
          <div
            key={tip.title}
            style={{ gridArea: "1 / 1" }}
            className={i === index ? undefined : "invisible"}
          >
            <p
              style={{
                fontFamily: T.font.serif,
                fontSize: "24px",
                fontWeight: 400,
                lineHeight: 1.15,
                letterSpacing: "-0.01em",
                color: T.ink.base,
              }}
            >
              {tip.title}
            </p>
            <p
              style={{
                marginTop: "12px",
                fontSize: "15px",
                lineHeight: 1.6,
                color: T.ink.dim,
              }}
            >
              {tip.body}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div aria-hidden="true" className="flex items-center gap-1.5">
          {tips.map((tip, i) => (
            <span
              key={tip.title}
              style={{
                width: i === index ? "24px" : "8px",
                height: "8px",
                borderRadius: "999px",
                background: i === index ? T.accent.primary : T.ink.ghost,
                transition: "width 200ms",
              }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Previous tip"
            onClick={() => step(-1)}
            className={navButtonClassName}
            style={{
              border: `1px solid ${T.border.hi}`,
              borderRadius: "999px",
              color: T.ink.base,
            }}
          >
            <Icon icon="mdi:chevron-left" width={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Next tip"
            onClick={() => step(1)}
            className={navButtonClassName}
            style={{
              border: `1px solid ${T.border.hi}`,
              borderRadius: "999px",
              color: T.ink.base,
            }}
          >
            <Icon icon="mdi:chevron-right" width={22} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
