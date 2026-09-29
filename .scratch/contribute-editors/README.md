# Contribute hub: Index editor + Knowledge editor (2026-09-29)

Status: built, verified locally (unit, lint, typecheck, access E2E, browser smoke); uncommitted on dev

## Scope

1. Merge /contribute/add and /contribute/edit into one **Index editor** tab
   (/contribute/index, /contribute/index/new, /contribute/index/[slug]).
   Anyone signed in can improve a record; claimants submit `library_edit`,
   everyone else a structured `correction` (`fields.kind: "record"`), both
   applied to the library on approval (C-L1).
2. Rebuild the **Knowledge editor** tab (/contribute/knowledge): landing with
   "write new" chooser + "edit existing" search; TipTap article editor with
   Write/Preview, sections, tags, autosave and submit for review; the same
   editor writes Journal articles (`blog_submission`).
3. Role split: new `journal_editor` contributor role and `journal.directEdit`
   capability (journal_editor + editorial_board). `docs.directEdit` stays with
   wiki_editor + editorial_board. Editors' approved changes publish; other
   contributors' approved changes land as a Strapi draft for an admin to
   publish, or as a new draft article.

## Bugs found while surveying

- Direct wiki edit autosave/finalize passed the numeric `id` to Strapi routes
  that validate a documentId → every PATCH/finalize failed with 400.
- Admin WikiEditDiffPanel read `block.text`, but drafts carry Strapi blocks in
  `block.body` → reviewers saw an empty body.
- `blog_submission` had no apply step and no points on approval.
- `wiki_edit` "new_doc" proposals were never applied (no slug → noop).
- Edit route only prefilled scalar fields (no hierarchy, hours, relations,
  social links) and sent the whole form, so a one-field edit scored "major".
- Dead code: contribute/edit/[slug]/\_components/{EditLibraryDiff,DiffFieldRow,EditSourcesSection}.

## Phases

- [x] P1 access + roles + rewards action
- [x] P2 Strapi apply logic (articles, library record), schema (docsSections, topics, libraries, contributors), admin panels, tests
- [x] P3 Next API fixes/additions (documentId draft routes, journal routes, /api/contribute/article, relations: topics, blog-sections, locales)
- [x] P4 Index editor UI + link updates
- [x] P5 Knowledge editor UI (TipTap, translations)
- [x] P6 Unit tests, lint, typecheck, E2E fixtures, browser smoke

## Amends (2026-09-29, later)

- Stepper restyled to the designed white active card; article list capped at 5 with "Show more".
- Moderation admin rebuilt on the Strapi Design System (table, filters, review modal, DS panels).
- Dependency alignment: DS + icons pinned to 2.2.4 (what @strapi/admin ships); icons declared in the plugin; admin Vite alias for config-sync's unmet icons peer.

## Follow-ups

- Local Strapi has one locale (`en`); add a second in Settings → Internationalization to see the Language card.
- Free-text tags are kept for the reviewer only; they don't create topic suggestions.
- Form fields with no library schema field (officialName, collectionSize, collectionTypes, specialCollections, architecturalStyle, imageCredit, imageNote) reach the reviewer but aren't applied.
- Local `claude-review@example.test` super admin was created for verification; remove it from Settings → Users when done.
- The read-only API token can't read `api::topic.topic`, so REST responses omit `topics`; grant it find on Topic if the UI should show article topics.
