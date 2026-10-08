/**
 * The browser's Meilisearch search key (`NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY`)
 * must allow `search` on every public index, `mobile-stop` included (2.4).
 * Meilisearch can't change a key's index list, but a key's value is derived
 * from its `uid` and the master key, so recreating the key under the same
 * uid keeps the value the UI already holds. Only the master key may manage
 * keys; without it this step logs and skips.
 */
export const PUBLIC_SEARCH_INDEXES = [
  "library",
  "blog-article",
  "wiki-article",
  "event",
  "mobile-stop",
] as const
export const PUBLIC_SEARCH_KEY_UID = "5d2f7a0c-3b84-4e6f-9a1d-6c0e8b2f4a71"
export const PUBLIC_SEARCH_KEY_NAME = "libraries.global public search"

type MeiliKey = {
  uid: string
  name?: string | null
  actions: string[]
  indexes: string[]
}

/** True when `key` can search every public index. */
export function coversPublicIndexes(key: MeiliKey): boolean {
  const search = key.actions.includes("search") || key.actions.includes("*")
  const all = key.indexes.includes("*")

  return (
    search &&
    (all || PUBLIC_SEARCH_INDEXES.every((index) => key.indexes.includes(index)))
  )
}

export async function ensurePublicSearchKey(
  strapi: any,
  fetchImpl: typeof fetch = fetch
): Promise<"covered" | "created" | "recreated" | "skipped"> {
  const config =
    strapi.config?.get?.("plugin::meilisearch") ??
    strapi.config?.get?.("plugin.meilisearch") ??
    {}
  const host =
    config.host ?? process.env.MEILISEARCH_HOST ?? "http://localhost:7701"
  const master = process.env.MEILISEARCH_MASTER_KEY
  if (!master) {
    strapi.log.info(
      "[meilisearch] MEILISEARCH_MASTER_KEY is not set; the public search key is not checked"
    )

    return "skipped"
  }
  const call = async (path: string, method = "GET", body?: unknown) => {
    const response = await fetchImpl(new URL(path, host), {
      method,
      headers: {
        Authorization: `Bearer ${master}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok && response.status !== 204)
      throw new Error(
        `Meilisearch ${method} ${path} returned ${response.status}`
      )

    return response.status === 204 ? null : response.json()
  }
  const listed = (await call("/keys?limit=1000")) as {
    results?: MeiliKey[]
  } | null
  const keys = listed?.results ?? []
  const own = keys.find((key) => key.uid === PUBLIC_SEARCH_KEY_UID)
  if (own && coversPublicIndexes(own)) return "covered"
  if (!own && keys.some(coversPublicIndexes)) return "covered"
  if (own) await call(`/keys/${PUBLIC_SEARCH_KEY_UID}`, "DELETE")
  await call("/keys", "POST", {
    uid: PUBLIC_SEARCH_KEY_UID,
    name: PUBLIC_SEARCH_KEY_NAME,
    description: "Browser search key for libraries.global (search only)",
    actions: ["search"],
    indexes: [...PUBLIC_SEARCH_INDEXES],
    expiresAt: null,
  })
  strapi.log.info(
    own
      ? `[meilisearch] Recreated the public search key ${PUBLIC_SEARCH_KEY_UID} to cover ${PUBLIC_SEARCH_INDEXES.join(", ")}; its value is unchanged`
      : `[meilisearch] Created the public search key ${PUBLIC_SEARCH_KEY_UID}; read its value with GET /keys/${PUBLIC_SEARCH_KEY_UID} and set NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY`
  )

  return own ? "recreated" : "created"
}
