/** Saved Atlas views and Find searches: a name and the page's URL state. */
export const SAVED_VIEW_KINDS = ["view", "search"] as const
export type SavedViewKind = (typeof SAVED_VIEW_KINDS)[number]

export type SavedView = {
  documentId: string
  kind: SavedViewKind
  name: string
  query: string
  createdAt: string
}

/** The page each kind belongs to; a saved item only ever stores its query. */
export const SAVED_VIEW_PATH: Record<SavedViewKind, string> = {
  view: "/map",
  search: "/libraries",
}

/** The session limit for a kind: `savedViews` or `savedSearches`. */
export const SAVED_VIEW_LIMIT_KEY = {
  view: "savedViews",
  search: "savedSearches",
} as const satisfies Record<SavedViewKind, string>

export function savedViewLimit(limits: unknown, kind: SavedViewKind): number {
  const value = (limits as Record<string, unknown> | null | undefined)?.[
    SAVED_VIEW_LIMIT_KEY[kind]
  ]

  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

export const savedViewHref = (item: Pick<SavedView, "kind" | "query">) =>
  item.query
    ? `${SAVED_VIEW_PATH[item.kind]}?${item.query}`
    : SAVED_VIEW_PATH[item.kind]
