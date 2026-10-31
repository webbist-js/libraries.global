# Appearance and accessibility baseline

30 October 2026. Source inspection, supplied mockup inspection and calculated colour pairs. This is a prioritised starting point, not a completed accessibility sweep or release acceptance.

The subsequent [UI consistency batches](../../ui-consistency-rollout.md) repair the loading-button name and AppField binding findings below. The theme, preference migration and two-appearance accessibility work remain part of the dark-mode proposal.

## Confirmed findings

| Priority                            | Finding and evidence                                                                                                                                                                                                                                                | Required change / verification                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Before enabling Dark                | The existing provider forces Light and disables System (`apps/ui/src/components/providers/ClientProviders.tsx`). Root theme tokens are light-only.                                                                                                                  | Implement paired semantic roles and audit routes before releasing the control. Removing forced Light alone is unsafe for visual consistency.                                               |
| Before migrating preferences        | The profile schema's old `theme` enum defaults to Dark despite the UI forcing Light.                                                                                                                                                                                | A new nullable explicit preference avoids treating a schema default as a user decision. Test old profiles and public-data redaction.                                                       |
| Before choosing action colours      | Supplied solid violet `#6D63F0`: contrast with white is 4.475:1, with `#F3F1FA` is 4.000:1.                                                                                                                                                                         | Both fail the 4.5:1 normal-text threshold. Adjust button roles and test actual composites/states; do not round up. This concerns the supplied palette, not every current app button.       |
| Before reusing dark accent in Light | `#A9A3F5` on `#F1EDE5` is 1.946:1.                                                                                                                                                                                                                                  | Keep appearance-specific link/foreground roles. A single accent foreground cannot cover both canvases.                                                                                     |
| Shared control repair               | `apps/ui/src/components/ui/button.tsx:69` replaces children with a spinner for `isLoading` without itself preserving the original accessible name or setting busy/disabled behaviour. A caller can supply those, but the primitive does not guarantee them.         | Retain an accessible action label; expose busy semantics and appropriate duplicate-submit prevention. Test the default primitive without story-only labels hiding the issue.               |
| Shared field repair                 | `apps/ui/src/components/forms/AppField.tsx:53` puts a wrapper `div` directly inside `FormControl`; that control's Slot applies generated input ID/description/error attributes to its immediate child. The actual nested Input does not automatically receive them. | Bind generated attributes to the real input. Verify label click, accessible name, description and error association in a rendered form. Explicit caller IDs may hide particular instances. |
| Storybook gap                       | `.storybook/preview.tsx` has a locale toolbar but no appearance global. Existing app CSS imports do not provide dark-mode coverage.                                                                                                                                 | Add the production lightweight provider, document-level class, isolated storage and deterministic light/dark interaction projects. Audit composed stories, not import reachability.        |

## Inventory for classification

The [machine-readable inventory](./source-audit.json) currently finds 562 hex literals in 126 source/style files and 222 `bg-white` occurrences in 134 files across the searched roots. Tests, stories and snapshots are excluded. Overlap is possible. Maps, illustrations and identity palettes account for some intentional literals.

Classify each occurrence as a shared interface role, intentional inverse surface, data/identity colour, artwork/photo, embedded/vendor surface or obsolete code. Start with the shared CSS and primitives; follow with map/editor/thumbnail and page-specific exceptions. Do not equate a literal with a failed contrast pair or delete library-category hue identities.

## Still requiring owned runtime assessment

- Actual computed contrast after opacity, overlays, image backgrounds, hover/focus/selected states and native autofill.
- Header/settings radio semantics, persistence, sign-out/account switching, CSP and first paint once implemented.
- Keyboard focus and return through nested drawers, portals, sticky bars and mobile navigation.
- Zoom/reflow/text spacing, touch targets, forced colours and reduced motion in representative complete flows.
- VoiceOver/Safari and NVDA/Firefox checks; maps/charts must include usable alternative readings.
- The deployed accessibility statement and actual known limitations after the sweep.

The supplied mockup and the editorial reading proof are not production implementation evidence. The current homepage screenshot is a development UI excerpt. The implementation plan defines how these remaining checks become release gates.
