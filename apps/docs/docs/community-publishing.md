# Community publishing

Journal contains platform writing and community stories. `publicationOrigin` separates **From the Index** from the community collection; promoting a community story does not change its origin. Existing Journal posts default to `index`. Knowledge retains its reference structure, home section and existing URLs.

Readers can combine language, geography, Library, Topic, author and Event citation filters. Values within a filter are alternatives; different filters narrow the result together. Collections start with all content languages; interface language does not impose an article language filter. An explicit URL country wins over a browser preference; an account country is an optional suggestion. Readers can always return to all countries.

Geography is editorial context. Publishing captures a derived snapshot from the chosen places and Libraries. Moving a Library later does not relocate an older story. A Journal Event mention stores a public citation and occurrence details, so deleting an imported Event retains the story's context. Event credentials and import metadata are excluded.

An article may reference a record available in another language. Relation resolution prefers the article language, then the configured default language, then a stable available public variant. Sections and Topics keep their document identity even when a translated slug differs from the editor's selection.

Strapi 5.57 forces matching languages for relations between localized content types; a target `locale` annotation alone cannot override this. Its publication clone also drops cross-language document relations. The article helpers resolve fallback entity IDs from public CMS records, and the article middleware restores those exact public links within the publication transaction. This covers article sections, Topics, Libraries, places and Event citation Libraries on creation, edits and explicit admin publication. Citation Libraries are captured before core rewrites the components. Review comparisons read stored relation identities internally so draft-status population cannot hide a published fallback record; the complete body, media, SEO and relation guard remains in place. Client entity IDs and unpublished target versions are never used for restoration. The target records are not cloned to create translations.

Writer section and place pickers choose each document's article language, configured default language, then a stable public fallback. An English-only place or section remains selectable beside translated records. Parent-filtered lists retain their eligible document identities while loading translated names and regional terminology. The proxy pages through the CMS's actual REST limit and reports an unavailable list when its document or variant ceiling is exceeded, rather than returning a truncated list.

## Writing and review

Every Knowledge article has a Markdown representation at `/knowledge/{section}/{slug}.md`, with the same optional locale prefix and `contentLang` query as its HTML page. The export preserves the published body, public links and media, identifies its canonical HTML source, and redirects outdated section paths. It always reads published content, even when the requester has a CMS preview cookie. HTML article metadata advertises the Markdown alternate. `/llms.txt` lists every published Knowledge variant in the supported content languages, using paginated public catalogue reads; an unavailable or incomplete catalogue returns 503 rather than a partial list. CMS reads use the existing five-minute tagged cache and article/taxonomy invalidation. These routes retain beta and staging access rules.

Signed-in members can draft Journal stories and propose revisions to their own stories. Journal editors can revise other authors' work in their granted languages. Knowledge direct editing remains scoped to Knowledge editors. Library staff roles do not confer article publication or discussion moderation authority.

Drafts are private and resumable. Submitting freezes the review payload. A different, scoped moderator approves, requests changes or rejects it. Requested changes reopen a private draft; resubmitting creates another audited review snapshot. An approved revision keeps the original author; editors and translators receive contributor credit.

Private submission queries are keyed by the current account. The contribution layout compares the server-authorized account and scope with the hydrated session; account changes or revoked grants unmount private editors and queues, cancel pending autosaves and reload authorization before showing new private content.

New Journal writers may choose a public pen name. A blank byline uses a permitted public username or “Community member”, rather than copying a private account name. Profile links and public author filters honour profile visibility and activity preferences. Existing textual bylines remain editorial content.

A revision carries the publication it started from. Intervening changes refuse approval. The writer compares the current publication and explicitly adopts its revision before resubmitting; autosave never silently rebases. Existing article images are retained for other editors. New images require durable upload ownership, and unowned images refuse approval.

The publish guard compares complete article content, media, SEO and relations. Unrelated admin drafts remain unpublished when a reviewed change is applied. Reading time and geographic snapshots are derived fields; the idempotent startup backfill fills these without rewriting bodies, slugs or publication state.

