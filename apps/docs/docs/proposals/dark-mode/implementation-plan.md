# Dark mode and the interface overhaul

Implementation proposal · 30 October 2026 · not an implementation or release record.

The implemented behaviour and local verification are recorded in [implementation status](./implementation-status.md). Production release and editorial publication remain separate.

## Outcome

Offer Light, Dark and System appearance across Libraries Global. System is the initial choice; an explicit choice overrides the browser's reported preference. One control in the header and one in account settings operate the same preference. Storybook previews the same tokens and behaviours, and both appearances pass the same accessibility and functional acceptance gates.

Keep the warm reference-book character of the light theme, indigo identity, serif display type and practical workspace layouts. The supplied API mockup establishes a dark direction: deep indigo backgrounds, distinct raised surfaces, softer light text and violet accents. Its binary toggle, sample account, prices and usage are illustrative. Do not import its bundled application code or treat its markup as the production component architecture.

This is appearance work. Team membership, Team verification, institution affiliation and permission to manage a library remain separate facts. Neither a colour change nor a shared badge may merge those meanings. Publishing the accompanying preview articles does not deploy the theme, end the closed beta or enable live billing.

## Findings from the current repository

| Area          | Evidence                                                                                                                                                                 | Consequence                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Provider      | `apps/ui/src/components/providers/ClientProviders.tsx` uses next-themes, `forcedTheme="light"`, `defaultTheme="light"`, `enableSystem={false}` and a CSP nonce           | Reuse the existing provider. Removing forced light alone would expose incomplete styling. Preserve nonce coverage.                                                             |
| Tokens        | `apps/ui/src/styles/globals.css` defines light semantic tokens and maps Tailwind roles through `@theme inline`                                                           | Add a class-based dark token override and explicitly align Tailwind's `dark` variant with that class. Media-based dark utilities must not contradict an explicit Light choice. |
| Shared colour | `packages/design-system/src/palette.css`, `packages/design-system/src/theme.css`, `apps/ui/src/lib/design-tokens.ts` and shared community palettes contain fixed colours | Distinguish interface roles from stable data/identity colours. Do not mechanically replace every hex value.                                                                    |
| Account data  | user-profile has `theme: dark                                                                                                                                            | light`with default`dark`; UI is forced light                                                                                                                                   | The old default is not evidence of a user's choice. Do not migrate everyone to Dark. |
| Privacy       | profile controller's explicit private-field list does not include legacy `theme`                                                                                         | A new preference needs private schema metadata and explicit public-projection protection, plus own-account access tests.                                                       |
| Settings      | `ProfileAppearance.tsx` currently controls avatar colour; `SettingsShell.tsx` separates profile saves and account auto-saves                                             | Add Interface appearance as an account setting. Preserve avatar identity and unrelated unsaved profile edits.                                                                  |
| Storybook     | real UI CSS and locale toolbar are present; no appearance toolbar                                                                                                        | Use production appearance tokens/provider, isolate preview storage and test portal content as well as the story root.                                                          |
| Route roots   | locale layout has public-beta, normal, live-console and mobile paths                                                                                                     | Audit each root; a control in one dashboard header is not site-wide coverage.                                                                                                  |

The accompanying [source audit](./source-audit.json) inventories literal colours and preliminary mockup contrast checks. Literal counts are search results, not a defect count or accessibility assessment. Storybook's import graph is not proof that every composed component is rendered or tested.

The [baseline findings](./baseline-findings.md) separate confirmed code/mockup issues from checks still requiring runtime and assistive-technology assessment. There has not been a site-wide WCAG conformance pass.

## Preference contract

Use two distinct values throughout the implementation:

```ts
type AppearancePreference = "system" | "light" | "dark"
type ResolvedAppearance = "light" | "dark"
```

Persist the preference, never a resolved value when System is selected. Resolve System from `prefers-color-scheme: dark`, with Light as the fallback when no preference is reported. Listen for browser changes only while System is selected. There is no time-of-day, geolocation or ambient-light inference.

