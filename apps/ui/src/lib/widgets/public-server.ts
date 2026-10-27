import "server-only"

import type { PublicWidget } from "@repo/shared-data"

import { readTextCapped } from "@/lib/bridge-params"

export async function fetchPublicWidget(
  publicId: string,
  endpoint: "data" | "policy" | "reports" = "data",
  count = false
): Promise<{ status: number; body: PublicWidget | null }> {
  if (
    !/^[A-Za-z0-9_-]{24}$/.test(publicId) ||
    !process.env.STRAPI_BRIDGE_SECRET
  )
    return { status: 404, body: null }
  try {
    const response = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/access/widgets/public/${publicId}/${endpoint}${count ? "?count=true" : ""}`,
      {
        method: endpoint === "reports" ? "POST" : "GET",
        headers: { "x-service-secret": process.env.STRAPI_BRIDGE_SECRET },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      }
    )
    if (!response.ok) return { status: response.status, body: null }
    const text = await readTextCapped(response, 8 * 1024 * 1024)
    if (!text) return { status: 503, body: null }

    return { status: 200, body: JSON.parse(text) }
  } catch {
    return { status: 503, body: null }
  }
}
