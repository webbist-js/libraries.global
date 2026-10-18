/** Shared formatting utilities for blog and wiki article components */

import { articleReadingMinutes, articleText } from "@repo/shared-data"

export function formatDate(
  dateStr?: string | null,
  monthFormat: "long" | "short" = "long",
  locale = "en-GB"
): string | null {
  if (!dateStr) return null

  return new Date(dateStr).toLocaleDateString(locale, {
    day: "numeric",
    month: monthFormat,
    year: "numeric",
  })
}

/** Blog category colour tokens — border, bg, and text in one string */
export const CATEGORY_COLORS: Record<string, string> = {
  Research: "text-indigo-300 border-indigo-400/30 bg-indigo-500/10",
  Tech: "text-cyan-300 border-cyan-400/30 bg-cyan-500/10",
  Culture: "text-amber-300 border-amber-400/30 bg-amber-500/10",
  Editorial: "text-purple-300 border-purple-400/30 bg-purple-500/10",
  Preservation: "text-emerald-300 border-emerald-400/30 bg-emerald-500/10",
  Ethics: "text-rose-300 border-rose-400/30 bg-rose-500/10",
}

/** Cyclic accent palette for wiki category cards */
export const CATEGORY_ACCENTS = [
  {
    leftBorder: "border-l-indigo-500/60",
    dot: "bg-indigo-400",
    label: "text-indigo-300",
  },
  {
    leftBorder: "border-l-cyan-500/60",
    dot: "bg-cyan-400",
    label: "text-cyan-300",
  },
  {
    leftBorder: "border-l-amber-500/60",
    dot: "bg-amber-400",
    label: "text-amber-300",
  },
  {
    leftBorder: "border-l-emerald-500/60",
    dot: "bg-emerald-400",
    label: "text-emerald-300",
  },
  {
    leftBorder: "border-l-purple-500/60",
    dot: "bg-purple-400",
    label: "text-purple-300",
  },
  {
    leftBorder: "border-l-rose-500/60",
    dot: "bg-rose-400",
    label: "text-rose-300",
  },
] as const

/** Reading time from visible article text, regardless of block grouping. */
export function estimateReadingTime(
  blocks?: readonly unknown[] | null
): number {
  return articleReadingMinutes(blocks)
}

export function countWords(blocks?: readonly unknown[] | null): number {
  return articleText(blocks).split(/\s+/u).filter(Boolean).length
}

/** Compact relative date: "2d ago", "3w ago", "1mo ago" */
export function formatRelativeDate(dateStr?: string | null): string | null {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)

  return `${months}mo ago`
}

type BlockNode = {
  type?: string
  level?: number
  children?: { text?: string }[]
}

/**
 * Extract heading entries from Strapi dynamic-zone body blocks.
 * Looks inside `content.rich-text` blocks for Strapi Blocks heading nodes.
 */
export function extractHeadings(
  blocks?: readonly { __component: string; body?: unknown }[] | null
): { text: string; level: number; id: string }[] {
  if (!blocks) return []
  const headings: { text: string; level: number; id: string }[] = []

  for (const block of blocks) {
    if (block.__component !== "content.rich-text") continue
    if (!Array.isArray(block.body)) continue

    for (const node of block.body as BlockNode[]) {
      if (node.type === "heading" && Array.isArray(node.children)) {
        const text = node.children
          .map((c) => c.text ?? "")
          .join("")
          .trim()
        if (text) {
          const id =
            "h-" +
            text
              .toLowerCase()
              .replaceAll(/[^a-z0-9\s-]/g, "")
              .replaceAll(/\s+/g, "-")
              .slice(0, 60)
          headings.push({ text, level: node.level ?? 2, id })
        }
      }
    }
  }

  return headings
}
