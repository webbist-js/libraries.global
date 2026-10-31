import { useTranslations } from "next-intl"

import { Link } from "@/lib/navigation"

/** Query-preserving paging shared by directory and member results. */
export function DirectoryPagination({
  basePath,
  query,
  page,
  pageSize,
  total,
  label,
}: {
  readonly basePath: string
  readonly query: URLSearchParams
  readonly page: number
  readonly pageSize: number
  readonly total: number
  readonly label: string
}) {
  const t = useTranslations("pagination")
  const ui = useTranslations("ui")
  if (total <= pageSize && page === 1) return null
  const href = (next: number) => {
    const params = new URLSearchParams(query)
    params.set("page", String(next))

    return `${basePath}?${params}`
  }

  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-(--t-border-line) pt-5 text-sm"
    >
      {page > 1 ? (
        <Link className="network-page-link" href={href(page - 1)}>
          ← {ui("previous")}
        </Link>
      ) : (
        <span />
      )}
      <span>
        {t("summary", {
          page,
          total: Math.max(1, Math.ceil(total / pageSize)),
        })}
      </span>
      {page * pageSize < total ? (
        <Link className="network-page-link" href={href(page + 1)}>
          {ui("next")} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
