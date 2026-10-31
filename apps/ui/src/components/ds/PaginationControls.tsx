"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslations } from "next-intl"

import { buttonVariants } from "@/components/ui/button"
import { paginationPages } from "@/lib/pagination"
import { cn } from "@/lib/styles"

/** Callback pagination uses zero-based indexes. IndexPager adapts the one-based API. */
export function PaginationControls({
  page,
  pageCount,
  onPage,
  disabled = false,
  appearance = "compact",
}: {
  readonly page: number
  readonly pageCount: number
  readonly onPage: (page: number) => void
  readonly disabled?: boolean
  readonly appearance?: "compact" | "index"
}) {
  const t = useTranslations("pagination")
  const ui = useTranslations("ui")
  const last = Math.max(0, pageCount - 1)
  const current = Math.max(0, Math.min(page, last))
  const pages = paginationPages(current + 1, last + 1)
  const index = appearance === "index"
  const pill = (active = false, navigation = false) =>
    buttonVariants({
      variant: active && index ? "primary" : "surface",
      size: navigation && index ? "pill-sm" : "icon",
      className: cn(
        "rounded-full text-xs font-semibold",
        index && "min-h-11 min-w-11 text-sm",
        !index && "gap-0",
        active &&
          !index &&
          "border-(--t-ink-base) bg-(--t-bg-inverse) text-white hover:border-(--t-ink-base) hover:bg-(--t-bg-inverse)"
      ),
    })

  return (
    <nav
      aria-label={t("label")}
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        index && "justify-center py-6"
      )}
    >
      <button
        type="button"
        aria-label={t("previous")}
        className={pill(false, true)}
        disabled={disabled || current === 0}
        onClick={() => onPage(current - 1)}
      >
        <ChevronLeft aria-hidden size={15} />
        {index ? ui("previous") : null}
      </button>
      {pages.map((number, i) => (
        <span key={number} className="contents">
          {i > 0 && number > pages[i - 1]! + 1 ? (
            <span aria-hidden className="px-1 text-(--t-ink-dim)">
              …
            </span>
          ) : null}
          <button
            type="button"
            aria-label={t("page", { number })}
            aria-current={number === current + 1 ? "page" : undefined}
            disabled={disabled}
            onClick={() => onPage(number - 1)}
            className={pill(number === current + 1)}
          >
            {number}
          </button>
        </span>
      ))}
      <button
        type="button"
        aria-label={t("next")}
        className={pill(false, true)}
        disabled={disabled || current >= last}
        onClick={() => onPage(current + 1)}
      >
        {index ? ui("next") : null}
        <ChevronRight aria-hidden size={15} />
      </button>
    </nav>
  )
}
