"use client"

import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

type ToolButtonProps = {
  icon?: string
  label: string
  text?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

export function WritingToolbarButton({
  icon,
  label,
  text,
  active,
  disabled,
  onClick,
}: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] px-2 text-sm font-bold transition-colors hover:bg-(--t-bg-muted-2) disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        background: active ? T.accent.chip : "transparent",
        color: active ? T.accent.primary : T.ink.base,
        border: "none",
        cursor: "pointer",
        fontFamily: T.font.sans,
      }}
    >
      {icon ? <Icon icon={icon} width={18} aria-hidden="true" /> : text}
    </button>
  )
}
