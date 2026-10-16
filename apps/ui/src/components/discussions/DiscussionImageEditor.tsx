"use client"

import { useTranslations } from "next-intl"
import { useRef, useState } from "react"

import {
  discussionErrorKey,
  uploadDiscussionImage,
  type DiscussionImage,
} from "./api"

export type StagedDiscussionImage = DiscussionImage & { subjectId?: string }

/** One private-image interface shared by new messages and versioned edits. */
export function DiscussionImageEditor({
  subjectId,
  images,
  onChange,
  disabled,
  onBusyChange,
}: {
  subjectId?: string
  images: readonly StagedDiscussionImage[]
  onChange: (images: StagedDiscussionImage[]) => void
  disabled?: boolean
  onBusyChange?: (busy: boolean) => void
}) {
  const t = useTranslations("discussions")
  const fileInput = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [altText, setAltText] = useState("")
  const [caption, setCaption] = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const wrongSubject = images.some(
    (image) => image.subjectId && image.subjectId !== subjectId
  )
  if (!subjectId) return null
  const upload = async () => {
    if (!selectedFile || !altText.trim() || disabled || uploading) return
    if (
      selectedFile.size > 4 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(selectedFile.type)
    ) {
      setError(t("imageLimit"))

      return
    }
    setUploading(true)
    onBusyChange?.(true)
    setError("")
    try {
      const image = await uploadDiscussionImage(
        selectedFile,
        subjectId,
        altText.trim(),
        caption.trim()
      )
      onChange([...images, { ...image, subjectId }])
      setSelectedFile(null)
      setAltText("")
      setCaption("")
      if (fileInput.current) fileInput.current.value = ""
    } catch (failure) {
      setError(t(discussionErrorKey(failure)))
    } finally {
      setUploading(false)
      onBusyChange?.(false)
    }
  }

  return (
    <details className="rounded-xl border border-(--t-border-line) p-4">
      <summary className="text-sm font-semibold">{t("addPictures")}</summary>
      <p className="text-sm text-(--t-ink-dim)">{t("privateImagesLead")}</p>
      {images.map((image, index) => (
        <figure key={image.id} className="m-0 mb-4 grid gap-2">
          <img
            src={`/api/discussions/attachments/${encodeURIComponent(image.id)}`}
            alt={image.altText}
            className="max-h-64 rounded-xl object-contain"
          />
          <label className="text-sm">
            {t("pictureAlt")}
            <input
              aria-label={`${t("pictureAlt")} ${index + 1}`}
              value={image.altText}
              maxLength={250}
              disabled={disabled || uploading}
              onChange={(event) =>
                onChange(
                  images.map((item) =>
                    item.id === image.id
                      ? { ...item, altText: event.target.value }
                      : item
                  )
                )
              }
              className="mt-1 w-full rounded-xl border p-2"
            />
          </label>
          <label className="text-sm">
            {t("pictureCaption")}
            <input
              aria-label={`${t("pictureCaption")} ${index + 1}`}
              value={image.caption ?? ""}
              maxLength={500}
              disabled={disabled || uploading}
              onChange={(event) =>
                onChange(
                  images.map((item) =>
                    item.id === image.id
                      ? { ...item, caption: event.target.value }
                      : item
                  )
                )
              }
              className="mt-1 w-full rounded-xl border p-2"
            />
          </label>
          <button
            type="button"
            className="justify-self-start text-sm underline"
            disabled={disabled || uploading}
            onClick={() =>
              onChange(images.filter((item) => item.id !== image.id))
            }
          >
            {t("removePicture")}
          </button>
        </figure>
      ))}
      {wrongSubject && (
        <p role="alert" className="text-sm">
          {t("pictureSubjectChanged")}
        </p>
      )}
      {images.length < 3 && (
        <div className="grid gap-3">
          <label className="text-sm">
            {t("pictureFile")}
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading || disabled}
              onChange={(event) =>
                setSelectedFile(event.target.files?.[0] ?? null)
              }
              className="mt-1 block max-w-full text-sm"
            />
          </label>
          <label className="text-sm">
            {t("pictureAlt")}
            <input
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
              maxLength={250}
              className="mt-1 w-full rounded-xl border bg-transparent p-2"
            />
          </label>
          <label className="text-sm">
            {t("pictureCaption")}
            <input
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              maxLength={500}
              className="mt-1 w-full rounded-xl border bg-transparent p-2"
            />
          </label>
          <button
            type="button"
            disabled={disabled || uploading || !selectedFile || !altText.trim()}
            className="justify-self-start rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-50"
            onClick={upload}
          >
            {uploading ? t("sending") : t("stagePicture")}
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  )
}