### Storage and precedence

Use the existing next-themes pre-paint mechanism with a versioned, site-specific local key. Add a small appearance coordinator rather than a second theme engine.

| Situation                                         | Required behaviour                                                                                                                                                                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First anonymous visit                             | System; no account or network request needed.                                                                                                                                                                                            |
| Anonymous explicit choice                         | Apply immediately, persist on this browser, synchronise open tabs through the existing storage behaviour.                                                                                                                                |
| Sign in with an explicit saved account preference | The account preference wins after own-profile resolution. Do not write an older profile response over a choice made during that request.                                                                                                 |
| Account has no preference                         | Retain this browser's choice. Do not turn the legacy default into a saved preference or silently upload an anonymous choice. The next explicit selection saves it to the account.                                                        |
| Signed-in selection                               | Apply immediately and save the enum to the private own-profile endpoint. Show saving, saved or failed/retry feedback in settings. Header and settings remain in sync.                                                                    |
| Save fails/offline                                | Keep the local selection for this visit/browser, announce that account sync failed and offer Retry. A reload must not claim it was saved across devices. Keep a dirty marker scoped to the account; retry only for that account.         |
| Browser preference changes                        | Update the resolved appearance only in System. Keep the menu's selected value System.                                                                                                                                                    |
| Sign out or switch account                        | Discard pending requests and account-scoped dirty state. Restore the anonymous browser preference (or System), then resolve the next account independently. Do not expose the previous account's preference or queue to another account. |
| Storage denied or unavailable                     | Work in memory with System fallback. No exception screen, login requirement or broken navigation.                                                                                                                                        |

Keep an anonymous preference separately from the active bootstrap mirror; applying an account choice must not overwrite the anonymous preference. Before authenticated profile resolution, the bootstrap mirror may reproduce the last appearance on that browser; it is a convenience, never proof of account identity. After sign-out, explicitly restore the anonymous value. Account-switch handling must not rely on a full page reload.

Implement latest-intent-wins semantics: capture a session/account generation and mutation sequence, serialize writes per account, ignore stale reads/responses and cancel obsolete retries. Cross-tab changes should update the view without creating a save echo loop. A server response may confirm a particular revision, not erase a newer local selection. Do not add high-frequency session polling or a network dependency to public-page theme resolution.

### Profile schema and migration

Add a nullable, private `appearancePreference` enum with `system`, `light`, `dark`; absence means no explicit account choice. Give it no migration default that pretends a user selected it. Deprecate the old `theme` field; leave its data intact during rollout. Only migrate legacy choices if there is reliable evidence of explicit selection, otherwise leave the new field unset. Record aggregate migration results without exporting user records.

Change these paths together:

- `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json`: private enum; no public exposure.
- `apps/strapi/src/api/user-profile/controllers/user-profile.ts`: explicit redaction/public projections; owner-only writes.
- `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts`: narrow allowlist and validation.
- `apps/ui/src/app/api/profile/me/route.ts`: strict enum validation and own-account response; reject arbitrary values rather than passing them through.
- `apps/ui/src/lib/types/profile.ts` and generated Strapi types: separate preference from resolved appearance.

After the schema change, run `cd apps/strapi && pnpm generate:types`. Verify create/update, existing accounts, public profile, public author/contributor projections and account export/delete behaviour. Prefer a dedicated appearance mutation in the existing own-profile route over submitting the entire settings form. A schema `private` flag alone is insufficient where custom serializers bypass it.

## Tokens and visual decisions

Retain semantic role names and add `.dark` overrides centrally. Choose one class authority on the document element. Set native `color-scheme` to the resolved appearance so selects, inputs and scrollbars agree. Preserve existing intentional dark surfaces through explicit inverse roles; avoid a pile of local `dark:bg-*` patches.

