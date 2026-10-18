"use client"

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
    <nav aria-label={t("pagination")} className="mt-4 flex gap-4 text-sm">
      {page > 1 ? (
        <Link className="underline" href={href(page - 1)}>
          {t("previous")}
        </Link>
      ) : null}
      <span>{t("pageOf", { page, total: pageCount })}</span>
      {page < pageCount ? (
        <Link className="underline" href={href(page + 1)}>
          {t("next")}
        </Link>
      ) : null}
    </nav>
  )
}
