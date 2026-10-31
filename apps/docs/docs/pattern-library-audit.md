---
sidebar_label: Pattern library audit
---

# UI and pattern-library audit

The Storybook workspace establishes a catalogue around the current application source. The complete file inventory is generated in `apps/storybook/audit/`; it includes every UI source/style/test file and records uncovered components. This first review covers the common primitives and shared patterns, plus selected feature presentation. It does not claim that every application screen, account state or responsive layout has been visually reviewed.

## Ownership

Keep three component layers:

1. `components/ui` owns low-level interaction and accessible compound primitives.
2. `components/ds` owns repeated site presentation and small compositions.
3. Feature directories own domain vocabulary, data dependencies and workflow behavior.

`packages/design-system` currently owns CSS tokens and editor styles. Moving all React components there now would invert their dependencies on UI navigation, translations and domain types. Extract a standalone React package only after those dependencies have explicit boundaries.

## Changes made

| Repetition                              | Consolidation                                           | Preserved behavior                                                 |
| --------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| Journal and Knowledge metadata rows     | `ds/MetadataList` accepts typed label/value rows        | Semantic `dl`/`dt`/`dd`, ordering, links and existing styles       |
| Connect/replace feed test result blocks | `event-feeds/FeedTestFeedback` accepts result and error | Existing live region, alerts, result copy and success/warning tone |

Accessibility checks also found low-contrast metadata, filter counts, editorial eyebrows, tab counts, inactive primitive tabs and the plan-gate illustration. Their text now uses readable tokens without parent opacity reducing contrast.

The isolated featured-library story also exposed a zero-height inline-link container outside a flex carousel. `LibraryCard` now declares its display mode, and the featured story checks its rendered height. Library and editorial images now declare responsive sizes; library hosts can override the image slot size.

Both changes use the production component from their stories. There is no change to authorization, fetching, feed validation or publication behavior. Stories cover empty/result/error cases and metadata terms/values.

## Reviewed overlaps

