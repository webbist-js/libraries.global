"use client"
import { useTranslations } from "next-intl"

import { T } from "@/lib/design-tokens"

/** v2 toggle switch with an explicit On/Off label, per the settings design. */
export function ToggleSwitch({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: boolean
  onChange: (v: boolean) => void
  /** Accessible name for the switch (row label). */
  label: string
  disabled?: boolean
}) {
  const tExisting = useTranslations()

  return (
    <span className="inline-flex shrink-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className="text-sm font-semibold"
        style={{ color: value ? T.ink.dim : T.ink.faint }}
      >
        {value
          ? tExisting("widgetSettings.on")
          : tExisting("discussions.feedOff")}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className="relative h-[26px] w-[46px] cursor-pointer rounded-full border-0 transition-colors disabled:cursor-wait disabled:opacity-50"
        style={{ background: value ? T.action.primary : T.border.hi }}
      >
        <span
          className="absolute top-[3px] size-5 rounded-full bg-(--t-bg-deep) transition-[left]"
          style={{ left: value ? "23px" : "3px" }}
        />
      </button>
    </span>
  )
}
