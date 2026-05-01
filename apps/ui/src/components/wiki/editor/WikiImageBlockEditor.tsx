"use client"

import { useRef, useState } from "react"

import { T } from "@/lib/design-tokens"
import type { WikiImageDraftBlock } from "@/lib/wikiEditorUtils"

export function WikiImageBlockEditor({
  block,
  onChange,
}: {
  readonly block: WikiImageDraftBlock
  readonly onChange: (updated: WikiImageDraftBlock) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("files", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (!res.ok) {
        let message = "Upload failed"
        try {
          message = (await res.json()).error ?? message
        } catch {
          /* non-JSON error body */
        }
        throw new Error(message)
      }
      const { id, url } = await res.json()
      onChange({ ...block, imageId: id, previewUrl: url })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {block.previewUrl ? (
        <div style={{ position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.previewUrl}
            alt="block preview"
            style={{
              width: "100%",
              maxHeight: "240px",
              objectFit: "cover",
              borderRadius: "6px",
              border: `1px solid ${T.border.line}`,
            }}
          />
          <button
            onClick={() =>
              onChange({ ...block, imageId: undefined, previewUrl: undefined })
            }
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              background: "rgba(0,0,0,.6)",
              border: "none",
              borderRadius: "4px",
              color: T.ink.dim,
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              padding: "4px 8px",
              cursor: "pointer",
            }}
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            width: "100%",
            height: "80px",
            background: "rgba(255,255,255,.03)",
            border: `1px dashed ${T.border.hi}`,
            borderRadius: "6px",
            color: T.ink.low,
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            cursor: uploading ? "wait" : "pointer",
          }}
        >
          {uploading ? "Uploading…" : "Click to upload image"}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />

      {error && (
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            color: T.accent.danger,
          }}
        >
          {error}
        </span>
      )}

      <input
        type="text"
        value={block.caption ?? ""}
        onChange={(e) => onChange({ ...block, caption: e.target.value })}
        placeholder="Caption (optional)"
        style={{
          background: "rgba(255,255,255,.04)",
          border: `1px solid ${T.border.line}`,
          borderRadius: "6px",
          color: T.ink.base,
          fontFamily: T.font.sans,
          fontSize: "13px",
          padding: "8px 12px",
          outline: "none",
        }}
      />

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={block.fullWidth ?? false}
          onChange={(e) => onChange({ ...block, fullWidth: e.target.checked })}
        />
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            color: T.ink.low,
            letterSpacing: ".1em",
            textTransform: "uppercase",
          }}
        >
          Full width
        </span>
      </label>
    </div>
  )
}
