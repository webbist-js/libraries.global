import "server-only"
import type { LibraryNotice } from "@repo/shared-data"

export async function fetchPublicLibraryNotices(
  id: string
): Promise<LibraryNotice[]> {
  try {
    const response = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/library-notices/for-library/${encodeURIComponent(id)}`,
      {
        next: { tags: ["library", `mobile:${id}`], revalidate: 300 },
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!response.ok) return []
    const body = (await response.json()) as { data?: LibraryNotice[] }

    return Array.isArray(body.data) ? body.data : []
  } catch {
    return []
  }
}
