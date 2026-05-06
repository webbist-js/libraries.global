"use client"

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

  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "12px",
        overflow: "hidden",
        marginBottom: "12px",
      }}
    >
      {/* Label bar */}
      <div
        style={{
          padding: "8px 16px",
          background: T.bg.surface,
          borderBottom: `1px solid ${T.border.line}`,
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          {label}
        </span>
        {isChanged && (
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.accent.aurora,
              border: `1px solid rgba(127,223,255,0.3)`,
              borderRadius: "5px",
              padding: "2px 6px",
              background: "rgba(127,223,255,0.07)",
            }}
          >
            Changed
          </span>
        )}
      </div>

      {/* Two columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1px",
          background: T.border.line,
        }}
      >
        {/* Left: current value (read only) */}
        <div
          style={{
            padding: "14px 16px",
            background: T.bg.deep,
            color: T.ink.faint,
            fontSize: "13px",
            fontFamily: T.font.sans,
            lineHeight: 1.5,
            minHeight: "48px",
          }}
        >
          {currentValue || (
            <span
              style={{ color: "rgba(244,247,255,0.18)", fontStyle: "italic" }}
            >
              No value
            </span>
          )}
        </div>

        {/* Right: editable */}
        <div
          style={{
            background: isChanged ? "rgba(127,223,255,0.04)" : T.bg.deep,
            padding: 0,
            minHeight: "48px",
          }}
        >
          <input
            type="text"
            value={proposedValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={currentValue || "Enter value…"}
            style={{
              width: "100%",
              height: "100%",
              minHeight: "48px",
              padding: "14px 16px",
              background: "transparent",
              color: T.ink.base,
              border: "none",
              outline: "none",
              fontSize: "13px",
              fontFamily: T.font.sans,
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>
    </div>
  )
}
