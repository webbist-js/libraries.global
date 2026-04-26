"use client"

import { T } from "@/lib/design-tokens"

type Visibility = "public" | "limited" | "private"

const OPTIONS: { value: Visibility; label: string; desc: string }[] = [
  {
    value: "public",
    label: "Public",
    desc: "Everyone can see your full profile — name, bio, location, links, and activity.",
  },
  {
    value: "limited",
    label: "Limited",
    desc: "Only your name and avatar are visible. Bio, location, and links are hidden.",
  },
  {
    value: "private",
    label: "Private",
    desc: "Your profile is hidden from everyone. Only you can see it when signed in.",
  },
]

export function VisibilityCards({
  value,
  onChange,
}: {
  value: Visibility
  onChange: (v: Visibility) => void
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {OPTIONS.map((opt) => {
        const selected = opt.value === value

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: "14px 18px",
              borderRadius: "8px",
              border: `1px solid ${selected ? "rgba(127,223,255,0.4)" : T.border.line}`,
              background: selected
                ? "rgba(127,223,255,0.06)"
                : "rgba(255,255,255,0.02)",
              cursor: "pointer",
              textAlign: "left",
              transition: "border-color 150ms, background 150ms",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                border: `2px solid ${selected ? T.accent.aurora : T.border.hi}`,
                background: selected ? T.accent.aurora : "transparent",
                flexShrink: 0,
                marginTop: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {selected && (
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#030511",
                  }}
                />
              )}
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  fontWeight: 600,
                  color: selected ? T.ink.base : T.ink.dim,
                }}
              >
                {opt.label}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: "12px",
                  color: T.ink.faint,
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
