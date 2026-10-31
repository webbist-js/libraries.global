import { TYPE_TINT } from "@/lib/design-tokens"

/** Avatar tints cycle by rank, as in the mockup: purple, blue, green, rust, neutral. */
const RANK_TINTS = [
  TYPE_TINT.national,
  TYPE_TINT.academic,
  TYPE_TINT.public,
  TYPE_TINT.special,
  TYPE_TINT.neutral,
] as const

export function rankTint(rank: number): { bg: string; fg: string } {
  return (
    RANK_TINTS[(Math.max(1, rank) - 1) % RANK_TINTS.length] ?? TYPE_TINT.neutral
  )
}

export const fmt = (n: number) => n.toLocaleString("en-GB")
