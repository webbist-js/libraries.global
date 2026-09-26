"use client"

import { Icon } from "@iconify/react"
import { useId } from "react"

import { T } from "@/lib/design-tokens"

interface DiffFieldRowProps {
  fieldKey: string
  label: string
  currentValue: string
  proposedValue: string
  onChange: (val: string) => void
}

export function DiffFieldRow({
  label,
  currentValue,
  proposedValue,
  onChange,
}: DiffFieldRowProps) {
  const isChanged = proposedValue !== currentValue
  const uid = useId()
  const inputId = `${uid}-proposed`
  const currentId = `${uid}-current`

  return (
    <div
      className="mb-3 overflow-hidden rounded-[20px]"
      style={{
        background: T.bg.deep,
        border: `1px solid ${isChanged ? T.accent.primary : T.border.line}`,
      }}
    >
      {/* Label bar */}
      <div
        className="flex flex-wrap items-center gap-3 px-5 py-3"
        style={{ borderBottom: `1px solid ${T.border.divider}` }}
      >
        <label
          htmlFor={inputId}
          className="text-[15px] font-semibold"
          style={{ color: T.ink.base }}
        >
          {label}
        </label>
        {isChanged && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
            style={{ background: T.accent.chip, color: T.accent.primary }}
          >
            <Icon icon="mdi:pencil" width={13} height={13} aria-hidden="true" />
            Changed
          </span>
        )}
      </div>

      {/* Two columns (stack on phones) */}
      <div className="grid grid-cols-1 sm:grid-cols-2">
        {/* Left: current value (read only) */}
        <div className="px-5 py-3.5" style={{ background: T.bg.surface }}>
          <span
            className="mb-1 block text-[14px] sm:sr-only"
            style={{ color: T.ink.dim }}
          >
            Current value
          </span>
          <p
            id={currentId}
            className="m-0 text-[15px] leading-normal wrap-break-word"
            style={{ color: T.ink.dim }}
          >
            {currentValue || (
              <span style={{ color: T.ink.low, fontStyle: "italic" }}>
                Not set
              </span>
            )}
          </p>
        </div>

        {/* Right: editable */}
        <div className="border-(--t-divider) px-3 py-2 max-sm:border-t sm:border-l">
          <input
            id={inputId}
            type="text"
            value={proposedValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={currentValue || "Enter value…"}
            aria-describedby={currentId}
            className="w-full"
            style={{
              minHeight: "44px",
              padding: "10px 12px",
              borderRadius: "14px",
              border: `1px solid ${T.border.hi}`,
              background: T.bg.deep,
              color: T.ink.base,
              fontSize: "15px",
              fontFamily: T.font.sans,
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>
    </div>
  )
}
