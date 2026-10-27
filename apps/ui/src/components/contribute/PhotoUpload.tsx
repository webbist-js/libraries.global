"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useId, useState } from "react"

import { T } from "@/lib/design-tokens"

import { Label, SECONDARY } from "./wizard-ui"
import type { WizardDraft } from "./wizard.logic"

/**
 * Uploads one photo for a contribution (JPEG, PNG or WebP, up to 10 MB)
 * through /api/submissions/upload-image, then previews it with "Replace".
 */
export function PhotoUpload({
  photo,
  onChange,
}: {
  readonly photo: WizardDraft["photo"]
  readonly onChange: (photo: WizardDraft["photo"]) => void
}) {
  const tUi = useUiTranslations("ui")

  const id = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/submissions/upload-image", {
        method: "POST",
        body: form,
      })
      const json = (await res.json()) as {
        id?: number
        url?: string
        error?: string
      }
      if (!res.ok || !json.id || !json.url)
        setError(json.error ?? "Upload failed.")
      else onChange({ id: json.id, url: json.url })
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Label htmlFor={id} hint={tUi("jpeg_png_or_webp_up_to_10_mb")}>
        {tUi("photo")}{" "}
      </Label>
      {photo ? (
        <div className="flex flex-wrap items-end gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- a just-uploaded preview */}
          <img
            alt={tUi("your_photo")}
            className="h-40 w-auto max-w-full rounded-[14px] border object-cover"
            src={photo.url}
            style={{ borderColor: T.border.line }}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`${SECONDARY} h-10 px-4 text-base`}
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            Replace
          </button>
        </div>
      ) : (
        <label
          className="flex cursor-pointer flex-col items-center gap-2 rounded-[16px] border-2 border-dashed px-6 py-8 text-center focus-within:border-(--t-accent-primary)"
          htmlFor={id}
          style={{ borderColor: T.border.hi, background: T.bg.surface }}
        >
          <Icon
            aria-hidden="true"
            height={26}
            icon={busy ? "mdi:loading" : "mdi:camera-outline"}
            className={
              busy ? "animate-spin motion-reduce:animate-none" : undefined
            }
            style={{ color: T.accent.primary }}
            width={26}
          />
          <span
            className="text-base font-semibold"
            style={{ color: T.ink.base }}
          >
            {busy ? "Uploading…" : "Choose a photo"}
          </span>
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            id={id}
            onChange={(e) => void upload(e.target.files?.[0])}
            type="file"
          />
        </label>
      )}
      {error ? (
        <p
          className="mt-2 mb-0 text-sm font-semibold"
          role="alert"
          style={{ color: T.accent.danger }}
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
