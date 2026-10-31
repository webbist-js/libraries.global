import "server-only"
import { cache } from "react"

import type { NetworkDetail, NetworkList } from "@/lib/networks/types"

export const readPublicNetwork = cache(
  async <T>(path: string): Promise<T | null> => {
    const secret = process.env.STRAPI_BRIDGE_SECRET
    if (!secret) return null
    const response = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/access/public/${path}`,
      { headers: { "X-Service-Secret": secret }, cache: "no-store" }
    ).catch(() => null)
    if (response?.status === 404) return null
    if (!response?.ok)
      throw new Error(
        "The service directory is temporarily unavailable. Please try again."
      )

    return response.json() as Promise<T>
  }
)
export const publicNetworkList = (query: URLSearchParams) =>
  readPublicNetwork<NetworkList>(`networks?${query}`)
export const publicNetworkDetail = (
  slug: string,
  query: number | URLSearchParams = 1
) =>
  readPublicNetwork<NetworkDetail>(
    `networks/${encodeURIComponent(slug)}?${typeof query === "number" ? `page=${query}` : query}`
  )