| Role family                  | Light direction                    | Dark direction / acceptance                                                                                                                                    |
| ---------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas, rail, sidebar        | Existing warm canvas and dark rail | Mockup starts at `#0F0E1D`, `#0A0A16`, `#15142A`; check navigation and adjacent surfaces.                                                                      |
| Panel and raised surface     | White and warm off-white           | Starts at `#1D1C33`, `#24233D`; distinguish layers with fill and essential edges, not shadow alone.                                                            |
| Main, secondary, muted text  | Existing ink hierarchy             | Starts at `#F3F1FA`, `#B3B0C8`, `#8C89A6`; audit small metadata and placeholder use on every actual surface.                                                   |
| Accent                       | Indigo links and solid actions     | Separate link ink, selected background, solid action background, on-action ink and focus ring. Violet link colour must not become pale text on a light button. |
| Border and divider           | Existing quiet dividers            | Decorative dividers may stay subtle. Essential input edges, focus and selected indicators require stronger roles.                                              |
| Status and library type      | Existing hue families              | Paired background/foreground tokens for success, pending, error, information and type tags. Keep text/icon labels in both appearances.                         |
| Inverse, overlays and scrims | Explicit inverse roles             | Menu, sheet, tooltip, toast and modal surfaces share the same resolved theme, including body portals.                                                          |
| Data, map, code and editor   | Explicit specialised roles         | Separate series/land/water/selection/code roles, not an automatic image inversion.                                                                             |

Initial mockup checks are calculated sRGB pairs, not browser audits. White on `#6D63F0` is about 4.475:1 and the mockup's off-white text on that solid is about 4.000:1: both miss normal-text AA. Do not round 4.475 up to a pass. Test the actual composite token pair and all hover/active states before choosing the action colour. The light-violet accent also fails as ordinary text on the warm light canvas (about 1.946:1). Keep appearance-specific role pairs.

Audit alpha compositing over actual backdrops. `--t-ink-low`, faint text and translucent lines need explicit decisions; disabled controls have exceptions, but essential instructions and current values must not be styled as disabled. Keep photo pixels unchanged. Retain library hue categories and users' stored avatar colour choices, changing presentation pairs where needed. Maps may need an intentional light basemap in an early development slice, but that exception must be documented and resolved before advertising a complete theme.

### Section coverage

| Surface                                         | Specific work and preservation requirements                                                                                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home, discovery, library/place/network pages    | Hero gradients, image overlays, cards, opening-hour tables, source drawers, unknown data labels and skeletons. Keep photographic credit and readable text.                                                  |
| Atlas and Reach                                 | Map style/layers, markers, legend, popup, selection, chart and export preview. A theme change must preserve camera, filters, selection, source credits and calculation state; guard async style loading.    |
| Journal, Knowledge, discussions                 | Reading surfaces, article blocks, code, quotes, contribution/newsletter panels, indented replies, editor and pending moderation. Preserve reply targeting, drafts, uploads, reactions and moderation rules. |
| Staff, Team, billing, API and moderation        | Shared workspace headers, independent access states, tables, forms, charts, permissions and empty/error/loading states. Hosted payment-provider pages are outside our theme guarantee.                      |
| Profile, account, authentication and onboarding | Public/private profile separation, appearance save feedback, autofill, validation, password-manager and keyboard flows.                                                                                     |
| Drawers, search and mobile navigation           | All portals, sticky bars, edge tabs, nested overlays, focus return and safe areas. No unreadable surface during entry/exit.                                                                                 |
| Beta, legal and alternate roots                 | Early layout branches need tokens and the control or an intentional reachable equivalent. Live-console dark surfaces need an explicit policy, not accidental double inversion.                              |
| Widgets and embeds                              | Decide a versioned `light                                                                                                                                                                                   | dark | system` embed option. Host cannot read an iframe's storage; derive System within its environment or an explicitly validated host message. Preserve explicit embed overrides and existing published versions. |

## Header and settings controls

