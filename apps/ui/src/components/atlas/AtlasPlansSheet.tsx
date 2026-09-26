"use client"

import { useEffect, useRef } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

import { Icon } from "./atlas-ui"
import type { Tier } from "./atlas.logic"

const PLANS = [
  { key: "public", name: "Public", price: "Free", who: "No account" },
  { key: "free", name: "Free account", price: "Free", who: "Sign in" },
  { key: "pro", name: "Pro", price: "Coming soon", who: "For researchers" },
  {
    key: "team",
    name: "Team",
    price: "Coming soon",
    who: "Libraries & councils",
  },
] as const

// [feature, public, free, pro, team]
const FEATURES: [string, boolean, boolean, boolean, boolean][] = [
  [
    "Every library record, including hours and services",
    true,
    true,
    true,
    true,
  ],
  ["Search, filters and list view", true, true, true, true],
  ["Density, opening hours and closures layers", true, true, true, true],
  ["Save places and follow libraries", false, true, true, true],
  ["Accessibility, events and completeness layers", false, true, true, true],
  ["Per-capita, deprivation and transit layers", false, false, true, true],
  ["Reach, draw-to-analyse and coverage gaps", false, false, true, true],
  ["Compare areas, export CSV and GeoJSON", false, false, true, true],
  ["Shared projects and branded reports", false, false, false, true],
]

export function AtlasPlansSheet({
  tier,
  onClose,
  signInHref,
}: {
  readonly tier: Tier
  readonly onClose: () => void
  readonly signInHref: string
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<Element | null>(null)

  useEffect(() => {
    returnFocus.current = document.activeElement
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)

    return () => {
      window.removeEventListener("keydown", onKey)
      ;(returnFocus.current as HTMLElement | null)?.focus?.()
    }
  }, [onClose])

  const current = tier === "pro" ? "pro" : tier

  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 z-[70]"
        style={{ background: "rgba(23,22,43,.28)" }}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="atlas-plans-h"
        className="absolute inset-y-0 right-0 z-[71] flex w-full max-w-[860px] flex-col gap-3.5 overflow-auto border-l px-5 py-6 sm:px-8"
        style={{ background: T.bg.void, borderColor: T.border.hi }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="atlas-plans-h"
              className="m-0 text-[32px] leading-none tracking-[-.015em] sm:text-[38px]"
              style={{ fontFamily: T.font.serif, fontWeight: 500 }}
            >
              Library facts are free.{" "}
              <em className="font-normal" style={{ color: T.accent.primary }}>
                Always.
              </em>
            </h2>
            <p
              className="mt-2.5 mb-0 max-w-[640px] text-[17px] leading-normal"
              style={{ color: "#45435A" }}
            >
              Addresses, hours, services and every community record stay open to
              everyone. Pro will pay for the analysis tools and licensed data
              that cost money to run, and help keep the rest free.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close plans"
            onClick={onClose}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border bg-white"
            style={{ borderColor: T.border.line }}
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div
          className="shrink-0 overflow-x-auto rounded-[22px] border bg-white"
          style={{ borderColor: T.border.line }}
        >
          <table className="w-full min-w-[640px] border-collapse text-[14px]">
            <caption className="sr-only">What each plan includes</caption>
            <thead>
              <tr>
                <td className="w-[34%]" />
                {PLANS.map((p) => (
                  <th
                    key={p.key}
                    scope="col"
                    className="border-b px-2.5 py-3 text-center align-top font-bold"
                    style={{
                      borderColor: T.border.hi,
                      background: p.key === "pro" ? T.accent.chip : "#fff",
                    }}
                  >
                    <span className="block text-[15px]">{p.name}</span>
                    <span
                      className="my-1 block text-[20px] font-medium"
                      style={{ fontFamily: T.font.serif }}
                    >
                      {p.price}
                    </span>
                    <span className="font-medium" style={{ color: T.ink.dim }}>
                      {p.who}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map(([feature, ...cells]) => (
                <tr key={feature}>
                  <th
                    scope="row"
                    className="border-b px-3.5 py-2 text-left font-medium"
                    style={{ borderColor: T.border.divider }}
                  >
                    {feature}
                  </th>
                  {cells.map((included, i) => (
                    <td
                      key={PLANS[i]!.key}
                      className="border-b px-2.5 py-2 text-center"
                      style={{
                        borderColor: T.border.divider,
                        background: i === 2 ? "#F6F5FE" : undefined,
                      }}
                    >
                      {included ? (
                        <span
                          className="inline-flex"
                          style={{ color: T.accent.ok }}
                        >
                          <Icon name="check" size={16} stroke={2.4} />
                          <span className="sr-only">Included</span>
                        </span>
                      ) : (
                        <span style={{ color: "#8A8799" }}>
                          <span aria-hidden="true">—</span>
                          <span className="sr-only">Not included</span>
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td />
                {PLANS.map((p) => (
                  <td
                    key={p.key}
                    className="px-2.5 py-3 text-center"
                    style={{
                      background: p.key === "pro" ? "#F6F5FE" : undefined,
                    }}
                  >
                    {p.key === current ? (
                      <span
                        className="text-[14px]"
                        style={{ color: T.ink.dim }}
                      >
                        You’re here
                      </span>
                    ) : p.key === "free" && tier === "public" ? (
                      <GlobalLink
                        href={signInHref}
                        className="inline-flex h-9 items-center rounded-full border bg-white px-3.5 text-[14px] font-semibold"
                        style={{ borderColor: T.border.hi, color: T.ink.base }}
                      >
                        Sign in
                      </GlobalLink>
                    ) : p.key === "pro" || p.key === "team" ? (
                      <span
                        className="text-[14px] font-semibold"
                        style={{ color: T.ink.dim }}
                      >
                        Not yet available
                      </span>
                    ) : null}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <p
          className="m-0 flex gap-2 text-[14px] leading-normal"
          style={{ color: "#45435A" }}
        >
          <Icon name="globe" size={18} color="#4A3F8C" />
          <span>
            <strong style={{ color: T.ink.base }}>
              Open source, open data.
            </strong>{" "}
            Library records are community-maintained open data, and the atlas
            code will be published openly. Pricing hasn’t been set yet.
          </span>
        </p>
      </aside>
    </>
  )
}
