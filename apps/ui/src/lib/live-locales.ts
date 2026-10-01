import { routing } from "@/lib/navigation"

/**
 * Locales whose content is actually published. `routing.locales` also lists
 * `cs` (starter-template scaffolding), but only English content exists, so we
 * don't emit hreflang alternates or sitemap entries for other locales, and
 * search (lib/meilisearch.ts) maps any other route locale to the default.
 * Add a locale here once its content is live.
 *
 * Kept apart from lib/seo/metadata.ts so client code can import it without
 * the metadata builders.
 */
export const LIVE_LOCALES: readonly string[] = [routing.defaultLocale]
