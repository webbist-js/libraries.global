"use client"

import { T } from "@/lib/design-tokens"
import type { WikiCodeDraftBlock } from "@/lib/wikiEditorUtils"

const LANGUAGES = [
  "",
  "typescript",
  "javascript",
  "python",
  "bash",
  "json",
  "html",
  "css",
  "sql",
  "rust",
  "go",
]

export function WikiCodeBlockEditor({
  block,
  onChange,
}: {
  readonly block: WikiCodeDraftBlock
  readonly onChange: (updated: WikiCodeDraftBlock) => void
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", gap: "8px" }}>
        <select
          value={block.language ?? ""}
          onChange={(e) =>
            onChange({ ...block, language: e.target.value || undefined })
          }
          style={{
            flex: "0 0 140px",
            background: T.bg.surface,
            border: `1px solid ${T.border.line}`,
            borderRadius: "6px",
            color: T.ink.base,
            fontFamily: T.font.mono,
            fontSize: "11px",
            padding: "6px 10px",
            outline: "none",
          }}
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l || "Language"}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={block.filename ?? ""}
          onChange={(e) =>
            onChange({ ...block, filename: e.target.value || undefined })
          }
          placeholder="filename (optional)"
          style={{
            flex: 1,
            background: T.bg.surface,
            border: `1px solid ${T.border.line}`,
            borderRadius: "6px",
            color: T.ink.base,
            fontFamily: T.font.mono,
            fontSize: "11px",
            padding: "6px 10px",
            outline: "none",
          }}
        />
      </div>
      <textarea
        value={block.code}
        onChange={(e) => onChange({ ...block, code: e.target.value })}
        style={{
          width: "100%",
          minHeight: "120px",
          background: "rgba(0,0,0,.3)",
          border: `1px solid ${T.border.line}`,
          borderRadius: "6px",
          color: T.ink.base,
          fontFamily: T.font.mono,
          fontSize: "12px",
          lineHeight: 1.6,
          padding: "12px",
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box",
        }}
        placeholder="// code here"
        spellCheck={false}
      />
    </div>
  )
}
