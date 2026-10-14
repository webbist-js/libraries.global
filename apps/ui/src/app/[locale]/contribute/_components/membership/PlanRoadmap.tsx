"use client"

import { Icon } from "@iconify/react"
import { useId, useState } from "react"

import { T } from "@/lib/design-tokens"
import type { PlanCard, PlanCardKey } from "@/lib/plans"

import { includeLabel } from "./PlanBits"

const ROADMAP_SUMMARY: Partial<Record<PlanCardKey, string>> = {
  pro: "Analysis layers, reach tools, library watching and side-by-side comparison.",
  team: "Traffic reports, a shared workspace, bulk updates, an embeddable finder and higher API allowances.",
}

export function PlanRoadmap({ plan }: { readonly plan: PlanCard }) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const soon = plan.includes.filter((item) => item.kind === "soon")
  if (soon.length === 0) return null

  return (
    <div
      className="rounded-[18px] border p-4"
      style={{ background: T.bg.surface, borderColor: T.border.line }}
    >
      <div className="flex items-center gap-2">
        <Icon
          aria-hidden="true"
          height={16}
          icon="mdi:clock-outline"
          style={{ color: T.accent.primary }}
          width={16}
        />
        <p className="m-0 flex-1 text-[14px] font-semibold">
          On the roadmap{" "}
          <span className="font-medium" style={{ color: T.ink.dim }}>
            {soon.length}
          </span>
        </p>
        <button
          aria-controls={listId}
          aria-expanded={open}
          aria-label={`Show ${open ? "less" : "all"} ${plan.name} roadmap features`}
          className="min-h-11 text-[13.5px] font-semibold underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={() => setOpen((value) => !value)}
          style={{ color: T.accent.primary }}
          type="button"
        >
          {open ? "Show less" : "Show all"}
        </button>
      </div>
      {ROADMAP_SUMMARY[plan.key] ? (
        <p
          className="m-0 mt-1.5 text-[13.5px] leading-[1.5]"
          style={{ color: T.ink.dim }}
        >
          {ROADMAP_SUMMARY[plan.key]}
        </p>
      ) : null}
      <ul
        className="m-0 mt-3 list-none space-y-1.5 p-0 text-[13.5px]"
        hidden={!open}
        id={listId}
        style={{ color: T.ink.dim }}
      >
        {soon.map((item) => (
          <li key={item.text} className="flex gap-2">
            <span aria-hidden="true">·</span>
            {includeLabel(item)}
          </li>
        ))}
      </ul>
    </div>
  )
}
