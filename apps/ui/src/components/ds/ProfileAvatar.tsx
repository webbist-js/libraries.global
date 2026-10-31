"use client"

import { useState, type ReactNode } from "react"

import { cn } from "@/lib/styles"

/** Shared person-image/fallback rendering. Hosts own names, links, palettes and permissions. */
export function ProfileAvatar({
  src,
  initials,
  fallback,
  size = 40,
  palette,
  className,
  label,
}: {
  readonly src?: string | null
  readonly initials?: string | null
  readonly fallback?: ReactNode
  readonly size?: number | "css"
  readonly palette?: { readonly bg: string; readonly fg: string }
  readonly className?: string
  /** Omit when the person's name already appears beside the avatar. */
  readonly label?: string
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const visibleSrc = src && src !== failedSrc ? src : null

  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-sans font-semibold",
        className
      )}
      style={{
        width: size === "css" ? undefined : size,
        height: size === "css" ? undefined : size,
        background: visibleSrc
          ? "transparent"
          : (palette?.bg ?? "var(--t-bg-muted)"),
        color: palette?.fg ?? "var(--t-ink-dim)",
      }}
    >
      {visibleSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- Private and blob avatar URLs bypass the public optimizer and keep native error fallback.
        <img
          src={visibleSrc}
          alt=""
          width={size === "css" ? 72 : size}
          height={size === "css" ? 72 : size}
          className="size-full object-cover"
          onError={() => setFailedSrc(visibleSrc)}
        />
      ) : (
        <span>{initials?.trim() || fallback || "?"}</span>
      )}
    </span>
  )
}
