"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import { useEntitlements } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

const MODES = [
  { key: "walk", label: "Walk" },
  { key: "cycle", label: "Cycle" },
  { key: "transit", label: "Public transport" },
] as const

type Mode = (typeof MODES)[number]["key"]

// Decorative bar widths for the blurred preview, per mode. Not data.
const PREVIEW: Record<Mode, number[]> = {
  walk: [22, 48, 86],
  cycle: [40, 74, 96],
  transit: [30, 62, 90],
}

/**
 * The "Who can reach this library?" Pro teaser (atlas.analysis, not built
 * yet). The preview is blurred and decorative, labelled as illustrative;
 * Pro members see a "coming soon" note instead of the upsell.
 */
export function LibraryReachTeaser() {
  const { can, ready } = useEntitlements()
  const [mode, setMode] = useState<Mode>("walk")
  const isPro = ready && can("atlas.analysis")

  return (
    <div
      className="grid overflow-hidden rounded-2xl md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]"
      style={{ border: `1px solid ${T.border.line}` }}
    >
      <div className="p-5" style={{ background: T.accent.chip }}>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[12px] font-semibold"
          style={{ color: T.accent.primary }}
        >
          <Icon
            aria-hidden="true"
            height={13}
            icon="mdi:lock-outline"
            width={13}
          />
          Pro analysis
        </span>
        <h3
          className="mt-2.5 mb-0 text-[22px] leading-tight"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            color: T.ink.base,
          }}
        >
          Who can reach this library?
        </h3>
        <div
          role="group"
          aria-label="Travel mode for the preview"
          className="mt-3 flex flex-wrap gap-1.5"
        >
          {MODES.map((m) => {
            const on = mode === m.key

            return (
              <button
                key={m.key}
                type="button"
                aria-pressed={on}
                onClick={() => setMode(m.key)}
                className="rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors"
                style={{
                  background: on ? T.accent.primary : T.bg.deep,
                  borderColor: on ? T.accent.primary : T.border.hi,
                  color: on ? "#fff" : T.ink.base,
                }}
              >
                {m.label}
              </button>
            )
          })}
        </div>
        <p
          className="mt-3 mb-0 text-[14px] leading-normal"
          style={{ color: T.ink.dim }}
        >
          {isPro
            ? "Reach analysis is coming to Pro soon. You’ll find it here and in the Atlas."
            : "Library facts on this page are always free. Pro adds analysis like this, and it’s free for regular contributors."}
        </p>
        {isPro ? null : (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/contribute/membership"
              className="rounded-full bg-(--t-accent-primary) px-4 py-2 text-[14px] font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
            >
              See Pro
            </Link>
            <Link
              href="/contribute/membership#get-pro-free"
              className="rounded-full border bg-white px-4 py-2 text-[14px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
              style={{ borderColor: T.border.hi, color: T.ink.base }}
            >
              Get Pro free
            </Link>
          </div>
        )}
      </div>

      <div className="relative p-5" style={{ background: T.bg.deep }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px]" style={{ color: T.ink.dim }}>
            Preview of what Pro shows for this library
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-semibold"
            style={{ borderColor: T.border.line, color: T.ink.base }}
          >
            <Icon
              aria-hidden="true"
              height={12}
              icon="mdi:lock-outline"
              width={12}
            />
            Preview
          </span>
        </div>
        <div
          aria-hidden="true"
          className="mt-4 flex flex-col gap-3 blur-[3px] select-none"
        >
          {PREVIEW[mode].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-12 text-[12px]" style={{ color: T.ink.dim }}>
                {(i + 1) * 5} min
              </span>
              <span
                className="h-2.5 flex-1 overflow-hidden rounded-full"
                style={{ background: T.bg.muted2 }}
              >
                <span
                  className="block h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
                  style={{
                    width: `${w}%`,
                    background: `color-mix(in srgb, ${T.accent.primary} ${40 + i * 25}%, white)`,
                  }}
                />
              </span>
              <span
                className="w-12 text-right text-[12px]"
                style={{ color: T.ink.dim }}
              >
                0,000
              </span>
            </div>
          ))}
          <p className="m-0 text-[12.5px]" style={{ color: T.ink.dim }}>
            0,000 people live within 15 minutes of this library.
          </p>
        </div>
        <p className="mt-4 mb-0 text-[12px]" style={{ color: T.ink.low }}>
          Sample preview. The figures are placeholders until reach analysis
          launches.
        </p>
      </div>
    </div>
  )
}
