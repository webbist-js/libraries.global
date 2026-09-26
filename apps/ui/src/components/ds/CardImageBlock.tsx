import type { ReactNode } from "react"

interface CardImageBlockProps {
  readonly imageUrl?: string | null
  readonly alt?: string
  readonly aspectRatio?: string
  readonly maxHeight?: number
  readonly topLeft?: ReactNode
  readonly topRight?: ReactNode
}

export function CardImageBlock({
  imageUrl,
  alt = "",
  aspectRatio = "4/3",
  maxHeight = 180,
  topLeft,
  topRight,
}: CardImageBlockProps) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio,
        maxHeight: `${maxHeight}px`,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={alt}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "saturate(0.7) brightness(0.85)",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(5,8,22,0.6) 0%, rgba(5,8,22,0) 40%, rgba(5,8,22,0) 60%, rgba(5,8,22,0.75) 100%)",
              pointerEvents: "none",
            }}
          />
        </>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `
              radial-gradient(ellipse 90% 70% at 20% 30%, rgba(67,56,202,0.08), transparent 60%),
              radial-gradient(ellipse 70% 90% at 75% 75%, rgba(163,144,255,0.10), transparent 55%),
              radial-gradient(ellipse 50% 50% at 55% 20%, rgba(232,201,138,0.06), transparent 50%),
              linear-gradient(160deg, #08101f 0%, #060c1a 60%, #070b1e 100%)
            `,
          }}
        />
      )}

      {(topLeft ?? topRight) ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: "10px 12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>{topLeft}</div>
          <div>{topRight}</div>
        </div>
      ) : null}
    </div>
  )
}
