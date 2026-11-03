import "server-only"

import { DEFAULT_LOCALE } from "@repo/shared-data"
import { draftMode } from "next/headers"
import type { Locale } from "next-intl"

import { logNonBlockingError } from "@/lib/logging"
import { normaliseRoadmap, type RoadmapContent } from "@/lib/roadmap"
import { PublicStrapiClient } from "@/lib/strapi-api"

async function isDraftRequest() {
  try {
    return (await draftMode()).isEnabled
  } catch {
    return false
  }
}

async function fetchRoadmapIn(locale: string): Promise<RoadmapContent | null> {
  try {
    const response = (await PublicStrapiClient.fetchAPI("/roadmap", {
      locale: locale as Locale,
      status: (await isDraftRequest()) ? "draft" : "published",
    })) as { data?: unknown }

    return normaliseRoadmap(response.data)
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching the roadmap for locale '${locale}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return null
  }
}

/**
 * The Roadmap in one locale, else the default-language roadmap: item keys
 * are shared, so votes and conversations are the same in every language.
 */
export async function fetchRoadmap(
  locale: Locale
): Promise<RoadmapContent | null> {
  const content = await fetchRoadmapIn(locale)
  if (content || locale === DEFAULT_LOCALE) return content

  return fetchRoadmapIn(DEFAULT_LOCALE)
}