| Family                                                        | Finding                                                                                                                        | Decision                                                                                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ds/Card`, `ui/card`, `LibrarySectionCard`, drawer cards      | Related surfaces with different contracts: a simple surface, compound slots, a labelled library section, or navigation actions | Keep contracts distinct. New generic surfaces use the existing primitive; do not merge navigation semantics into a universal card                     |
| `StatBlock`, `StatCard`, `KpiTile`, dashboard `RecordMetrics` | Plain statistic, tinted contribution tile, period comparison and record summary respectively                                   | Share tokens; keep their meaning explicit. A single component with all props would have many invalid combinations                                     |
| `Badge`, `StatusBadge`, `PlanChip`, event chips               | Filled label versus outlined status with icon; plan/event wrappers add domain vocabulary                                       | Prefer wrappers around a suitable base. Review event chip sizing/tints before standardizing; matching color alone does not make them equivalent       |
| `IndexPager`, `PaginationControls`, `Pager`                   | One-based callback pagination, zero-based callback pagination and links between adjacent content                               | Keep link pager separate. Callback controls can converge after compatibility tests cover index conversion, hiding rules, labels and active-page state |
| `Drawer`, `Sheet`, `FilterDrawer`, `DrawerPresence`           | Sheet/filter variants already compose Drawer; presence owns teardown after focus restoration                                   | Preserve this composition and test real portals. Avoid another independent focus trap                                                                 |
| `SearchField`, `CatalogueSearch`, feature search              | Field appearance is shared; catalogue owns paginated async options; features own result semantics                              | Keep the generic field and explicit async loader. Move data access out of presentation before adding larger feature stories                           |
| `PageHero`, `WorkspaceHero`, `WorkspacePageHeader`            | Public editorial and record heroes retain their slots; routine staff/API pages now use a constrained page/task header          | Use `WorkspacePageHeader` for operational pages. Its stories cover literal titles, actions, context, narrow layouts and shell-owned navigation        |
| Editorial toolbars and action pill constants                  | Repeated button recipes with dark/subtle context                                                                               | Compare with `Button`/`buttonVariants` using stories before migrating callers; preserve contrast and minimum target size                              |
| `elementary/AppDialog`, primitive Dialog and Drawer           | A legacy app wrapper adds confirmation-on-close behavior                                                                       | Do not replace it with a drawer or remove confirmation during visual cleanup                                                                          |
| Route components, providers, server readers                   | Many components include session, CMS, analytics or Next request dependencies                                                   | Create stories at an explicit presentation boundary; do not load production providers into Storybook                                                  |

The generated structural findings include further candidates in moderation applicant summaries, auth feedback and event location rows. Each candidate needs a call-site and behavior comparison before extraction. Repeated class lists may be shared visual language; a new abstraction is useful only when it reduces ownership and change points.

## Staff-area follow-up

The staff normalisation added direct stories for the shared page header, panels, library-access badges, Team-status badges, seat usage, claim steps and request summaries. `Features/Staff/Access overview` shows an active, unverified Team alongside pending personal library access. A draft never becomes “awaiting review”, and missing Team details do not become an inactive or unverified state.

`DashboardOverlayContext` was separated from `DashboardFrame` so rendering a header does not import authentication, history effects or drawer stores. The stories use the real provider for the navigation-ownership case. The existing browser seams are unchanged.

Narrow French labels, Czech claim guidance, long library names, full/over-capacity seats and unavailable requests have explicit examples. These are presentation checks. Full staff routes, service-management workflows, widget publication, billing and API-key mutations still need their application tests and authenticated browser review; the catalogue does not claim to exercise them.

The widget overview also has typed draft/published, empty, inactive-Team, member and narrow examples. Its source-guidance interaction checks the distinction between selecting public data and gaining staff authority. Catalogue searches and writes remain behind the preview’s service-request guard.

The narrow example exposed a production layout bug: a fixed thumbnail squeezed the widget details into a thin column, and the publication badge overflowed the card. Widget rows now stack below a container-width threshold; status labels, long names and action labels can wrap. Wide rows keep their existing arrangement.

## Interface checks

The shared-pattern review also used the [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md), alongside the browser accessibility checks.

- `apps/ui/src/components/ds/IndexPager.tsx:46`: added a labelled navigation landmark, translated control names and current-page state; replaced the broad transition and disabled it for reduced motion.
- `apps/ui/src/components/ds/MetaRow.tsx:18`: corrected metadata contrast.
- `apps/ui/src/components/ds/FilterPanel.tsx:296`: corrected filter-count contrast.
- `apps/ui/src/styles/editorial.css:177`: corrected count contrast in pill navigation.
- `apps/ui/src/components/ui/tabs.tsx:67`: corrected inactive-tab text contrast.

The legacy `FilterGroup` dimmed appearance and broader feature forms/motion still need their own state and interaction review; the passing catalogue states are not a compliance certificate for the whole application.

## Storybook visual pass

The October 2026 pass inspected all 306 existing story states and 107 Docs entries, plus a representative state from every CSF module at 390 px and in dark mode. The catalogue rendered without story errors. This is a review of the isolated catalogue, not authenticated application routes.

The small production changes from this pass are:

- Input and textarea surfaces use the shared deep surface in both themes, with consistent rounded corners and more comfortable padding. Textareas retain automatic growth and have a taller empty state.
- Library-card captions keep a dark gradient behind white text in light and dark mode; secondary captions and keyboard focus are clearer.
- Action callouts wrap their copy and action according to available width. Staff claim steps choose columns according to available width, so a narrow panel inside a desktop viewport stays readable.

Story examples now separate labels from their fields, use unique label/heading IDs when several examples share a Docs page, and show contained validation messages. Filled, invalid and read-only field states make the treatment easier to compare. The label example includes its associated input.

Open modal presets use isolated Docs previews so their portals do not cover the documentation. Their primary examples remain inline for live controls. Fixed tabs stay within their own preview; appearance, Journal and conversation examples use unique anchors without changing the application’s default anchors. Long audit paths wrap or scroll within their own table, and the editorial toolbar does not expose its React action element as a JSON control.

No fetching, permissions, submission, navigation or publication rules changed in this pass. Existing keyboard, focus-restoration and interaction stories remain the behavior checks.

Validation passed for 311 stories in each appearance (622 browser checks), Storybook lint/typechecking, the static build, the refreshed inventory check and the existing field-label contract tests. Follow-up browser checks verified live Docs controls, inherited modal-preset themes, unique example IDs, label focus and textarea growth.

## Complete component catalogue

The follow-up coverage pass adds direct or composed examples for all exported visual components, including reusable UI stored under route directories. Opening hours now have their actual weekly table, split sessions, staffed/self-service periods, overnight schedules, status and today cards, editing controls and schedule overrides. The library visit card also contains a real hours example.

The expansion includes public and editorial pages, contribution editors, community/drive interfaces, authentication and account presentation, staff and moderation tools, events/feed management, widgets, maps and mobile-library screens. All service/session responses are synthetic. Maps and globes retain their real rendering implementations with local styles, geography and workers.

The export-level source of truth is `apps/storybook/audit/components.csv`; the handwritten exclusions are `component-exclusions.json`. The checker distinguishes direct examples from references in a production composition, rather than counting unused imports as coverage. Nonvisual contexts and runtime installers have an explicit reason. Framework page/layout entrypoints remain application hosts; their reusable UI is included.

This coverage gate prevents components silently disappearing from the catalogue. Coverage does not imply every possible state, device, permission combination or live service transition has been exercised.

The completed catalogue contains **1,589 stories in 890 CSF modules**. The export scan accounts for **1,040 distinct components**: 1,007 direct examples, 14 composition references and 19 nonvisual classifications, with none missing. The generated static index contains all 1,589 named stories; the build now rejects silent story/Docs ID collisions.

Validation used complete light and dark browser sweeps, followed by focused rechecks of every repaired state and the consumers of changed shared typography. Catalogue lint, typechecking, the textarea's three label/native-attribute regression tests, inventory/export checks and the static build passed. Focused lint of edited UI source reports no errors and retains existing complexity warnings. Live Docs checks confirmed the opening-hours catalogue and the labelled textarea presentation.

## Decisions from the expanded catalogue

The new direct examples make previously nested UI comparable. These are the follow-up boundaries identified during story authoring; they are not instructions to merge whole features behind rendering flags.

| Family                                                 | Decision                                                                               | Reason                                                                                                                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Library verification fields and actions                | Reuse the exact `FIELD`, `PRIMARY` and `SECONDARY` recipes from `contribute/wizard-ui` | Their local strings match exactly. One recipe can govern focus, spacing and appearance without changing the forms.                                                           |
| Library editor input/textarea wrappers                 | Extract a small field shell in a separate change                                       | Label/state tags, hint IDs, error presentation and ARIA wiring repeat. Keep native input, textarea and select contracts separate; do not introduce a field-type switchboard. |
| Live console and simulation preview                    | Keep controllers separate; retain shared `LiveConsoleScreens`                          | Authentication, geolocation and offline delivery differ from simulations. The visible current/next/finished screens already share an implementation.                         |
| Role application, settings and onboarding sticky rails | Share the sticky/height/scroll recipe in a separate change                             | Identical layout rules repeat. Each host must retain its content, responsive behavior and landmark label.                                                                    |
| Knowledge and network directory pagination             | Consider a small link-pagination presentation                                          | Previous/next links and page summaries overlap; route/query adapters remain with their feature. Journal’s numbered window and callback pagination have different contracts.  |
| Journal and Docs loading wrappers                      | Keep the wrappers around `DashboardLoading`                                            | They already reuse the real primitive and encode useful section defaults and image variations.                                                                               |
| Profile section and staff panels                       | Reuse a common surface/header in a separate change                                     | Border, radius and title structure overlap. Keep profile progress anchors and required/optional labels in their domain wrapper.                                              |
| Checkout and Team purchase progress                    | Extract transactional progress presentation separately                                 | Ordered stages, completion markers and `aria-current="step"` repeat. Keep billing controllers and translations separate; instructional `StepsCard` has a different purpose.  |
| Discussion feed, preview and moderation review cards   | Keep composites distinct; reuse their existing leaves                                  | Their information and authority differ. Avatar, time and image presentation already share implementations.                                                                   |

The browser review also exposed missing field names, duplicate/nested landmarks, low-contrast states, focusable code scrolling and error-target references. Those fixes change presentation and accessibility semantics while retaining service, permission and submission rules.

## Continue the review

The cross-site follow-up is implemented in three batches: shared-control contracts and confirmed duplicates; button/pagination/avatar reuse; then page-purpose compositions and direct Storybook coverage. See [the implementation record](./ui-consistency-rollout.md) for contracts, compatibility decisions and deliberate boundaries. The earlier comparison tables record the initial review; the follow-up supersedes their callback-pagination and button-recipe recommendations.

Use `inventory.csv` to work by owning feature, not filename order. A completed feature review should leave:

- Typed, synthetic fixtures for its visible states and any service responses.
- Stories for the public presentation and relevant permissions/plan states.
- Keyboard, focus and error-recovery checks for interactions.
- Desktop and narrow-layout review, with long names and translated labels.
- A recorded decision for each repeated pattern: reuse, extract, keep distinct or retire after migrating callers.

Prioritize the dashboard shell/navigation and library records next, then event browsing and feed management, editorial readers, contribution/editor flows, moderation, account/staff/billing, and atlas/map/WebGL. Authentication and map/editor integrations need dedicated boundaries and should not be represented by fake components that merely resemble them.

The source is undergoing a dashboard migration. The inventory follows the current working files, including new route groups; do not resurrect removed routes or consolidate against an older branch snapshot.
