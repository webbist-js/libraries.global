"use client"

import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"
import type { WikiDraftBlock } from "@/lib/wikiEditorUtils"

import { WikiCalloutBlockEditor } from "./WikiCalloutBlockEditor"
import { WikiCodeBlockEditor } from "./WikiCodeBlockEditor"
import { WikiImageBlockEditor } from "./WikiImageBlockEditor"
import { WikiQuoteBlockEditor } from "./WikiQuoteBlockEditor"
import { WikiRichTextEditor } from "./WikiRichTextEditor"

const COMPONENT_LABELS: Record<string, string> = {
  "content.rich-text": "Text",
  "content.image-block": "Image",
  "content.code-block": "Code",
  "content.quote-block": "Quote",
  "content.callout": "Callout",
}

export function WikiBlockCard({
  block,
  index,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  isFirst,
  isLast,
}: {
  readonly block: WikiDraftBlock
  readonly index: number
  readonly onChange: (updated: WikiDraftBlock) => void
  readonly onMoveUp: () => void
  readonly onMoveDown: () => void
  readonly onDelete: () => void
  readonly isFirst: boolean
  readonly isLast: boolean
}) {
  const label = COMPONENT_LABELS[block.__component] ?? block.__component

  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      {/* Block header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: T.bg.surface,
          borderBottom: `1px solid ${T.border.line}`,
        }}
      >
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.ink.low,
          }}
        >
          Block {index + 1} · {label}
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            style={{
              background: "none",
              border: "none",
              cursor: isFirst ? "default" : "pointer",
              color: isFirst ? T.ink.faint : T.ink.low,
              padding: "2px",
            }}
            title="Move up"
            aria-label="Move block up"
          >
            <Icon icon="mdi:chevron-up" width={14} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            style={{
              background: "none",
              border: "none",
              cursor: isLast ? "default" : "pointer",
              color: isLast ? T.ink.faint : T.ink.low,
              padding: "2px",
            }}
            title="Move down"
            aria-label="Move block down"
          >
            <Icon icon="mdi:chevron-down" width={14} />
          </button>
          <button
            onClick={onDelete}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: T.accent.danger,
              padding: "2px",
              marginLeft: "4px",
            }}
            title="Delete block"
            aria-label="Delete block"
          >
            <Icon icon="mdi:trash-can-outline" width={14} />
          </button>
        </div>
      </div>

      {/* Block editor */}
      <div style={{ padding: "12px" }}>
        {block.__component === "content.rich-text" && (
          <WikiRichTextEditor
            block={block}
            onChange={onChange as (b: typeof block) => void}
          />
        )}
        {block.__component === "content.image-block" && (
          <WikiImageBlockEditor
            block={block}
            onChange={onChange as (b: typeof block) => void}
          />
        )}
        {block.__component === "content.code-block" && (
          <WikiCodeBlockEditor
            block={block}
            onChange={onChange as (b: typeof block) => void}
          />
        )}
        {block.__component === "content.quote-block" && (
          <WikiQuoteBlockEditor
            block={block}
            onChange={onChange as (b: typeof block) => void}
          />
        )}
        {block.__component === "content.callout" && (
          <WikiCalloutBlockEditor
            block={block}
            onChange={onChange as (b: typeof block) => void}
          />
        )}
      </div>
    </div>
  )
}
