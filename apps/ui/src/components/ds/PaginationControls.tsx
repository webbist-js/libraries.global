"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/styles"

/** Button pagination for fetched lists; page indexes are zero based. */
export function PaginationControls({
  page,
  pageCount,
  onPage,
  disabled = false,
}: {
  readonly page: number
  readonly pageCount: number
  readonly onPage: (page: number) => void
  readonly disabled?: boolean
}) {
  const t = useTranslations("pagination")
  const last = Math.max(0, pageCount - 1)
  // Neighbouring pages with explicit first/last shortcuts keep long lists reachable.
  const pages = [...new Set([0, page - 1, page, page + 1, last])]
    .filter((n) => n >= 0 && n <= last)
    .sort((a, b) => a - b)
  const pill =
    "inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-(--t-border-line) bg-white text-xs font-semibold text-(--t-ink-base) hover:border-(--t-border-hi) disabled:cursor-default disabled:opacity-40"

  return (
    <nav
      aria-label={t("label")}
      className="flex flex-wrap items-center gap-1.5"
    >
      <button
        type="button"
        aria-label={t("previous")}
        className={pill}
        disabled={disabled || page === 0}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft aria-hidden size={15} />
      </button>
      {pages.map((n, i) => (
        <span key={n} className="contents">
          {i > 0 && n > pages[i - 1]! + 1 ? (
            <span aria-hidden className="px-1 text-(--t-ink-dim)">
              …
            </span>
          ) : null}
          <button
            type="button"
            aria-label={t("page", { number: n + 1 })}
            aria-current={n === page ? "page" : undefined}
            disabled={disabled}
            onClick={() => onPage(n)}
            className={cn(
              pill,
              n === page &&
                "border-(--t-ink-base) bg-(--t-ink-base) text-white hover:border-(--t-ink-base)"
            )}
          >
            {n + 1}
          </button>
        </span>
      ))}
      <button
        type="button"
        aria-label={t("next")}
        className={pill}
        disabled={disabled || page >= last}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight aria-hidden size={15} />
      </button>
    </nav>
  )
}
