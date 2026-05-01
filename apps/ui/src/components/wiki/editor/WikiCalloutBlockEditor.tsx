"use client"

import { T } from "@/lib/design-tokens"
import type { WikiCalloutDraftBlock } from "@/lib/wikiEditorUtils"

const CALLOUT_TYPES: {
  value: WikiCalloutDraftBlock["type"]
  label: string
  color: string
}[] = [
  { value: "info", label: "INFO", color: T.accent.aurora },
  { value: "warning", label: "WARNING", color: T.accent.warn },
  { value: "tip", label: "TIP", color: T.accent.ok },
  { value: "note", label: "NOTE", color: T.accent.violet },
]

export function WikiCalloutBlockEditor({
  block,
  onChange,
}: {
  readonly block: WikiCalloutDraftBlock
  readonly onChange: (updated: WikiCalloutDraftBlock) => void
}) {
  const activeType =
    CALLOUT_TYPES.find((t) => t.value === block.type) ?? CALLOUT_TYPES[0]!

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", gap: "6px" }}>
        {CALLOUT_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => onChange({ ...block, type: t.value })}
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: block.type === t.value ? t.color : T.ink.faint,
              background:
                block.type === t.value ? `${t.color}14` : "transparent",
              border: `1px solid ${block.type === t.value ? t.color + "40" : T.border.line}`,
              borderRadius: "4px",
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={block.title ?? ""}
        onChange={(e) =>
          onChange({ ...block, title: e.target.value || undefined })
        }
        placeholder="Title (optional)"
        style={{
          background: T.bg.surface,
          border: `1px solid ${T.border.line}`,
          borderRadius: "6px",
          color: T.ink.base,
          fontFamily: T.font.sans,
          fontSize: "13px",
          fontWeight: 600,
          padding: "8px 12px",
          outline: "none",
        }}
      />
      <textarea
        value={block.body}
        onChange={(e) => onChange({ ...block, body: e.target.value })}
        style={{
          width: "100%",
          minHeight: "80px",
          background: `${activeType.color}08`,
          border: `1px solid ${activeType.color}30`,
          borderRadius: "6px",
          color: T.ink.base,
          fontFamily: T.font.sans,
          fontSize: "13px",
          lineHeight: 1.65,
          padding: "12px",
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box",
        }}
        placeholder="Callout body…"
      />
    </div>
  )
}
