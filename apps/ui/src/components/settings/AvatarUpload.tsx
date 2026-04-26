"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"

import { T } from "@/lib/design-tokens"

export function AvatarUpload({
  currentUrl,
  initials,
  onUpload,
}: {
  currentUrl?: string | null
  initials: string
  onUpload: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large — max 5 MB")

      return
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    if (!allowed.includes(file.type)) {
      toast.error("Only JPG, PNG, WebP, or GIF allowed")

      return
    }

    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    setUploading(true)

    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/profile/me/avatar", {
        method: "POST",
        body: form,
      })
      const json = (await res.json()) as { url?: string; error?: string }
      if (!res.ok) {
        toast.error(json.error ?? "Upload failed")
        setPreview(currentUrl ?? null)

        return
      }
      onUpload(json.url!)
      toast.success("Avatar updated")
    } catch {
      toast.error("Upload failed")
      setPreview(currentUrl ?? null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: preview ? "transparent" : "rgba(127,223,255,0.15)",
          border: `1px solid ${uploading ? T.accent.aurora : "rgba(127,223,255,0.25)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: T.font.mono,
          fontSize: "18px",
          fontWeight: 600,
          color: T.accent.aurora,
          flexShrink: 0,
          overflow: "hidden",
          cursor: uploading ? "not-allowed" : "pointer",
          opacity: uploading ? 0.6 : 1,
          transition: "opacity 200ms",
          padding: 0,
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="avatar"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "50%",
            }}
          />
        ) : (
          initials
        )}
      </button>

      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            border: `1px solid ${T.border.hi}`,
            background: "rgba(255,255,255,0.05)",
            color: T.ink.dim,
            fontSize: "12px",
            fontFamily: T.font.sans,
            cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? "Uploading…" : "Upload new photo"}
        </button>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: "11px",
            color: T.ink.faint,
            fontFamily: T.font.mono,
          }}
        >
          JPG · PNG · WebP · max 5 MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}