Build one reusable `AppearanceControl` with compact header and settings presentations. Reuse existing menu/radio, icon and focus primitives; do not add a new overlay stack. The header opens a labelled menu with Light, Dark and System radio items. A sun/moon/monitor icon supplements a stable accessible name such as “Appearance: System (currently Dark)”. Do not rely on icon shape or tooltip alone. System stays selected when its resolved appearance changes.

Use the actual header composition points (`RecordToolbar`, dashboard navigation and public/mobile equivalents), not an extra top-level floating switch. Check duplicate desktop/mobile DOM: hidden controls must not remain focusable. Place appearance near language/settings utilities, preserving room for search and sign-out. Keep the API destination in the Navigation drawer.

Add Interface appearance to the account settings navigation in `SettingsShell.tsx`, with a direct-route fallback and the existing intercepted drawer behaviour. Explain “System follows your browser's appearance preference.” Use a three-option radio group for the expanded settings presentation and shared selection/save logic. It must not require saving avatar colour or other profile fields. Localise labels, descriptions and save/error announcements in English, French and Czech. Avoid announcing a full page change on every toggle; announce only the relevant selection or save result.

Keyboard gate: open with Enter/Space, arrow through menu radio items, Escape closes, focus returns to trigger; settings radio group follows native radio keyboard behaviour. Use at least the WCAG target-size minimum and aim for 44 CSS-pixel touch targets. No global colour transition or animation on every theme change; avoid motion on initial paint and honour reduced motion.

## Rendering, performance and security

Reuse next-themes rather than reading local storage during React server render. Keep its bootstrap script nonce from `ClientProviders`; extend existing nonce regression tests. Add only the narrow document-element hydration handling required by next-themes after checking the current root layout. Mounted-dependent labels may use a stable placeholder with the same dimensions; do not hide the whole page until JavaScript runs.

Test a hard navigation with a known local preference under a slow CPU/network: the document background and native colour scheme should match before first meaningful paint, with no hydration warning or control jump. A first visit on a new device cannot know an authenticated preference until it is fetched unless the server supplies it. Accept a single documented account-resolution change in that case; do not claim zero flash for unknown data. If server-provided preferences are later added, use a private cache-safe boundary and never personalise shared public HTML with another account's value.

No new external font, analytics or theme service is required. Keep theme state small and avoid remounting the app, map or editor to apply it. Preserve CSP, beta access checks and server permission checks. Storage values are enum-validated and never used as arbitrary class names or URLs.

## Storybook as the working contract

Add a `theme` global to `.storybook/preview.tsx` with Light, Dark and System toolbar choices. The decorator uses the same lightweight appearance provider and semantic CSS as production, without session or profile calls. Apply the resolved class on the preview document element so portals inherit it. Use a separate storage key so preview choices never alter the application preference. Keep the chosen preference distinct from the resolved appearance in documentation.

Configure manager/docs chrome independently; a dark Storybook manager or background addon is not evidence that the canvas is themed. Document the distinction. Ensure docs tables, source blocks and multi-story pages remain readable. Shared document globals need cleanup between test stories to prevent leakage.

Add stories for the control in header, settings, pending save, failed save/retry, System resolving both ways and storage-unavailable fallback. Add token swatches with role pairs and status text. Extend existing components rather than producing duplicate dark-only component exports.

Required rendered stories: Button (loading accessible name), AppField (input ID/label/error binding), workspace header/access states, badges, form controls/autofill, search, pagination, notification, dropdown/menu, tooltip, dialog/sheet with portal, newsletter/sidebar CTA, article content/code, discussion tree/composer, chart legend, map controls and avatar palettes. Exercise each sidebar composition explicitly; an import transitively reaching `SidebarCTA` does not prove it was rendered.

Run deterministic Light and Dark projects in CI. System stories must explicitly emulate light and dark browser media; do not depend on the CI machine's setting. Existing interaction tests should cover keyboard/focus and async states in both appearances. Use visual comparisons for representative composed pages, not just token swatches. A toolbar is for exploration; it does not replace the two-mode test matrix.

