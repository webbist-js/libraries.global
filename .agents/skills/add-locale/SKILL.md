---
name: add-locale
description: Add a supported UI/content locale to Libraries Global, including shared locale constants, Next-intl messages, CMS enablement and fallback checks.
---

# Add a locale

Read `packages/shared-data/locales.ts`, `apps/ui/src/lib/navigation.ts` and `apps/ui/src/lib/i18n.ts`. Supported locales are defined centrally, not in a separate routing array. Existing UI locales are English, Czech and French.

Infer the locale identifier from the request and current supported-locale conventions. Confirm only genuinely ambiguous language/region requirements. Reuse an existing locale if it already satisfies the request.

## Implementation

1. Add the locale to `SUPPORTED_LOCALES` in `packages/shared-data/locales.ts`, preserving the default unless explicitly requested. Check consumers for locale-specific labels, language pickers and validation.
2. Create `apps/ui/locales/{locale}.json` with the same key structure as English and reviewed translations. Do not present a copied English file as a completed translation.
3. The navigation config consumes the shared constants; i18n dynamically imports the matching message file. Update these only if the new locale requires a behavior change. English has no URL prefix; other locales use their locale prefix.
4. Inspect shared content-language helpers, CMS locale bootstrap and feature-specific allowlists. UI route availability and permitted contribution/content languages are separate choices; do not expand them indiscriminately.
5. Enable the requested locale in the selected CMS environment using the authorized content workflow. Preserve existing translations and document identity. If CMS access is unavailable, report that remaining step without claiming content is enabled.
6. Check message keys, locale navigation, fallback behavior and representative localized metadata/routes. Run the existing UI i18n audit and focused finite checks under root `AGENTS.md` resource rules. Rebuild changed shared packages before checking consumers.

Use `apps/strapi/CONTENT-OPERATIONS.md` to choose production versus local. Adding a UI locale does not by itself translate CMS content or authorize unrelated publication.
