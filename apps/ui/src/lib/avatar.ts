import { formatStrapiMediaUrlForClient } from "@/lib/strapi-helpers"
import type { AvatarMedia } from "@/lib/types/profile"

/**
 * Strapi's resized copies to try for each display size, smallest first.
 * `thumbnail` is about 156px tall, `small` about 500px: enough for a 56px
 * form avatar and a 128px profile avatar on a 2x screen.
 */
const FORMATS = {
  sm: ["thumbnail", "small"],
  lg: ["small", "medium"],
} as const

/**
 * A profile avatar's `src` for the browser: a resized copy where Strapi made
 * one, through the asset proxy for local `/uploads/...` files (a bare
 * `/uploads` path 404s on the Next origin). Null when there's no avatar.
 */
export function avatarSrc(
  avatar: AvatarMedia | null | undefined,
  size: keyof typeof FORMATS = "sm"
): string | null {
  if (!avatar?.url) return null
  const resized = FORMATS[size]
    .map((name) => avatar.formats?.[name]?.url)
    .find(Boolean)

  return formatStrapiMediaUrlForClient(resized ?? avatar.url) ?? null
}

/** Readable fallback for names and handles, including legacy usernames. */
export function avatarInitials(name?: string | null): string {
  return (
    (name ?? "")
      .replace(/^@+/, "")
      .trim()
      .split(/[\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => Array.from(part)[0] ?? "")
      .join("")
      .toUpperCase() || "?"
  )
}
