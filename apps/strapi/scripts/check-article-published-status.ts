/**
 * Check the publishedAt status of existing articles.
 *
 * Usage:
 *   pnpm tsx apps/strapi/scripts/check-article-published-status.ts
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

async function checkContentType(
  contentType: "blog-article" | "wiki-article"
): Promise<void> {
  const url = new URL(`${STRAPI_URL}/api/${contentType}s`)
  url.searchParams.append("pagination[pageSize]", "1000")
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

  const response = (await res.json()) as StrapiResponse<Article>
  const { data, meta } = response

  console.log(`\n${contentType}:`)
  console.log(`  Total published: ${meta.pagination.total}`)

  const withPublishedAt = data.filter((a) => a.publishedAt).length
  const withoutPublishedAt = data.filter((a) => !a.publishedAt).length

  console.log(`  With custom publishedAt: ${withPublishedAt}`)
  console.log(`  Without custom publishedAt: ${withoutPublishedAt}`)

  if (withoutPublishedAt > 0 && withoutPublishedAt <= 10) {
    console.log("\n  Articles needing backfill:")
    data
      .filter((a) => !a.publishedAt)
      .forEach((a) => {
        console.log(`    - ${a.slug} (${a.documentId})`)
      })
  } else if (withoutPublishedAt > 10) {
    console.log(
      `\n  (Showing first 10 of ${withoutPublishedAt} articles needing backfill)`
    )
    data
      .filter((a) => !a.publishedAt)
      .slice(0, 10)
      .forEach((a) => {
        console.log(`    - ${a.slug} (${a.documentId})`)
      })
  }
}

async function main(): Promise<void> {
  console.log(`Connecting to ${STRAPI_URL}...`)

  try {
    await checkContentType("blog-article")
    await checkContentType("wiki-article")
  } catch (error) {
    console.error(
      "Check failed:",
      error instanceof Error ? error.message : error
    )
    process.exit(1)
  }
}

main()