## Accessibility sweep and release evidence

Target WCAG 2.2 AA for the complete flow, across Light and Dark. Automated checks alone do not establish conformance. Keep failures, affected routes, reproduction, severity, owner and retest evidence in the release checklist; use public examples without account/customer data.

| Check                       | Acceptance and method                                                                                                                                                                                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text contrast               | At least 4.5:1 normal text, 3:1 large text, including metadata, links, form values and error copy. Measure computed foreground/background after transparency.                                                                                                                                                                 |
| Essential non-text contrast | At least 3:1 where needed to identify controls, focus/state and graphical information. Do not require every decorative card divider to meet the control rule.                                                                                                                                                                 |
| Colour independence         | Success, pending verification, membership and library access retain clear labels/icons; map categories and graph series have legends and alternative readings.                                                                                                                                                                |
| Keyboard and focus          | All controls reachable, ordered and operable; visible focus, no trap except properly managed modal containment; return focus and selected state correct. Sticky headers, footers and edge tabs must not obscure focus. AA forbids complete author-created obscuration; use the stricter internal goal of fully visible focus. |
| Target size                 | WCAG 2.2 AA minimum 24×24 CSS pixels or a valid spacing/criterion exception; prefer 44×44 for primary touch controls. Check crowded toolbars and pagination.                                                                                                                                                                  |
| Zoom/reflow/text spacing    | 200% text resize; 400% zoom/320 CSS-pixel reflow without losing ordinary content or actions. Test text-spacing overrides and long translated strings. Genuine two-dimensional maps/tables still need accessible surrounding controls.                                                                                         |
| Forms and feedback          | Labels bind to actual inputs; errors associate with the field and are announced; no colour-only validation. Loading buttons retain names. Save/retry, empty, disabled and success states remain understandable.                                                                                                               |
| Screen reader               | Manual VoiceOver/Safari and NVDA/Firefox checks of appearance menu, settings save/error, search, nested replies and a modal. No duplicate theme announcements or hidden focusable variants.                                                                                                                                   |
| User preferences            | System changes while open, explicit override, reduced motion and forced-colours/high-contrast mode. Preserve system focus/colour choices; do not broadly opt out with `forced-color-adjust: none`.                                                                                                                            |
| Content and data            | Heading order, image alt/captions/credits, code readability, list/table semantics, chart/table alternative and map non-visual routes. No automatic inversion of photos.                                                                                                                                                       |
| Authentication              | Password managers, paste and accessible authentication remain usable. Theme controls must not require authentication.                                                                                                                                                                                                         |

The broader consistency audit's loading-button accessible-name and AppField binding issues belong in this sweep. Resolve root primitives before multiplying stories around broken defaults. Do not frame the release as “AA certified” without a completed assessment and scoped evidence. Update the accessibility statement with actual known limitations, not aspirational guarantees.

## Implementation slices and gates

Estimate 8–12 focused engineering days plus manual accessibility and production acceptance, assuming no major map/editor dependency issue. This is a planning range, not a launch promise. Each slice stays independently reviewable; do not combine the schema, all page restyling and editorial release in one change.

