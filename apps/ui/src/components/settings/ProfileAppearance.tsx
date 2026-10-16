"use client"

import {
  COMMUNITY_PALETTE,
  profilePalette,
  type ProfileBackground,
} from "@repo/shared-data"
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { T } from "@/lib/design-tokens"
import { useRouter } from "@/lib/navigation"

export function ProfileAppearance({
  background,
  onBackgroundChange,
  coverUrl,
  onCoverChange,
  uploadEnabled = true,
}: {
  background: ProfileBackground
  onBackgroundChange: (value: ProfileBackground) => void
  coverUrl: string
  onCoverChange: (url: string) => void
  uploadEnabled?: boolean
}) {
  const router = useRouter()
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const request = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const palette = profilePalette(background)
  useEffect(
    () => () => {
      request.current?.abort()
    },
    []
  )

  async function updateCover(file?: File) {
    const invalid = file
      ? file.size > 5 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type)
      : false
    if (invalid) {
      toast.error("Choose a JPG, PNG or WebP image up to 5 MB")

      return
    }
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    try {
      const body = new FormData()
      if (file) body.append("file", file)
      const res = await fetch("/api/profile/me/cover", {
        method: file ? "POST" : "DELETE",
        ...(file ? { body } : {}),
        signal: controller.signal,
      })
      const json = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || (file && !json.url))
        throw new Error(json.error ?? "Cover update failed")
      onCoverChange(file ? json.url! : "")
      router.refresh()
      toast.success(file ? "Cover photo updated" : "Cover photo removed")
    } catch (error) {
      if (!controller.signal.aborted)
        toast.error(
          error instanceof Error ? error.message : "Cover update failed"
        )
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
      style={{ borderColor: T.border.line }}
    >
      <div>
        <h3 className="m-0 text-lg font-semibold">Profile background</h3>
        <p className="mt-1 text-sm" style={{ color: T.ink.dim }}>
          Choose a colour or upload a cover photo. Your colour is saved with the
          rest of your profile.
        </p>
      </div>
      <div
        className="relative flex h-28 items-end overflow-hidden rounded-xl p-4 sm:h-36"
        style={{ background: palette.bg, color: palette.fg }}
        aria-label="Profile background preview"
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span
            className="text-2xl italic"
            style={{ fontFamily: T.font.serif }}
          >
            A place for your library stories.
          </span>
        )}
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Colour palette</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {COMMUNITY_PALETTE.map((choice) => (
            <label
              key={choice.key}
              className="relative flex min-h-14 cursor-pointer items-center justify-center rounded-xl border-2 px-2 text-sm font-semibold has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--t-accent-primary)"
              style={{
                background: choice.bg,
                color: choice.fg,
                borderColor:
                  background === choice.key ? choice.fg : "transparent",
              }}
            >
              <input
                type="radio"
                className="sr-only"
                name={`${id}-background`}
                value={choice.key}
                checked={background === choice.key}
                onChange={() => onBackgroundChange(choice.key)}
              />
              {background === choice.key ? (
                <span className="mr-1" aria-hidden="true">
                  ✓
                </span>
              ) : null}
              {choice.label}
            </label>
          ))}
        </div>
      </fieldset>
      {coverUrl ? (
        <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
          Your cover photo takes precedence. Remove it to show your selected
          colour.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="pill"
          variant="surface"
          disabled={busy || !uploadEnabled}
          onClick={() => input.current?.click()}
        >
          {busy
            ? "Updating…"
            : coverUrl
              ? "Replace cover photo"
              : "Upload cover photo"}
        </Button>
        {coverUrl ? (
          <Button
            type="button"
            size="pill"
            variant="ghost"
            disabled={busy}
            onClick={() => void updateCover()}
          >
            Remove cover photo
          </Button>
        ) : null}
        <span className="text-sm" style={{ color: T.ink.dim }}>
          {uploadEnabled
            ? "JPG, PNG or WebP · up to 5 MB. Photo changes save immediately."
            : "Cover uploads are not configured here. You can still choose a colour."}
        </span>
      </div>
      <input
        ref={input}
        type="file"
        aria-label="Choose cover photo"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file) void updateCover(file)
        }}
      />
    </div>
  )
}
