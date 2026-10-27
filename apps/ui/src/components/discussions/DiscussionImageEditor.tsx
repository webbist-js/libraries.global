"use client"

import {
  ChevronDown,
  ImagePlus,
  LockKeyhole,
  Trash2,
  Upload,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useRef, useState } from "react"

import { Input } from "@/components/ui/input"
import { cn, primaryCtaSm } from "@/lib/styles"

import {
  discussionErrorKey,
  uploadDiscussionImage,
  type DiscussionImage,
} from "./api"

export type StagedDiscussionImage = DiscussionImage & { subjectId?: string }

function PictureDetails({
  altText,
  caption,
  disabled,
  onChange,
  number,
}: {
  altText: string
  caption: string
  disabled?: boolean
  onChange: (details: { altText: string; caption: string }) => void
  number?: number
}) {
  const t = useTranslations("discussions")
  const helpId = useId()
  const inputClass =
    "mt-2 min-h-[44px] rounded-xl border-(--t-border-hi) bg-(--t-bg-deep) text-sm shadow-none focus-visible:border-(--t-accent-primary) focus-visible:ring-(--t-accent-primary)/15 md:text-sm dark:bg-(--t-bg-deep)"

  return (
    <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <label className="min-w-0 text-sm font-semibold">
        {t("pictureDescription")}
        <Input
          aria-label={`${t("pictureAlt")}${number ? ` ${number}` : ""}`}
          aria-describedby={helpId}
          value={altText}
          maxLength={250}
          disabled={disabled}
          onChange={(event) =>
            onChange({ altText: event.target.value, caption })
          }
          className={inputClass}
        />
        <span
          id={helpId}
          className="mt-1.5 block text-xs leading-relaxed font-normal text-(--t-ink-dim)"
        >
          {t("pictureDescriptionHelp")}
        </span>
      </label>
      <label className="min-w-0 text-sm font-semibold">
        {t("pictureCaption")}
        <Input
          aria-label={`${t("pictureCaption")}${number ? ` ${number}` : ""}`}
          value={caption}
          maxLength={500}
          disabled={disabled}
          onChange={(event) =>
            onChange({ altText, caption: event.target.value })
          }
          className={inputClass}
        />
      </label>
    </div>
  )
}

/** One private-image interface shared by new messages and versioned edits. */
export function DiscussionImageEditor({
  subjectId,
  images,
  onChange,
  disabled,
  onBusyChange,
  compact = false,
  disclosure = true,
}: {
  subjectId?: string
  images: readonly StagedDiscussionImage[]
  onChange: (images: StagedDiscussionImage[]) => void
  compact?: boolean
  disclosure?: boolean
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

  const content = (
    <div className="grid gap-4 rounded-[18px] border border-(--t-border-line) bg-(--t-bg-deep) p-4 text-base [--spacing:0.25rem] sm:p-5">
      {images.map((image, index) => (
        <figure
          key={image.id}
          className="m-0 grid gap-4 rounded-xl border border-(--t-border-line) p-3 sm:grid-cols-[88px_minmax(0,1fr)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Private previews need the viewer's cookies on the attachment proxy. */}
          <img
            src={`/api/discussions/attachments/${encodeURIComponent(image.id)}`}
            alt={image.altText}
            className="h-24 w-full rounded-lg bg-(--t-bg-surface) object-contain sm:w-[88px]"
          />
          <div className="grid min-w-0 gap-3">
            <PictureDetails
              altText={image.altText}
              caption={image.caption ?? ""}
              number={index + 1}
              disabled={disabled || uploading}
              onChange={(details) =>
                onChange(
                  images.map((item) =>
                    item.id === image.id ? { ...item, ...details } : item
                  )
                )
              }
            />
            <button
              type="button"
              className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full px-2 text-xs font-semibold text-(--t-accent-danger) hover:bg-(--t-bg-surface) disabled:opacity-50"
              disabled={disabled || uploading}
              onClick={() =>
                onChange(images.filter((item) => item.id !== image.id))
              }
            >
              <Trash2 size={13} aria-hidden />
              {t("removePicture")}
            </button>
          </div>
        </figure>
      ))}
      {wrongSubject && (
        <p role="alert" className="m-0 text-sm text-(--t-accent-danger)">
          {t("pictureSubjectChanged")}
        </p>
      )}
      {images.length < 3 && (
        <div className="grid gap-4">
          <label
            className={cn(
              "flex min-w-0 items-center gap-4 rounded-xl border border-dashed border-(--t-border-hi) bg-(--t-bg-surface) p-4 focus-within:border-(--t-accent-primary) focus-within:ring-2 focus-within:ring-(--t-accent-primary)/15",
              disabled || uploading
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:border-(--t-accent-primary)"
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--t-palette-violet-soft) text-(--t-accent-primary)">
              <ImagePlus size={19} aria-hidden />
            </span>
            <span className="grid min-w-0 gap-1">
              <span className="text-sm font-semibold">
                {t(selectedFile ? "changePicture" : "choosePicture")}
              </span>
              <span className="text-xs leading-relaxed break-words text-(--t-ink-dim)">
                {selectedFile ? selectedFile.name : t("pictureFormats")}
              </span>
            </span>
            <input
              ref={fileInput}
              aria-label={t("pictureFile")}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading || disabled}
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null)
                setError("")
              }}
              className="sr-only"
            />
          </label>
          {selectedFile && (
            <>
              <PictureDetails
                altText={altText}
                caption={caption}
                disabled={disabled || uploading}
                onChange={(details) => {
                  setAltText(details.altText)
                  setCaption(details.caption)
                }}
              />
              <button
                type="button"
                disabled={disabled || uploading || !altText.trim()}
                aria-busy={uploading}
                className={cn(
                  primaryCtaSm,
                  "min-h-11 justify-self-start disabled:cursor-not-allowed disabled:opacity-50"
                )}
                onClick={upload}
              >
                <Upload size={15} aria-hidden />
                {uploading ? t("sending") : t("stagePicture")}
              </button>
            </>
          )}
        </div>
      )}
      <p className="m-0 flex items-start gap-2 text-xs leading-relaxed text-(--t-ink-dim)">
        <LockKeyhole size={13} className="mt-0.5 shrink-0" aria-hidden />
        {t("picturePrivacy")}
      </p>
      {error && (
        <p role="alert" className="m-0 text-sm text-(--t-accent-danger)">
          {error}
        </p>
      )}
    </div>
  )

  if (!disclosure) return content

  return (
    <details className="group/pictures">
      <summary
        className={cn(
          "flex w-fit cursor-pointer list-none items-center gap-2 rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-4 text-sm font-semibold text-(--t-ink-dim) hover:text-(--t-accent-primary) [&::-webkit-details-marker]:hidden",
          compact ? "min-h-10" : "min-h-11"
        )}
      >
        <ImagePlus size={16} aria-hidden />
        {t("addPictures")}
        {!!images.length && (
          <span className="rounded-full bg-(--t-bg-muted) px-1.5 text-xs">
            {images.length}
          </span>
        )}
        <ChevronDown
          size={14}
          className="group-open/pictures:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="mt-3">{content}</div>
    </details>
  )
}
