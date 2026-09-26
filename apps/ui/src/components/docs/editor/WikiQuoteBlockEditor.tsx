"use client"

import { T } from "@/lib/design-tokens"
import type { WikiQuoteDraftBlock } from "@/lib/wikiEditorUtils"

export function WikiQuoteBlockEditor({
  block,
  onChange,
}: {
  readonly block: WikiQuoteDraftBlock
  readonly onChange: (updated: WikiQuoteDraftBlock) => void
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <textarea
        value={block.quote}
        onChange={(e) => onChange({ ...block, quote: e.target.value })}
        style={{
          width: "100%",
          minHeight: "80px",
          background: T.bg.surface,
          border: `1px solid ${T.border.line}`,
          borderRadius: "6px",
          color: T.ink.base,
          fontFamily: T.font.serif,
          fontSize: "14px",
          fontStyle: "italic",
          lineHeight: 1.65,
          padding: "12px",
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box",
        }}
        placeholder="Quote text…"
      />
      <input
        type="text"
        value={block.attribution ?? ""}
        onChange={(e) =>
          onChange({ ...block, attribution: e.target.value || undefined })
        }
        placeholder="Attribution (optional)"
        style={{
          background: T.bg.surface,
          border: `1px solid ${T.border.line}`,
          borderRadius: "6px",
          color: T.ink.base,
          fontFamily: T.font.sans,
          fontSize: "13px",
          padding: "8px 12px",
          outline: "none",
        }}
      />
      <input
        type="text"
        value={block.source ?? ""}
        onChange={(e) =>
          onChange({ ...block, source: e.target.value || undefined })
        }
        placeholder="Source URL or reference (optional)"
        style={{
          background: T.bg.surface,
          border: `1px solid ${T.border.line}`,
          borderRadius: "6px",
          color: T.ink.base,
          fontFamily: T.font.sans,
          fontSize: "13px",
          padding: "8px 12px",
          outline: "none",
        }}
      />
    </div>
  )
}
