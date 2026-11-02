/**
 * Backfill publishedAt field for existing published articles.
 *
 * This script sets the custom publishedAt field for all published blog and wiki
 * articles that don't already have it. Uses the article's Strapi publishedAt
 * as the source date.
 *
 * Usage:
 *   pnpm tsx apps/strapi/scripts/backfill-article-published-at.ts [--local]
 *
 * Env: STRAPI_URL (or --local), STRAPI_API_TOKEN, STRAPI_BRIDGE_SECRET
 */

const STRAPI_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN ?? ""
const STRAPI_BRIDGE_SECRET = process.env.STRAPI_BRIDGE_SECRET ?? ""

if (!STRAPI_API_TOKEN) {
  console.error("STRAPI_API_TOKEN is not set.")
  process.exit(1)
}

if (!STRAPI_BRIDGE_SECRET) {
  console.error("STRAPI_BRIDGE_SECRET is not set.")
  process.exit(1)
}

interface Article {
  documentId: string
  id: number
  publishedAt: string | null
  slug: string
}

interface StrapiResponse<T> {
  data: T[]
  meta: {
    pagination: {
      page: number
      pageSize: number
      pageCount: number
      total: number
    }
  }
}

async function fetchArticles(
  contentType: "blog-article" | "wiki-article",
  page = 1,
  pageSize = 100
): Promise<StrapiResponse<Article>> {
  const url = new URL(`${STRAPI_URL}/api/${contentType}s`)
  url.searchParams.append("pagination[page]", page.toString())
  url.searchParams.append("pagination[pageSize]", pageSize.toString())
  url.searchParams.append("filters[publishedAt][$notNull]", "true")
  url.searchParams.append("status", "published")
  url.searchParams.append("fields", "id,documentId,slug,publishedAt")

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      "X-Strapi-Bridge": STRAPI_BRIDGE_SECRET,
    },
  })

  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${contentType}: ${res.status} ${await res.text()}`
    )
  }

  return res.json() as Promise<StrapiResponse<Article>>
}

async function updateArticle(
  contentType: "blog-article" | "wiki-article",
  documentId: string,
  publishedAt: string
): Promise<void> {
  const url = new URL(`${STRAPI_URL}/api/${contentType}s/${documentId}`)
  url.searchParams.append("status", "published")

  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      "X-Strapi-Bridge": STRAPI_BRIDGE_SECRET,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: { publishedAt } }),
  })

  if (!res.ok) {
    throw new Error(
      `Failed to update ${documentId}: ${res.status} ${await res.text()}`
    )
  }
}

async function backfillContentType(
  contentType: "blog-article" | "wiki-article"
): Promise<void> {
  console.log(`\nBackfilling ${contentType}...`)

  let page = 1
  let totalUpdated = 0
  let hasMore = true

  while (hasMore) {
    const response = await fetchArticles(contentType, page)
    const { data, meta } = response

    for (const article of data) {
      try {
        await updateArticle(
          contentType,
          article.documentId,
          article.publishedAt!
        )
        totalUpdated++
        console.log(
          `  ✓ ${article.slug} (${article.documentId}) → ${article.publishedAt}`
        )
      } catch (error) {
        console.error(
          `  ✗ ${article.slug} (${article.documentId}):`,
          error instanceof Error ? error.message : error
        )
      }
    }

    hasMore = page < meta.pagination.pageCount
    if (hasMore) page++
  }

  console.log(`  Total updated: ${totalUpdated}`)
}

async function main(): Promise<void> {
  console.log(`Connecting to ${STRAPI_URL}...`)

  try {
    await backfillContentType("blog-article")
    await backfillContentType("wiki-article")
    console.log("\n✓ Backfill complete!")
  } catch (error) {
    console.error(
      "\n✗ Backfill failed:",
      error instanceof Error ? error.message : error
    )
    process.exit(1)
  }
}

main()
