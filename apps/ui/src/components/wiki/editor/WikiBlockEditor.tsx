"use client"

import { Icon } from "@iconify/react"
import { useCallback, useEffect, useRef, useState } from "react"

import { T } from "@/lib/design-tokens"
import {
  articleBodyToWikiDraft,
  wikiDraftToApiPayload,
  type WikiDraftBlock,
  type WikiDraftData,
} from "@/lib/wikiEditorUtils"

import { WikiBlockCard } from "./WikiBlockCard"

const BLOCK_TYPES: {
  component: WikiDraftBlock["__component"]
  label: string
}[] = [
  { component: "content.rich-text", label: "Text" },
  { component: "content.image-block", label: "Image" },
  { component: "content.code-block", label: "Code" },
  { component: "content.quote-block", label: "Quote" },
  { component: "content.callout", label: "Callout" },
]

function makeEmptyBlock(
  component: WikiDraftBlock["__component"]
): WikiDraftBlock {
  switch (component) {
    case "content.rich-text":
      return { __component: "content.rich-text", text: "", _dirty: true }
    case "content.image-block":
      return { __component: "content.image-block" }
    case "content.code-block":
      return { __component: "content.code-block", code: "" }
    case "content.quote-block":
      return { __component: "content.quote-block", quote: "" }
    case "content.callout":
      return { __component: "content.callout", type: "info", body: "" }
  }
}

type SaveState = "idle" | "saving" | "saved" | "error"

export function WikiBlockEditor({
  slug,
  locale,
  body: initialBody,
  existingSubmissionId,
  onSubmissionIdChange,
  editSummary,
  onEditSummaryChange,
}: {
  readonly slug: string
  readonly locale: string
  readonly title?: string
  readonly body: Record<string, unknown>[]
  readonly existingSubmissionId?: number
  readonly onSubmissionIdChange: (id: number) => void
  readonly editSummary: string
  readonly onEditSummaryChange: (v: string) => void
}) {
  const idCounterRef = useRef(0)
  const [blockIds, setBlockIds] = useState<number[]>(() => {
    const initial = articleBodyToWikiDraft(initialBody)

    return initial.map(() => ++idCounterRef.current)
  })
  const [blocks, setBlocks] = useState<WikiDraftBlock[]>(() =>
    articleBodyToWikiDraft(initialBody)
  )
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const submissionIdRef = useRef<number | undefined>(existingSubmissionId)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)
  const isMountedRef = useRef(true)

  // Cleanup mounted flag on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Sync submissionId from parent (e.g. loaded from GET on mount)
  useEffect(() => {
    submissionIdRef.current = existingSubmissionId
  }, [existingSubmissionId])

  const save = useCallback(
    async (currentBlocks: WikiDraftBlock[], currentSummary: string) => {
      setSaveState("saving")
      try {
        const draftData: WikiDraftData = {
          targetSlug: slug,
          locale,
          body: wikiDraftToApiPayload(currentBlocks),
          editSummary: currentSummary,
        }

        if (!submissionIdRef.current) {
          // Create new draft submission
          const res = await fetch(`/api/contribute/wiki/${slug}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ draftData }),
          })
          if (!res.ok) throw new Error("Create failed")
          const data = await res.json()
          const id = data?.data?.id ?? data?.id
          if (id) {
            submissionIdRef.current = id
            onSubmissionIdChange(id)
          }
        } else {
          // Update existing draft
          const res = await fetch(`/api/contribute/wiki/${slug}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              submissionId: submissionIdRef.current,
              draftData,
            }),
          })
          if (!res.ok) throw new Error("Update failed")
        }

        setSaveState("saved")
        setTimeout(() => {
          if (isMountedRef.current) setSaveState("idle")
        }, 2000)
      } catch {
        setSaveState("error")
      }
    },
    [slug, locale, onSubmissionIdChange]
  )

  // Debounced auto-save on block or summary changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false

      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      save(blocks, editSummary)
    }, 1500)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [blocks, editSummary, save])

  function updateBlock(index: number, updated: WikiDraftBlock) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? updated : b)))
  }

  function moveBlock(index: number, direction: "up" | "down") {
    const swap = direction === "up" ? index - 1 : index + 1
    setBlocks((prev) => {
      const next = [...prev]
      const a = next[index]!
      const b = next[swap]!
      next[index] = b
      next[swap] = a

      return next
    })
    setBlockIds((prev) => {
      const next = [...prev]
      const a = next[index]!
      const b = next[swap]!
      next[index] = b
      next[swap] = a

      return next
    })
  }

  function deleteBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index))
    setBlockIds((prev) => prev.filter((_, i) => i !== index))
  }

  function addBlock(component: WikiDraftBlock["__component"]) {
    const newId = ++idCounterRef.current
    setBlocks((prev) => [...prev, makeEmptyBlock(component)])
    setBlockIds((prev) => [...prev, newId])
  }

  const saveLabel =
    saveState === "saving"
      ? "Saving\u2026"
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? "Save failed"
          : "Auto-save on"

  const saveColor =
    saveState === "error"
      ? T.accent.danger
      : saveState === "saved"
        ? T.accent.ok
        : T.ink.faint

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Save indicator */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: saveColor,
          }}
        >
          {saveLabel}
        </span>
      </div>

      {/* Block list */}
      {blocks.map((block, index) => (
        <WikiBlockCard
          key={blockIds[index]}
          block={block}
          index={index}
          onChange={(updated) => updateBlock(index, updated)}
          onMoveUp={() => moveBlock(index, "up")}
          onMoveDown={() => moveBlock(index, "down")}
          onDelete={() => deleteBlock(index)}
          isFirst={index === 0}
          isLast={index === blocks.length - 1}
        />
      ))}

      {/* Add block row */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          flexWrap: "wrap",
          paddingTop: "4px",
          borderTop: `1px solid ${T.border.line}`,
        }}
      >
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: T.ink.faint,
            display: "flex",
            alignItems: "center",
            marginRight: "4px",
          }}
        >
          Add block
        </span>
        {BLOCK_TYPES.map((bt) => (
          <button
            key={bt.component}
            onClick={() => addBlock(bt.component)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: T.ink.low,
              background: T.bg.surface,
              border: `1px solid ${T.border.line}`,
              borderRadius: "4px",
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            <Icon icon="mdi:plus" width={10} />
            {bt.label}
          </button>
        ))}
      </div>

      {/* Edit summary */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: T.ink.low,
          }}
        >
          Edit summary
        </label>
        <input
          type="text"
          value={editSummary}
          onChange={(e) => onEditSummaryChange(e.target.value)}
          placeholder="Briefly describe your changes\u2026"
          style={{
            background: T.bg.surface,
            border: `1px solid ${T.border.line}`,
            borderRadius: "6px",
            color: T.ink.base,
            fontFamily: T.font.sans,
            fontSize: "13px",
            padding: "10px 12px",
            outline: "none",
          }}
        />
      </div>
    </div>
  )
}
