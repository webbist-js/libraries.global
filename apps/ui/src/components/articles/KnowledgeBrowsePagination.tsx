"use client"

import { Icon } from "@iconify/react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { Link } from "@/lib/navigation"

export function KnowledgeBrowsePagination({
  page,
  pageCount,
}: {
  readonly page: number
  readonly pageCount: number
}) {
  const params = useSearchParams()
  const t = useTranslations("discovery")
  const href = (nextPage: number) => {
    const next = new URLSearchParams(params.toString())
    next.set("page", String(nextPage))

    return `/knowledge?${next.toString()}`
  }
  if (pageCount <= 1) return null

  return (
    <nav
      aria-label={t("pagination")}
      className="mt-7 flex flex-wrap items-center justify-center gap-4 border-t border-(--t-border-line) pt-6 text-sm"
    >
      {page > 1 ? (
        <Link
          className="inline-flex min-h-11 items-center gap-1 rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-4 font-semibold transition-colors hover:bg-(--t-bg-muted)"
          href={href(page - 1)}
        >
          <Icon aria-hidden="true" icon="mdi:chevron-left" width={18} />
          {t("previous")}
        </Link>
      ) : null}
      <span>{t("pageOf", { page, total: pageCount })}</span>
      {page < pageCount ? (
        <Link
          className="inline-flex min-h-11 items-center gap-1 rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-4 font-semibold transition-colors hover:bg-(--t-bg-muted)"
          href={href(page + 1)}
        >
          {t("next")}
          <Icon aria-hidden="true" icon="mdi:chevron-right" width={18} />
        </Link>
      ) : null}
    </nav>
  )
}