## Discussions

`packages/strapi-plugin-discussions` is an independently installable Strapi 5 plugin. It provides subjects, standalone or attached threads, replies, moderated revisions, reports, subscriptions, audit history and a durable notification outbox. Its README documents installation, APIs, identity/target adapters and standalone acceptance tests.

Libraries Global supplies Better Auth identity, current public profile projection, published article/Library target resolvers and in-app notifications. The `discussions` moderation queue is explicit; Journal or Knowledge editor roles alone grant no forum moderation. The community UI supports author recovery, conflict handling, reporting, following and review. Journal, Knowledge and Library pages expose attached discussions.

Production hosts must set `DISCUSSIONS_MEDIA_DIRECTORY` to a persistent private directory owned by the CMS process and mounted outside `public`. Keep the same volume through image replacement and include it in private recovery procedures. The plugin's `.tmp` default is for development; container-local images would be lost on replacement. Media still passes the plugin's authorisation and review checks when served.

Moderator applications can request Index, Knowledge, Journal or Discussions. Discussions applications retain their requested languages, have no article-section selection and require the usual accepted-contribution threshold and board approval. Approval creates only the requested queue/language grants. Decision emails name the queue. Feed curation remains separate from message review.

Moderation language is the language of the thread, reply or immutable revision being reviewed. A reply may use a different language from its parent thread. Private-thread access is checked separately, so a reply-language grant cannot open an otherwise inaccessible thread.

Account deletion calls the plugin's trusted erasure service: approved public text survives with generic attribution, while private proposals, subscriptions and identifying audit data are removed. Imported Events are referenced through durable Journal citations.

## Operations and compatibility

Generate Strapi types after schema edits. Build the shared packages and plugin before the CMS. The deployed CMS resolves the plugin through its production package dependency, without a repository-relative runtime path. Existing Journal/Knowledge content UIDs, section slugs and routes remain available.

Profile identity changes and cross-language publication repairs enqueue durable search reprojection and expire article caches after their transaction commits. The worker starts with the CMS, confirms search task completion and retries failed work every minute, including when CMS cron is disabled. Configure the application bridge URL/secret. Article/taxonomy publication webhooks use `/api/revalidate`; profile visibility changes expire attribution caches rather than serving a stale refresh. Rebuild article search indexes when introducing the new allowlisted facet fields. Browse aggregation fails explicitly when its configured catalogue ceiling is exceeded.

See [uploads](uploads.md) for bounded multipart parsing, reservations, ownership retries and orphan cleanup. Events are temporarily absent from the main navigation; their routes and Journal citation model remain available.

## Validation

Unit suites cover body round trips, privacy, browse predicates, ownership, conflict handling, resubmissions, gateway boundaries and presentation parity. Opt-in PostgreSQL checks require an approved isolated CI/acceptance environment with a disposable `community_publishing_*` database. They must not create extra services or schemas alongside the shared development stack. In that pre-provisioned environment:

```sh
cd apps/strapi
COMMUNITY_PUBLISHING_INTEGRATION=1 DATABASE_NAME=community_publishing_acceptance pnpm exec vitest run tests/community-publishing.integration.test.ts
COMMUNITY_UPLOAD_INTEGRATION=1 pnpm exec vitest run tests/content-moderation/upload-reservations.integration.test.ts
COMMUNITY_RELATION_INTEGRATION=1 pnpm exec vitest run tests/content-moderation/article-relations.integration.test.ts
```

These exercise content preservation, unrelated-draft publication refusal, concurrent revisions, image retention, Event purge, shared upload quota transactions and Spanish stories linked to English-only records. The standalone plugin also tests its packed tarball in separate Strapi/PostgreSQL hosts. Marketplace publication remains a package-owner release step after repository review.

Existing Journal rows with no publication origin are backfilled as From the Index. Explicit community or Index origins remain unchanged; this adds classification without rewriting the article or its publication state.
