import "server-only"

import { strapiServiceHeaders } from "@/lib/bridge-user-headers"
import {
  supportedContentLocales,
  type ContentLocale,
} from "@/lib/content-locales"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

/** Null denotes an unavailable catalogue; an empty configured intersection stays empty. */
export async function fetchContentLocales(): Promise<ContentLocale[] | null> {
  try {
    const response = await fetch(`${STRAPI}/api/content-moderation/locales`, {
      headers: strapiServiceHeaders(),
      next: { revalidate: 3600 },
    })
    if (!response.ok) return null
    const json = (await response.json()) as { data?: ContentLocale[] }

    return Array.isArray(json.data) ? supportedContentLocales(json.data) : null
  } catch {
    return null
  }
}
