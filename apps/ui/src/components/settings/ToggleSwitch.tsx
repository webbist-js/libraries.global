"use client"

import { T } from "@/lib/design-tokens"

/** v2 toggle switch with an explicit On/Off label, per the settings design. */
export function ToggleSwitch({
  value,
  onChange,
  label,
}: {
  value: boolean
  onChange: (v: boolean) => void
  /** Accessible name for the switch (row label). */
  label: string
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className="text-[13px] font-semibold"
        style={{ color: value ? T.ink.dim : T.ink.faint }}
      >
        {value ? "On" : "Off"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className="relative h-[26px] w-[46px] cursor-pointer rounded-full border-0 transition-colors"
        style={{ background: value ? T.accent.primary : T.border.hi }}
      >
        <span
          className="absolute top-[3px] size-5 rounded-full bg-white transition-[left]"
          style={{ left: value ? "23px" : "3px" }}
        />
      </button>
    </span>
  )
}
