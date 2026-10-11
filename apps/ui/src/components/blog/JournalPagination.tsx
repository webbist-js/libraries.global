import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"

import {
  journalHref,
  pageWindow,
  showingRange,
  type JournalQuery,
} from "./journalLanding.helpers"

const PILL =
  "inline-flex h-9 items-center gap-1 rounded-full border px-3.5 text-[14px] font-semibold"
const CIRCLE =
  "inline-flex size-9 items-center justify-center rounded-full border text-[14px] font-semibold"

export function JournalPagination({
  query,
  page,
  pageCount,
  pageSize,
  total,
}: {
  readonly query: JournalQuery
  readonly page: number
  readonly pageCount: number
  readonly pageSize: number
  readonly total: number
}) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("editorial")

  const { from, to } = showingRange(page, pageSize, total)
  const href = (p: number) => journalHref(query, { page: p }, "all-articles")
  const idle = {
    background: T.bg.deep,
    borderColor: T.border.hi,
    color: T.ink.base,
  }
  const disabled = {
    background: T.bg.muted,
    borderColor: T.border.line,
    color: T.ink.low,
  }

  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
      <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
        {from > 0
          ? t("showingRange", { from, to, total })
          : t("articleCount", { count: total })}
      </p>

      {pageCount > 1 ? (
        <nav aria-label={tUi("pagination")}>
          <ul className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
            <li>
              {page > 1 ? (
                <GlobalLink className={PILL} href={href(page - 1)} style={idle}>
                  <Icon aria-hidden="true" icon="mdi:chevron-left" width={16} />
                  {tUi("previous")}{" "}
                </GlobalLink>
              ) : (
                <span aria-disabled="true" className={PILL} style={disabled}>
                  <Icon aria-hidden="true" icon="mdi:chevron-left" width={16} />
                  {tUi("previous")}{" "}
                </span>
              )}
            </li>
            {pageWindow(Math.min(page, pageCount), pageCount).map((p) =>
              typeof p === "string" ? (
                <li
                  aria-hidden="true"
                  className="px-1 text-[14px]"
                  key={p}
                  style={{ color: T.ink.low }}
                >
                  …
                </li>
              ) : (
                <li key={p}>
                  <GlobalLink
                    aria-current={p === page ? "page" : undefined}
                    aria-label={t("pageLabel", { page: p })}
                    className={CIRCLE}
                    href={href(p)}
                    style={
                      p === page
                        ? {
                            background: T.ink.base,
                            borderColor: T.ink.base,
                            color: "#fff",
                          }
                        : idle
                    }
                  >
                    {p}
                  </GlobalLink>
                </li>
              )
            )}
            <li>
              {page < pageCount ? (
                <GlobalLink className={PILL} href={href(page + 1)} style={idle}>
                  {tUi("next")}{" "}
                  <Icon
                    aria-hidden="true"
                    icon="mdi:chevron-right"
                    width={16}
                  />
                </GlobalLink>
              ) : (
                <span aria-disabled="true" className={PILL} style={disabled}>
                  {tUi("next")}{" "}
                  <Icon
                    aria-hidden="true"
                    icon="mdi:chevron-right"
                    width={16}
                  />
                </span>
              )}
            </li>
          </ul>
        </nav>
      ) : null}
    </div>
  )
}
