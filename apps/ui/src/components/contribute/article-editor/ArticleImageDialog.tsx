"use client"

import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  clampPosition,
  imageCrop,
  imagePreviewUrl,
  prepareArticleImage,
  type ImageDimensions,
  type ImagePosition,
} from "./imagePreparation"

const field =
  "min-h-[44px] w-full rounded-xl border border-(--t-border-hi) bg-(--t-bg-deep) px-3 py-2 text-base font-normal"
const centered = { x: 50, y: 50 }

export function ArticleImageDialog({
  file,
  requireCredit,
  readOnly,
  onClose,
  onChooseAnother,
  onInsert,
}: {
  readonly file: File
  readonly requireCredit: boolean
  readonly readOnly: boolean
  readonly onClose: () => void
  readonly onChooseAnother: () => void
  readonly onInsert: (
    file: File,
    alt: string,
    credit: string
  ) => Promise<boolean>
}) {
  const t = useTranslations("articleImage")
  const ui = useTranslations("ui")
  const p = useTranslations("publishing")
  const w = useTranslations("writeWorkspace")
  const [preview, setPreview] = useState("")
  const [name, setName] = useState(
    file.name.replace(/\.(jpe?g|png|webp)$/i, "")
  )
  const [alt, setAlt] = useState("")
  const [credit, setCredit] = useState("")
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null)
  const [aspect, setAspect] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState<ImagePosition>(centered)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<"invalid" | "upload" | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const drag = useRef<{ x: number; y: number; position: ImagePosition } | null>(
    null
  )
  const validFile =
    ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
    file.size > 0 &&
    file.size <= 10 * 1024 * 1024

  useEffect(() => {
    if (!validFile) return
    const url = URL.createObjectURL(file)
    setPreview(url)

    return () => URL.revokeObjectURL(url)
  }, [file, validFile])

  const crop = dimensions ? imageCrop(dimensions, aspect, zoom, position) : null
  const ratio = (crop?.width ?? 16) / (crop?.height ?? 9)
  const locked = busy || readOnly
  const invalid = !validFile || error === "invalid"
  const canInsert = canInsertImage({
    locked,
    invalid,
    dimensions,
    name,
    alt,
    credit,
    requireCredit,
  })

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-[24px] border-(--t-border-line) bg-(--t-bg-deep) text-(--t-ink-base) shadow-none sm:max-w-3xl"
        showCloseButton={!busy}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          titleRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="pr-8 text-left">
          <DialogTitle
            ref={titleRef}
            tabIndex={-1}
            className="type-h2 outline-none"
          >
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col gap-5"
          aria-busy={busy}
          onSubmit={async (event) => {
            event.preventDefault()
            if (!canInsert || !imageRef.current) return
            setBusy(true)
            setError(null)
            try {
              const prepared = await prepareArticleImage(
                file,
                name,
                imageRef.current,
                aspect === null ? null : crop
              )
              if (await onInsert(prepared, alt.trim(), credit.trim())) onClose()
              else setError("upload")
            } catch {
              setError("upload")
            } finally {
              setBusy(false)
            }
          }}
        >
          <div className="min-h-0 overflow-y-auto">
            <fieldset
              disabled={locked}
              className="m-0 grid min-w-0 gap-5 border-0 p-0 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
            >
              <div className="grid content-start gap-3">
                <div className="flex min-h-[180px] items-center justify-center rounded-2xl bg-(--t-bg-muted) p-3">
                  {!invalid && preview ? (
                    <div
                      className="relative w-full overflow-hidden rounded-lg"
                      style={{
                        aspectRatio: ratio,
                        maxWidth: 220 * ratio,
                        cursor: aspect === null ? "default" : "grab",
                        touchAction: aspect === null ? "pan-y" : "none",
                      }}
                      onPointerDown={(event) => {
                        if (!crop || aspect === null || locked) return
                        event.currentTarget.setPointerCapture(event.pointerId)
                        drag.current = {
                          x: event.clientX,
                          y: event.clientY,
                          position,
                        }
                      }}
                      onPointerMove={(event) => {
                        if (!drag.current || !crop || !dimensions) return
                        const bounds =
                          event.currentTarget.getBoundingClientRect()
                        const availableX = dimensions.width - crop.width
                        const availableY = dimensions.height - crop.height
                        setPosition({
                          x:
                            availableX > 0
                              ? clampPosition(
                                  drag.current.position.x -
                                    ((((event.clientX - drag.current.x) /
                                      bounds.width) *
                                      crop.width) /
                                      availableX) *
                                      100
                                )
                              : 50,
                          y:
                            availableY > 0
                              ? clampPosition(
                                  drag.current.position.y -
                                    ((((event.clientY - drag.current.y) /
                                      bounds.height) *
                                      crop.height) /
                                      availableY) *
                                      100
                                )
                              : 50,
                        })
                      }}
                      onPointerUp={() => {
                        drag.current = null
                      }}
                      onPointerCancel={() => {
                        drag.current = null
                      }}
                    >
                      {/* The local blob is previewed directly, before it is uploaded. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        ref={imageRef}
                        src={imagePreviewUrl(preview)}
                        alt={alt || t("preview")}
                        draggable={false}
                        className="absolute max-w-none select-none"
                        style={
                          crop && dimensions
                            ? {
                                width: `${(dimensions.width / crop.width) * 100}%`,
                                height: `${(dimensions.height / crop.height) * 100}%`,
                                left: `${(-crop.x / crop.width) * 100}%`,
                                top: `${(-crop.y / crop.height) * 100}%`,
                              }
                            : {
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                              }
                        }
                        onLoad={(event) => {
                          const { naturalWidth: width, naturalHeight: height } =
                            event.currentTarget
                          if (
                            !width ||
                            !height ||
                            width * height > 20_000_000
                          ) {
                            setError("invalid")

                            return
                          }
                          setDimensions({ width, height })
                        }}
                        onError={() => setError("invalid")}
                      />
                    </div>
                  ) : (
                    <p className="m-0 text-sm text-(--t-ink-dim)">
                      {t("preview")}
                    </p>
                  )}
                </div>
                <label className="grid gap-1.5 text-sm font-semibold">
                  {t("crop")}
                  <select
                    className={field}
                    value={aspect ?? "original"}
                    disabled={invalid || !dimensions}
                    onChange={(event) => {
                      setAspect(
                        event.target.value === "original"
                          ? null
                          : Number(event.target.value)
                      )
                      setZoom(1)
                      setPosition(centered)
                    }}
                  >
                    <option value="original">{t("original")}</option>
                    <option value={16 / 9}>{t("landscape")}</option>
                    <option value={1}>{t("square")}</option>
                    <option value={4 / 5}>{t("portrait")}</option>
                  </select>
                </label>
                {aspect !== null && (
                  <>
                    <p className="m-0 text-sm text-(--t-ink-dim)">
                      {t("positionHint")}
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <label className="col-span-2 grid gap-1 text-sm">
                        {t("zoom")}
                        <input
                          type="range"
                          min={1}
                          max={3}
                          step={0.01}
                          value={zoom}
                          onChange={(event) =>
                            setZoom(Number(event.target.value))
                          }
                          className="h-8 w-full accent-(--t-accent-primary)"
                        />
                      </label>
                      <label className="grid gap-1 text-sm">
                        {t("horizontal")}
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={position.x}
                          disabled={
                            !dimensions ||
                            !crop ||
                            dimensions.width - crop.width < 1
                          }
                          onChange={(event) =>
                            setPosition({
                              ...position,
                              x: Number(event.target.value),
                            })
                          }
                          className="h-8 w-full accent-(--t-accent-primary)"
                        />
                      </label>
                      <label className="grid gap-1 text-sm">
                        {t("vertical")}
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={position.y}
                          disabled={
                            !dimensions ||
                            !crop ||
                            dimensions.height - crop.height < 1
                          }
                          onChange={(event) =>
                            setPosition({
                              ...position,
                              y: Number(event.target.value),
                            })
                          }
                          className="h-8 w-full accent-(--t-accent-primary)"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      className="min-h-11 justify-self-start text-sm font-semibold text-(--t-accent-primary) underline"
                      onClick={() => {
                        setAspect(null)
                        setZoom(1)
                        setPosition(centered)
                      }}
                    >
                      {t("reset")}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={onChooseAnother}
                  className="min-h-11 justify-self-start text-sm font-semibold text-(--t-accent-primary) underline"
                >
                  {t("chooseAnother")}
                </button>
              </div>
              <div className="grid content-start gap-4">
                <label className="grid gap-1.5 text-sm font-semibold">
                  {t("filename")}
                  <input
                    className={field}
                    value={name}
                    required
                    maxLength={100}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  {ui("alt_text")}
                  <textarea
                    className={field}
                    rows={3}
                    value={alt}
                    required
                    maxLength={500}
                    onChange={(event) => setAlt(event.target.value)}
                    aria-describedby="article-image-alt-hint"
                  />
                </label>
                <p
                  id="article-image-alt-hint"
                  className="m-0 text-sm text-(--t-ink-dim)"
                >
                  {p("imageAltRequired")}
                </p>
                <label className="grid gap-1.5 text-sm font-semibold">
                  {w("imageCredit")}
                  <textarea
                    className={field}
                    rows={3}
                    value={credit}
                    required={requireCredit}
                    maxLength={500}
                    onChange={(event) => setCredit(event.target.value)}
                  />
                </label>
                <p className="m-0 text-sm text-(--t-ink-dim)">
                  {t(requireCredit ? "creditRequired" : "creditHint")}
                </p>
              </div>
            </fieldset>
          </div>
          {(invalid || error === "upload") && (
            <p role="alert" className="m-0 text-sm text-(--t-accent-danger)">
              {invalid ? t("invalid") : p("imageFailed")}
            </p>
          )}
          <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-(--t-border-line) pt-4">
            <Button
              type="button"
              variant="surface"
              size="pill"
              disabled={busy}
              onClick={onClose}
            >
              {ui("cancel")}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="pill"
              disabled={!canInsert}
            >
              {busy ? t("uploading") : p("insertImage")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function canInsertImage({
  locked,
  invalid,
  dimensions,
  name,
  alt,
  credit,
  requireCredit,
}: {
  locked: boolean
  invalid: boolean
  dimensions: ImageDimensions | null
  name: string
  alt: string
  credit: string
  requireCredit: boolean
}) {
  return (
    !locked &&
    !invalid &&
    dimensions !== null &&
    name.trim().length > 0 &&
    alt.trim().length > 0 &&
    (!requireCredit || credit.trim().length > 0)
  )
}
