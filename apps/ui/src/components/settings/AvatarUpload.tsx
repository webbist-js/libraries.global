"use client"

import { profilePalette, type ProfileBackground } from "@repo/shared-data"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { T } from "@/lib/design-tokens"

export function AvatarUpload({
  currentUrl,
  initials,
  onUpload,
  uploadEnabled = true,
  background,
}: {
  currentUrl?: string | null
  initials: string
  onUpload: (url: string) => void
  uploadEnabled?: boolean
  background?: ProfileBackground | null
}) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const inputRef = useRef<HTMLInputElement>(null)
  const palette = profilePalette(background)

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

    // Keep the current avatar until the server validates and re-encodes the file.
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
      if (!json.url) {
        toast.error("Upload failed")
        setPreview(currentUrl ?? null)

        return
      }
      setPreview(json.url)
      onUpload(json.url)
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
      {/* A second way in for pointer users; the labelled button beside it is
          the one keyboard and screen-reader users reach. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || !uploadEnabled}
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: preview ? "transparent" : palette.bg,
          border: `1px solid ${uploading ? T.accent.primary : T.border.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: T.font.sans,
          fontSize: "var(--type-body-xl-size)",
          fontWeight: 500,
          color: palette.fg,
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
            alt=""
            width={56}
            height={56}
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
          disabled={uploading || !uploadEnabled}
          style={{
            padding: "10px 18px",
            minHeight: "44px",
            borderRadius: "999px",
            border: `1px solid ${T.border.hi}`,
            background: T.bg.deep,
            color: T.ink.base,
            fontSize: "var(--type-body-small-size)",
            fontWeight: 600,
            fontFamily: T.font.sans,
            cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? "Uploading…" : "Upload new photo"}
        </button>
        <p
          style={{
            margin: "6px 0 0",
            fontSize: "var(--type-body-small-size)",
            color: T.ink.dim,
            fontFamily: T.font.sans,
          }}
        >
          {uploadEnabled
            ? "JPG, PNG, WebP or GIF, up to 5 MB"
            : "Photo uploads are not configured on this server."}
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
