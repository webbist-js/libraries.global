import { DEFAULT_LOCALE } from "@repo/shared-data"

/**
 * Locales whose content is actually published. `routing.locales` also lists
 * `cs` and `fr`, whose UI catalogues exist but whose CMS content is incomplete.
 * We don't emit hreflang alternates or sitemap entries for those locales, and
 * search (lib/meilisearch.ts) maps any other route locale to the default.
 * Add a locale here once its content is live.
 *
 * Kept apart from lib/seo/metadata.ts so client code can import it without
 * the metadata builders.
 */
export const LIVE_LOCALES: readonly string[] = [DEFAULT_LOCALE]
