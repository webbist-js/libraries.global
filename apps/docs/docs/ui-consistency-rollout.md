# Shared UI consistency: three implementation batches

30 October 2026. This follow-up applies the cross-site consistency review to the current dashboard migration. It preserves section vocabulary, specialised records and permission workflows. It does not implement the separate dark-mode proposal.

## Batch 1: shared-control contracts and small duplicates

- Loading `Button` keeps its original action text in the accessibility tree and its layout, exposes busy state and disables native activation. Slotted unavailable links are inert and marked disabled. Stories no longer supply a special label/disabled override that hides the primitive's defaults.
- `AppField` applies `FormControl` to the input, preserving generated and custom IDs, label association and help/error descriptions. The field wrapper no longer clips the focus indicator. Required-marker decoration stays out of the accessible name.
- `SearchField` binds its label to the final input ID, merges caller styles/classes, exposes loading state and prevents disabled/read-only clearing. Its focus treatment and placeholder use readable shared roles.
- Staff and Editorial use `DrawerEdgeTab` for presentation. Each owner retains its existing permission checks, shortcuts, route exclusions, mutual exclusion and drawer/focus handling.
- `ApplicantSummary` renders the same contribution evidence for role applicants and drive proposers. Empty-data messages remain contextual; no grant or moderation-decision logic moved.
- `EventTags` replaces the duplicate reader/drawer tag markup. The three-tag limit remains; tags can wrap and do not become event-type or access-state badges.

## Batch 2: buttons, pagination and avatars

`Button`/`buttonVariants` now own compact pill and inverse-surface recipes. Editorial toolbars, drawer actions, shared callouts, drive CTAs, discussion directory actions, Journal paging and compact editorial submission actions reuse those recipes. The old independent CTA classes in `lib/styles.ts` are retired; `ui/action-styles.ts` is a compatibility name around the shared recipe. Stateful filter chips and specialist destructive-action policy remain with their owners.

`PaginationControls` is the callback renderer. `IndexPager` adapts its one-based API to the zero-based callback contract and still hides for zero/one page. The compact control retains its single-page rendering and disabled state. A bounded page-window helper avoids iterating over every result page. Both retain first/last shortcuts, translated names and `aria-current`.

URL-based directory and Journal pagination remain links, preserving query filters and normal link behaviour. Adjacent-article `Pager` remains distinct from result pagination. Visible directory and adjacent-item labels are translated rather than hard-coded in English. Journal keeps its existing page-window and range-summary policy.

`ProfileAvatar` owns image rendering, image-error fallback, decorative/named semantics and dimensions. Discussions, community standing, leaderboard, account trigger, public profile and account headers use it. Hosts retain their palette, identity lookup and initials policy. A new image URL is tried after an earlier URL fails. The account header keeps its responsive CSS sizing. The initials-only `Avatar` remains available for its tint/gradient use cases, with safer empty/Unicode fallback and negative gradient indexes.

## Batch 3: page purpose and real Storybook compositions

- Editorial and directory pages retain `PageHero`; operational pages use the constrained `WorkspacePageHeader`. Community headers now use the existing workspace-aware wrapper, so a persistent workspace owns its navigation and breadcrumbs.
- Drive creation, proposal and editing use task headers with literal titles and existing flow guidance. Compact contribution headers adapt their legacy emphasis markup to ordinary task-title text and keep the back route.
- Discussion details no longer repeat the directory hero before their own title. `DiscussionThreadHeading` is the actual reader presentation boundary, with activity, context and subscription slots. Error/unavailable states retain a heading and back route. Embedded discussions retain their host's heading.
- The unused `CtaBannerSection` and `LocationContributeCTA`, their exports and the obsolete CTA story are retired after checking active imports. `ActionCallout` and the current sidebar CTA remain the supported compositions.
- Direct stories cover AppField validation/custom IDs, the real sidebar CTA and Knowledge footer, applicant evidence, event tags, edge tabs, avatar states and editorial/task/community/reader compositions. Portal and service boundaries stay unchanged; no production provider or new service seam is added.

Storybook examples use production components and synthetic content. A component's import reachability is not treated as rendered coverage. The generated inventory is refreshed after the changes.

## Deliberate boundaries

Team membership, verification, affiliation and library-management authority remain separate domain states. Maps, record heroes, discussion replies, opening hours, confirmation dialogs and overlay focus handling keep their specialist contracts. Similar authentication feedback does not automatically justify merging forms with different recovery workflows. Repeated classes are a review signal, not a mandate to create a universal component.

The working tree already contained substantial dashboard and route changes. This pass follows the current route group and does not restore removed routes or rewrite unrelated work. No CMS schema, production content, authorization or billing behaviour changes.

## Validation

Targeted UI regressions cover generated/custom field IDs, descriptions/errors, loading submission prevention, disabled clearing, one-/zero-based paging, single-page hiding, query-preserving translated links, image failure/new-image recovery, profile triggers and discussion interactions. Storybook interaction/a11y checks exercise the production presentations and their narrow compositions. Typechecks, lint, a finite Storybook build and inventory verification are recorded in the task result; these are not a whole-site accessibility certification.

| Final check                               | Result                                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Complete Storybook interaction/a11y suite | 104 files, 303 stories passed; one browser worker                                                     |
| Targeted UI regressions                   | Passed, including discussion, staff, profile, leaderboard, field and pagination suites                |
| UI typecheck                              | Passed with a bounded 4 GB heap; the initial 2 GB attempt exhausted its heap                          |
| Storybook typecheck                       | Passed                                                                                                |
| Scoped UI / Storybook lint                | No errors; 31 UI warnings remain, chiefly complexity, destructuring and list-key rules                |
| Static Storybook build                    | Passed; Vite reports its usual large-chunk warnings                                                   |
| Generated inventory and freshness check   | Passed: 2,114 UI files, 892 component/route files, 104 CSF modules and 303 stories                    |
| Running UI review                         | Discussion directory and member-preview reader checked; reader has one H1 and retains back navigation |

The AppField validation story exposed a low-contrast error adornment; its error ink and shared muted background were corrected before the passing full Storybook run. Story controls are connected to actual component props, including AppField and the separate Knowledge footer examples.
