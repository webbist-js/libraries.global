---
name: add-locale
description: Add a supported UI/content locale to Libraries Global, including shared locale constants, Next-intl messages, hard-coded locale lists, CMS enablement and fallback checks.
---

# Add a locale

Supported locales are defined once in `packages/shared-data/locales.ts` (`SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `isSupportedLocale`). The current UI locales are Czech (`cs`), English (`en`, default), Spanish (`es`), French (`fr`) and Japanese (`ja`). Each locale's messages live in one JSON file per feature under `apps/ui/locales/{locale}/` (`common.json`, `atlas.json`, `staff.json`, …), merged by that directory's `index.ts`. `apps/ui/locales/catalogue.ts` (`CATALOGUE_FILES`) lists the files every locale must have. Japanese was the most recent addition; `git show 48da5b0b --stat` lists every place it touched, but it predates the per-feature split, so its single `ja.json` maps to the per-feature files described below.

Infer the locale identifier from the request and current supported-locale conventions. Confirm only genuinely ambiguous language/region requirements. Reuse an existing locale if it already satisfies the request. A language in a profile or contribution language list (for example `apps/ui/src/components/profile-form/profile-form.model.ts`) is not a UI locale.

## Implementation

1. Add the locale to `SUPPORTED_LOCALES` in `packages/shared-data/locales.ts`, keeping alphabetical order and the default unless explicitly requested. Rebuild `@repo/shared-data` before checking consumers. Code that uses `isSupportedLocale` or `SupportedLocale` picks it up automatically, including Next-intl routing (`apps/ui/src/lib/routing.ts`), content-locale filtering (`apps/ui/src/lib/content-locales.ts`), bounded library queries and the Strapi plugins.
2. Create `apps/ui/locales/{locale}/` with every file in `CATALOGUE_FILES`, each holding the same keys as its `en/` counterpart with reviewed translations, plus an `index.ts` copied from `en/index.ts`. Register the locale's loader in `apps/ui/src/i18n/catalogues.ts`; its `satisfies Record<Locale, …>` fails typechecking until you do. `apps/ui/src/lib/i18n.ts` and the generated client scopes (`src/i18n/client-scopes.generated.json`) are locale-independent and need no change. Do not present copied English files as a completed translation.
3. Update the lists that are still hard-coded rather than derived from the shared constants. Search for an existing list (for example `git grep -n '"cs", "en", "es", "fr", "ja"'` and `'"en", "cs", "es", "fr"'`; some lists may still lack `ja`) and check at least:
   - `apps/ui/src/components/elementary/LocaleSwitcher.tsx` (native language name) and `apps/ui/src/components/providers/CookieSettingsButton.tsx`.
   - `apps/ui/scripts/i18n-audit.mjs` and `apps/ui/scripts/email-samples.mjs`.
   - Locale-keyed copy records such as `packages/shared-data/beta-email.ts`.
   - `apps/ui/scripts/api-schema.sql` `CHECK (locale IN (...))`, both the inline constraint and the `ALTER TABLE ... ADD CONSTRAINT` that re-creates it for existing tables.
   - Strapi: the admin `locales` list in `apps/strapi/src/admin/app.tsx`, the `communicationLocale` enum in `apps/strapi/src/api/subscriber/content-types/subscriber/schema.json` (then run `pnpm generate:types` in `apps/strapi`), and the allowlists in `apps/strapi/src/plugins/access/server/controllers/api-data.ts`, `api-resources.ts` and `apps/strapi/src/plugins/beta-invites/` (server controller and admin select).
   - Storybook: `apps/storybook/.storybook/fixture-locale.ts`, `preview.tsx` and `mocks/intl-server.ts`, which import each locale's `apps/ui/locales/{locale}` directory.
   - Tests that enumerate locales.
4. English has no URL prefix; other locales use their locale prefix (`localePrefix: "as-needed"`). `apps/ui/src/lib/live-locales.ts` (`LIVE_LOCALES`) separately controls hreflang alternates, sitemap entries and search locale mapping. Add a locale there only once its CMS content is published. UI route availability and permitted contribution/content languages are separate choices; do not expand them indiscriminately.
5. CMS locales are data, not code: enable the requested locale in Strapi's Internationalization settings in the selected environment using the authorized content workflow. The public `GET /api/content-moderation/locales` route and the UI's content-locale helpers then offer it once it is also in `SUPPORTED_LOCALES`. Preserve existing translations and document identity. If CMS access is unavailable, report that remaining step without claiming content is enabled. Content helpers in `apps/strapi/scripts/` keep their own locale lists; extend only the ones whose content you are translating.
6. Run `pnpm --filter @repo/ui i18n:check` (key parity, ICU arguments, file placement and client-scope freshness), check locale navigation, fallback behavior and representative localized metadata/routes, and run the focused tests you touched under root `AGENTS.md` resource rules.

Use `apps/strapi/CONTENT-OPERATIONS.md` to choose production versus local. Adding a UI locale does not by itself translate CMS content or authorize unrelated publication.
