// The "Edit history" panel under a Knowledge or Journal article: who
// changed it, when, in which language and how. No values are ever shown.

import { Icon } from "@iconify/react"
import { Suspense } from "react"

import { Badge } from "@/components/ds/Badge"
import GlobalLink from "@/components/global/GlobalLink"
import {
  actorLabel,
  dayName,
} from "@/components/library/change-history.helpers"
import { T } from "@/lib/design-tokens"
import { languageName } from "@/lib/locale-fallback"
import {
  type ArticleHistoryItem,
  fetchArticleHistory,
} from "@/lib/strapi-api/content/server"

const KIND: Record<string, { text: string; icon: string }> = {
  created: { text: "Created", icon: "mdi:plus-circle-outline" },
  edited: { text: "Edited", icon: "mdi:pencil-outline" },
  translated: { text: "Translated", icon: "mdi:translate" },
  published: { text: "Published", icon: "mdi:earth" },
  unpublished: { text: "Unpublished", icon: "mdi:eye-off-outline" },
  deleted: { text: "Deleted", icon: "mdi:delete-outline" },
}

/** "Edited", or "Translated into French" for a translation. */
export function articleChangeText(kind: string, locale: string): string {
  if (kind === "translated") return `Translated into ${languageName(locale)}`

  return KIND[kind]?.text ?? "Edited"
}

export function ArticleEditHistory({
  items,
  total,
  locale,
  className = "",
}: {
  readonly items: readonly ArticleHistoryItem[]
  readonly total: number
  /** The page's locale: changes in any other locale get a badge. */
  readonly locale: string
  readonly className?: string
}) {
  if (items.length === 0) return null

  return (
    <details
      className={`rounded-[20px] border px-5 py-4 sm:px-6 ${className}`}
      style={{ background: T.bg.deep, borderColor: T.border.line }}
    >
      <summary
        className="flex cursor-pointer items-center gap-2 text-[16px] font-semibold"
        style={{ color: T.ink.base }}
      >
        <Icon aria-hidden="true" height={18} icon="mdi:history" width={18} />
        Edit history
        <span className="text-[14px] font-normal" style={{ color: T.ink.dim }}>
          ({total} {total === 1 ? "change" : "changes"})
        </span>
      </summary>
      <ul className="m-0 mt-3 list-none p-0">
        {items.map((item, i) => {
          const actor = actorLabel(item)
          const icon = KIND[item.kind]?.icon ?? KIND.edited!.icon
          const otherLocale = item.locale !== locale

          return (
            <li
              key={`${item.changedAt}-${i}`}
              className="flex gap-3 py-3 text-[15px]"
              style={{ borderTop: `1px solid ${T.border.divider}` }}
            >
              <Icon
                aria-hidden="true"
                className="mt-[3px] shrink-0"
                height={16}
                icon={icon}
                style={{ color: T.ink.dim }}
                width={16}
              />
              <div className="min-w-0">
                <p
                  className="m-0 flex flex-wrap items-center gap-2"
                  style={{ color: T.ink.base }}
                >
                  <strong>{articleChangeText(item.kind, item.locale)}</strong>
                  {otherLocale ? (
                    <>
                      <span data-locale aria-hidden="true">
                        <Badge label={item.locale.toUpperCase()} color="dim" />
                      </span>
                      <span className="sr-only">
                        ({languageName(item.locale)} version)
                      </span>
                    </>
                  ) : null}
                </p>
                {item.editSummary ? (
                  <p className="m-0 mt-0.5" style={{ color: T.ink.dim }}>
                    {item.editSummary}
                  </p>
                ) : null}
                <p
                  className="m-0 mt-0.5 text-[13px]"
                  style={{ color: T.ink.dim }}
                >
                  {actor.href ? (
                    <GlobalLink
                      href={actor.href}
                      className="underline underline-offset-2"
                    >
                      {actor.text}
                    </GlobalLink>
                  ) : (
                    actor.text
                  )}
                  {" · "}
                  <time dateTime={item.changedAt}>
                    {dayName(item.changedAt)}
                  </time>
                </p>
              </div>
            </li>
          )
        })}
      </ul>
      {total > items.length ? (
        <p className="m-0 mt-2 text-[13px]" style={{ color: T.ink.dim }}>
          Showing the latest {items.length} of {total} changes.
        </p>
      ) : null}
    </details>
  )
}

async function ArticleEditHistoryLoader({
  kind,
  documentId,
  locale,
  className,
}: {
  readonly kind: "wiki" | "blog"
  readonly documentId: string
  readonly locale: string
  readonly className?: string
}) {
  const history = await fetchArticleHistory(kind, documentId)
  if (!history) return null

  return (
    <ArticleEditHistory
      items={history.data}
      total={history.meta.total}
      locale={locale}
      className={className}
    />
  )
}

/** Server-only: fetches and renders the panel, or nothing. */
export function ArticleEditHistorySection(props: {
  readonly kind: "wiki" | "blog"
  readonly documentId: string | null | undefined
  readonly locale: string
  readonly className?: string
}) {
  const { documentId } = props
  if (!documentId) return null

  return (
    <Suspense fallback={null}>
      <ArticleEditHistoryLoader {...props} documentId={documentId} />
    </Suspense>
  )
}
