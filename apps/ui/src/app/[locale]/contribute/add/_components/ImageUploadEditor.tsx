"use client"

import { useRef, useState } from "react"

import { T } from "@/lib/design-tokens"

import type { UploadedImage } from "./wizard.types"

export function ImageUploadEditor({
  images,
  onChange,
}: {
  images: UploadedImage[]
  onChange: (imgs: UploadedImage[]) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)
    setUploading(true)
    const results: UploadedImage[] = []
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append("file", file)
      try {
        const res = await fetch("/api/submissions/upload-image", {
          method: "POST",
          body: fd,
        })
        const json = (await res.json()) as {
          id?: number
          url?: string
          error?: string
        }
        if (!res.ok || !json.id) {
          setError(json.error ?? "Upload failed")
          continue
        }
        results.push({ strapiId: json.id, url: json.url!, isHero: false })
      } catch {
        setError("Upload failed — please try again.")
      }
    }
    if (results.length > 0) {
      const combined = [...images, ...results]
      const hasHero = combined.some((img) => img.isHero)
      onChange(
        hasHero
          ? combined
          : combined.map((img, i) => ({ ...img, isHero: i === 0 }))
      )
    }
    setUploading(false)
  }

  const setHero = (idx: number) => {
    onChange(images.map((img, i) => ({ ...img, isHero: i === idx })))
  }

  const remove = (idx: number) => {
    const next = images.filter((_, i) => i !== idx)
    const removedWasHero = images[idx]?.isHero ?? false
    if (removedWasHero && next.length > 0 && next[0]) {
      next[0] = { ...next[0], isHero: true }
    }
    onChange(next)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          padding: "28px 20px",
          borderRadius: "10px",
          border: `1.5px dashed ${uploading ? T.border.line : T.border.hi}`,
          background: T.bg.surface,
          color: uploading ? T.ink.faint : T.ink.dim,
          fontFamily: T.font.sans,
          fontSize: "13px",
          cursor: uploading ? "not-allowed" : "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          transition: "border-color .15s, color .15s",
          width: "100%",
        }}
      >
        <span style={{ fontSize: "22px", opacity: 0.5 }}>↑</span>
        <span>{uploading ? "Uploading…" : "Click to select images"}</span>
        <span
          style={{
            fontSize: "13px",
            color: T.ink.faint,
            marginTop: "2px",
          }}
        >
          JPEG · PNG · WebP · max 10 MB each
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        style={{ display: "none" }}
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {error && (
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.accent.danger,
            margin: 0,
          }}
        >
          ⚠ {error}
        </p>
      )}

      {images.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "10px",
          }}
        >
          {images.map((img, i) => (
            <div
              key={img.strapiId}
              style={{
                position: "relative",
                borderRadius: "10px",
                overflow: "hidden",
                border: img.isHero
                  ? `2px solid ${T.accent.primary}`
                  : `1px solid ${T.border.line}`,
                background: T.bg.deep,
                aspectRatio: "4/3",
              }}
            >
              <img
                src={img.url}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />

              {img.isHero && (
                <div
                  style={{
                    position: "absolute",
                    top: "6px",
                    left: "6px",
                    fontFamily: T.font.sans,
                    fontSize: "13px",
                    color: "#fff",
                    background: T.accent.primary,
                    padding: "2px 7px",
                    borderRadius: "4px",
                    fontWeight: 700,
                  }}
                >
                  Hero
                </div>
              )}

              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  display: "flex",
                  gap: "4px",
                  padding: "6px",
                  background: "rgba(23,22,43,0.65)",
                }}
              >
                {!img.isHero && (
                  <button
                    type="button"
                    onClick={() => setHero(i)}
                    style={{
                      flex: 1,
                      fontFamily: T.font.sans,
                      fontSize: "13px",
                      color: T.accent.primary,
                      background: T.bg.deep,
                      border: "none",
                      borderRadius: "4px",
                      padding: "3px 4px",
                      cursor: "pointer",
                    }}
                  >
                    Set hero
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  style={{
                    fontFamily: T.font.sans,
                    fontSize: "13px",
                    color: T.accent.danger,
                    background: "var(--tint-special-bg)",
                    border: "none",
                    borderRadius: "4px",
                    padding: "3px 6px",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