1. **Inventory and token contract (1–2 days).** Classify literals from the audit, record intentional inverse/art/data exceptions, approve role pairs and contrast. Add dark token foundation behind the existing forced-light gate, paired palettes, Tailwind class variant and token stories. Gate: representative controls readable in both modes; light appearance regression reviewed.
2. **Preference and persistence (1–2 days).** Add private enum, own-account validation/projections, generated types, coordinator, storage versioning, race guards and failure recovery. Gate: old default does not migrate to Dark, public endpoints never expose the new field, account switching/reload/two tabs/storage denial behave as specified.
3. **Visible controls (1 day).** Shared header menu, settings section, drawer/direct links and en/fr/cs. Gate: keyboard, accessible names, selected-vs-resolved state and save/retry tests pass; no lost profile drafts or duplicate focus targets.
4. **Section migration (2–4 days).** Shared primitives first, then editorial/discovery, staff/API/moderation, Atlas/editor/embeds and alternate roots. Keep existing behaviours and distinct domain components. Gate: coverage table has no unexplained theme gaps; light comparisons reviewed alongside dark.
5. **Storybook and accessibility acceptance (2–3 days, partly alongside the above).** Both-theme interaction/a11y and composed-page visual checks; manual keyboard, screen reader, zoom/reflow, forced-colours and real-device pass. Gate: no unresolved blocking functional/accessibility issue, and known limitations are explicit.
6. **Production acceptance and release (separate release window).** Use the existing protected branch/release process and operator acceptance. Validate actual account save, reload, CSP, all roots, API/staff permissions and no map/editor state reset. Remove forced light and expose controls only when the complete public rollout is accepted. Replace preview screenshots/copy with real deployed examples afterwards.

Run finite checks sequentially with bounded Node memory and one test worker. Reuse the existing Next/Strapi services; do not create another database or stack. For implementation, use workspace commands documented in `commands.md`: focused unit/integration suites, UI and Storybook typechecks, one finite Storybook build/test pass and representative Playwright/a11y checks. Full builds follow the relevant release gate. No application test pass is claimed by this planning/content change.

### Minimum functional matrix

Test anonymous and signed-in; Light/Dark/System; browser light/dark/live change; hard reload/navigation/two tabs; slow profile load; old profile; cross-device saved choice; failed/retried/out-of-order save; sign-out/account switch; unavailable storage; JavaScript disabled baseline; CSP and hydration; desktop/mobile/zoom; English/French/Czech; nested portals; existing settings drafts. Account tests must assert private projections and authorisation, not just CSS classes.

### Rollback

Keep the additive preference field and saved values. A release switch can force Light and hide appearance controls together if a serious rendering issue appears; settings should explain temporary unavailability rather than showing controls that do nothing. Preserve CSP and avoid rewriting user choices during rollback. Revert faulty token/section changes through the normal release process; no destructive profile migration is needed. Check the forced-light fallback with old and new profiles before launch.

## Editorial release, screenshots and Design system Knowledge

The companion [publication bundle](./editorial/README.md) contains one Journal preview, an update to “How the site is designed”, and three additional Design system articles. Reuse the existing `design-system` Knowledge section and `from-the-index` Journal section; resolve production relations by slug, never local document IDs. Reuse existing rich-text/image blocks; no content schema changes are required.

Preview wording explicitly says appearance controls are forthcoming. The publication bundle now uses real Light/Dark Journal captures from the development implementation, with captions stating that the feature is unreleased. The original API mockup captures remain design references. The homepage excerpt is also a development capture, not evidence of a deployed theme. Do not publish internal account, billing, moderation or customer screenshots. English copy is provided; preserve existing translations and do not claim translated documentation is updated.

Production publication needs the existing approved editorial connection, read-before-write inspection, refusal of unrelated drafts, private before-images, media upload/ID checkpointing, metadata preservation and published readback. If that connection is unavailable, keep the bundle reviewable and leave production untouched. Never silently publish to local instead or reopen disabled infrastructure. Post-release, change the announcement's availability paragraph, screenshot real controls and expand operational instructions only after owned acceptance.

## Reference material

- [next-themes documentation](https://github.com/pacocoursey/next-themes/blob/main/next-themes/README.md): class handling, system resolution, hydration, persistence and CSP nonce.
- [Tailwind dark mode](https://tailwindcss.com/docs/dark-mode): align the dark variant with the document class when users can override the system preference.
- [Storybook toolbars and globals](https://storybook.js.org/docs/essentials/toolbars-and-globals) and [manager theming](https://storybook.js.org/docs/configure/user-interface/theming): canvas controls and UI chrome are separate.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) and [focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).
