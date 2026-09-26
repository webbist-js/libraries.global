"use client"

import { T } from "@/lib/design-tokens"
import type { WikiRichTextDraftBlock } from "@/lib/wikiEditorUtils"

export function WikiRichTextEditor({
  block,
  onChange,
}: {
  readonly block: WikiRichTextDraftBlock
  readonly onChange: (updated: WikiRichTextDraftBlock) => void
}) {
  return (
    <textarea
      value={block.text}
      onChange={(e) =>
        onChange({ ...block, text: e.target.value, _dirty: true })
      }
      style={{
        width: "100%",
        minHeight: "120px",
        background: T.bg.surface,
        border: `1px solid ${T.border.line}`,
        borderRadius: "6px",
        color: T.ink.base,
        fontFamily: T.font.sans,
        fontSize: "14px",
        lineHeight: 1.7,
        padding: "12px",
        resize: "vertical",
        outline: "none",
        boxSizing: "border-box",
      }}
      placeholder="Write paragraph text here…"
    />
  )
}
