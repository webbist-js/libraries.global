"use client"

import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

type Visibility = "public" | "limited" | "private"

const OPTIONS: {
  value: Visibility
  label: string
  desc: string
  icon: string
}[] = [
  {
    value: "public",
    label: "Public",
    desc: "Indexed and findable. Recommended for librarians and contributors.",
    icon: "mdi:earth",
  },
  {
    value: "limited",
    label: "Limited",
    desc: "Only members of libraries you contribute to can see your full profile.",
    icon: "mdi:help-circle-outline",
  },
  {
    value: "private",
    label: "Private",
    desc: "Anonymous on contributions; profile page is hidden.",
    icon: "mdi:lock-outline",
  },
]

export function VisibilityCards({
  value,
  onChange,
  layout = "vertical",
}: {
  value: Visibility
  onChange: (v: Visibility) => void
  layout?: "vertical" | "horizontal"
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: layout === "horizontal" ? "row" : "column",
        gap: "10px",
      }}
    >
      {OPTIONS.map((opt) => {
        const selected = opt.value === value

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: layout === "horizontal" ? "1 1 0" : undefined,
              padding: "16px 18px",
              borderRadius: "10px",
              border: `1px solid ${selected ? "rgba(127,223,255,0.45)" : T.border.line}`,
              background: selected
                ? "rgba(127,223,255,0.05)"
                : "rgba(255,255,255,0.02)",
              cursor: "pointer",
              textAlign: "left",
              transition: "border-color 150ms, background 150ms",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "8px",
            }}
          >
            <Icon
              icon={opt.icon}
              width={20}
              height={20}
              style={{
                color: selected ? T.accent.aurora : T.ink.dim,
                flexShrink: 0,
                transition: "color 150ms",
              }}
            />
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: 600,
                  color: selected ? T.ink.base : T.ink.dim,
                  lineHeight: 1.3,
                }}
              >
                {opt.label}
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "12px",
                  color: T.ink.faint,
                  lineHeight: 1.5,
                }}
              >
                {opt.desc}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
