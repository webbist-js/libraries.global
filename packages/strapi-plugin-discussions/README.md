# Strapi Discussions

A portable, headless Strapi 5 plugin for moderated subjects, independent threads and discussions attached to your content. Includes a Strapi admin review screen, immutable edit proposals, reports, subscriptions and audit history. MIT licensed. No host application packages or proprietary services are required.

## Install and enable

Version 0.1 targets Strapi 5.57 or newer in the v5 line, React 18 admin, Node 22 and PostgreSQL. PostgreSQL is the supported database for transactional review and row locking; do not claim other databases without integration tests. This source package has not been published to npm or accepted by the marketplace.

```sh
# In this package (development)
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm verify
pnpm pack

# In an independent Strapi host
pnpm add ./strapi-plugin-discussions-0.1.0.tgz
```

```ts
// config/plugins.ts
export default () => ({
  discussions: {
    enabled: true,
    config: {
      moderatorRoleIds: [], // Users & Permissions role IDs explicitly allowed to review
      requireConfirmed: true,
      targets: {}, // No attachments until a trusted resolver is configured
    },
  },
})
```

Start Strapi and grant its administrator role **Discussions: read**, **review** and/or **manage** in Settings → Administration Panel → Roles. Read opens the queue; review approves/rejects proposals and handles reports; manage creates/edits subjects. Community moderators use a separate identity and permission path. Content Manager and Content Type Builder do not expose internal records.

Create a subject in the Discussions admin page. Subjects have a unique slug, description, public/member/moderator visibility, permitted content languages, and member/moderator creation policy. An empty language list permits any valid BCP 47 language. Public subjects allow anonymous reads; every write requires a current authenticated account. All new threads/replies and edits require approval, including moderator-authored content. Self review is disabled by default.

## Identity and permission adapters

The built-in adapter verifies a Users & Permissions bearer JWT and loads the current user and role on **every request**. Blocked/unconfirmed accounts cannot write or read member content. Account/role changes take effect immediately. Body fields, identity headers and `ctx.state.user` do not establish community identity. A role becomes a community moderator only through `moderatorRoleIds`.

A custom `identity(ctx, { strapi })` hook can return `null` or `{ key, name, profile?, capabilities? }`. Verify credentials and query current account/grant state in this server hook. Never accept a browser-submitted author, role, email or unsigned identity header. `key` is a stable private reference; public responses expose only the validated name and optional slug/HTTP(S) profile URL. Namespace keys to avoid collisions. Never return `admin: true` from a community hook. Missing capabilities default to normal member actions; set an explicit empty list for read-only identities.

Optional `publicAuthor(authorKey, { strapi })` projects each byline from current host privacy/account state, returning `{ name, slug?, url? }` or `null`. When configured, stored profile/name snapshots are discarded from public thread/reply responses for both authenticated and anonymous readers. Return `{ name: "Community member" }` for a generic byline or `null` to omit it. Only validated name, slug and HTTP(S) URL fields are included; host profile IDs/emails cannot pass through the projection. Without this hook the standalone plugin deliberately preserves historical snapshot bylines.

The `authorize({ strapi, actor, action, subject, thread? })` hook can **narrow** normal permissions. It cannot grant authority that the actor/subject policy already denies. Supported actions: `read`, `createThread`, `reply`, `editOwn`, `report`, `subscribe`, `moderate`. An author's `editOwn` permission applies only to their own content. Strapi admin RBAC remains separate and can inspect hidden discussion records for review.

Type contracts are shipped at `strapi-plugin-discussions/types`.

## Attached targets

Configure `targets` as an allowlisted UID → asynchronous resolver map. Each resolver receives `{ uid, documentId, locale? }` and `{ strapi, actor }`, confirms that the document is readable now, and returns `{ title, url }` or `null`. Return public metadata only. Relative paths or HTTP(S) URLs without credentials are accepted; script/protocol-relative links are rejected. No user-provided UID is passed to Document Service automatically.

See [Users & Permissions example](examples/plugins-users-permissions.ts) and [custom identity example](examples/plugins-custom-identity.ts). The examples use a conventional `api::article.article` content type. Substitute your own schema and publication/access checks in the server resolver.

One attached thread is allowed per target UID/document ID, across all translations and subjects. `locale` does not enter its unique identity; the stored locale is a resolver hint. Hosts should choose a canonical target URL and resolve fallback locales deliberately. Thread and reply bodies each have an explicit content language; `language` filters do not silently merge languages. The optional `authorize` context includes `recordLanguage` for record moderation, edit, report and revision visibility checks. Use `recordLanguage ?? thread?.language` when narrowing locale grants: a moderator of an English thread must not automatically review Spanish replies. Private thread visibility is checked independently before accessing any reply proposal or report; review/audit queues apply the same record scope. Independent threads have no target.

Target visibility is rechecked during reads, writes and community moderation. Hiding a target hides its discussion. Hiding/removing a thread hides its replies; removing a root reply hides its child reply. Removed content remains available only to its author or permitted moderators, never through the public feed. Author revisions and report reasons are private. Reports preserve the reported text/version alongside current text so reviewers can assess later edits; removal requires the current record version. Reporter identity is never included in moderation API responses.

## Content API

Endpoints live under `/api/discussions`. Send `Authorization: Bearer <token>` for built-in identity; custom identity decides its credential transport. Request bodies contain only the listed inputs. Text is **plain text**, never trusted HTML; frontend renderers must escape it. Attachments, real-time chat and direct messaging are excluded.

| Method / path                       | Input or purpose                                                                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/my/records`                   | Own records; `kind=thread` (default) or `reply`, optional validated `recordId` and reply `threadId`; includes latest own pending proposal |
| GET `/subjects`                     | Subject discovery                                                                                                                         |
| GET `/threads`                      | `subjectId`, `language`, `targetUid`/`targetId`/optional `targetLocale` filters                                                           |
| POST `/threads`                     | `{ subjectId, title, body, language, target? }` → pending thread/revision                                                                 |
| GET `/threads/:id`                  | Visible thread; own pending/rejected thread or moderator inspection                                                                       |
| GET `/threads/:id/replies`          | Visible replies; optional `language` filter                                                                                               |
| POST `/threads/:id/replies`         | `{ body, language?, parentId? }` → pending reply/revision                                                                                 |
| POST `/records/:kind/:id/revisions` | `{ body, title?, baseVersion }`; `kind` is `thread` or `reply`                                                                            |
| GET `/records/:kind/:id/revisions`  | Author/moderator revision history                                                                                                         |
| POST `/records/:kind/:id/reports`   | `{ reason }`; one report per actor/record                                                                                                 |
| PUT `/threads/:id/subscription`     | `{ enabled: boolean }`; own subscription only                                                                                             |
| GET `/moderation/revisions`         | Permission-scoped pending proposals                                                                                                       |
| PUT `/moderation/revisions/:id`     | `{ decision, baseVersion, note? }`; decision is `approve` or `reject`                                                                     |
| PUT `/moderation/records/:kind/:id` | `{ action, baseVersion, note? }`; action is `remove`, `lock`, `unlock`, `pin` or `unpin`                                                  |
| GET `/moderation/reports`           | Permission-scoped reports                                                                                                                 |
| PUT `/moderation/reports/:id`       | `{ decision, baseVersion, recordBaseVersion?, note? }`; decision is `dismiss` or `remove`, and removal requires `recordBaseVersion`       |
| GET `/moderation/threads/:id/audit` | Permission-scoped audit events                                                                                                            |

Lists use `limit` (default 20, max 50) and `offset` (max 100000), returning `data` and where applicable `nextOffset`. No raw count of inaccessible records is returned. Filtering can make a page shorter; advance using `nextOffset`. Bodies cap at 20000 characters; titles at 250; reports/private notes at 2000. Configuration may lower limits. Persistent per-actor write windows default to 120 community writes/hour across threads. Rejected/rolled-back writes do not consume a slot. Use host infrastructure rate limits for anonymous requests and hostile IPs.

The plugin owns publication explicitly: records are outside Draft & Publish. New records start `pending`; approval makes `visible`; initial rejection makes `rejected`; removal is terminal. Lock/pin are independent flags. An edit stores a new immutable body/title proposal and leaves approved text intact. A transaction locks the parent thread before changing any reply, review, report or subscription. Approval compares proposal base version with current content and returns 409 on conflict. The same reviewer repeating the same committed decision succeeds without creating another event. A conflicting decision returns 409. Stale proposals may be rejected to clear the queue. Every caller must reload before resubmitting a stale edit.

## Committed events and notifications

`onEvent(event)` receives `{ id, type, recordType, recordId, threadId, version }` from a durable outbox after commit. `type` is `visible`, `removed` or `anonymized`. No body, reporter identity, private target or transport credentials enter this hook payload. Subscribe the host search/cache/rewards adapter here; do not separately approve the same content through another moderation engine.

`notify({ idempotencyKey, actorKey, event })` receives only committed visible changes for active subscriptions. Built-in accounts are reloaded before delivery. Custom identity hosts **must** configure `notificationActor(key, { strapi })` to load current identity/grants; otherwise custom-identity notifications are safely suppressed. Read/target visibility and parent removal are checked again immediately before dispatch. Notifications are suppressed after unsubscribe, account revocation or target removal. The host decides how to map the private actor key to an email or other transport.

Delivery rows have unique keys, atomic claim/lease, bounded fan-out and durable cursors. A successful hook is recorded before continuing fan-out. Transport failures retry with the same `idempotencyKey`; consumers **must deduplicate this key**, and deduplicate `event.id` for `onEvent`, because a process can crash after external delivery but before its receipt commits. No exactly-once external delivery is claimed. A 5-minute expired lease can be reclaimed.

Successful writes drain one bounded outbox batch after commit; bootstrap also drains one batch. Enable Strapi `server.cron.enabled` for minute-by-minute retries/backlogs, or call `strapi.plugin('discussions').service('discussion').flushNotifications()` from a durable host job. Configuration `notificationBatchSize` defaults to 100 (max 1000).

## Portable demo and verification

The tarball contains SDK CommonJS/ESM server/admin exports, public contracts, examples, README and licence. No `@repo/*`, Better Auth, frontend framework or local host import is bundled. `tests/` and source internals do not ship in the tarball. Build and pack before linking it into another Strapi host.

The test suite covers authenticated authority, target allowlisting/revocation, private projection, moderated immutable edits, competing/stale reviews, report text/version conflicts, reply nesting/removal, rate limits and notification retries. The in-memory harness checks service behaviour. A separate packed-host acceptance runner boots two independent Strapi/PostgreSQL hosts, exercising built-in and custom identities through HTTP and competing approvals against real row locks.

```sh
# Provide a private PostgreSQL connection JSON with host, port, user, password, database.
# Use a disposable cluster and an account allowed to create temporary databases.
DISCUSSIONS_ACCEPTANCE_MODULES=/path/to/strapi-host/node_modules \
DISCUSSIONS_ACCEPTANCE_CONNECTION_FILE=/private/path/connection.json \
DISCUSSIONS_ACCEPTANCE_TARBALL=/path/to/strapi-plugin-discussions-0.1.0.tgz \
DISCUSSIONS_ACCEPTANCE_ADMIN_BUILD=1 \
pnpm test:acceptance
```

The runner requires POSIX tar at `/usr/bin/tar`, creates uniquely named test databases, and drops only those databases after each run. It reuses installed public Strapi/React/PostgreSQL dependencies for offline testing; the plugin itself is extracted from the tarball, with no source-workspace packages available to it. Transport hooks are disabled during acceptance, so no external mail is sent. `DISCUSSIONS_ACCEPTANCE_ADMIN_BUILD=1` also builds the independent host's Strapi admin panel. This is compilation and HTTP/database acceptance; an interactive browser review and other-database support are separate release checks.

Local validation on 16 October 2026: 33 behavioural/security tests, strict TypeScript, SDK build/verify, two independent packed hosts (Strapi 5.57.0 and PostgreSQL 16), real competing approval conflicts, physical unique/lookup indexes and a standalone admin build passed. Repeat acceptance on each supported Strapi upgrade before publishing.

## Lifecycle and maintenance

Disabling the plugin preserves its tables. Re-enabling it restores discussion data. Do not drop tables during uninstall; export/back up subjects, content, immutable revisions and decisions first, then make deletion explicit. Private actor keys, reports and review notes require restricted access in exports. The trusted server-only `strapi.plugin("discussions").service("discussion").eraseActor(actorKey)` lifecycle seam removes actor subscriptions/reports, private pending/rejected proposals and queued recipient deliveries; clears unpublished owned text/targets; anonymises surviving visible content and approved revision/reviewer/audit attribution; and clears private reviewer notes. Approved public bodies remain. Removed/unpublished records retain an empty structural placeholder so other members' approved records and audit links are not deleted accidentally. It returns aggregate counts, never the actor key. There is no public HTTP erasure route.

Revoke the account's sessions/grants in the host before calling this service. Erasure and every community mutation use consistent actor-first/thread-second locks. A private hashed actor tombstone prevents requests that started before revocation from recreating attribution after erasure; raw identity keys are not retained in that tombstone. Repeated erasure is idempotent. All effects roll back together on failure. Surviving public content emits committed `anonymized` cache events, which never trigger subscriber mail. Host privacy deletion remains responsible for any personal information the author deliberately included in already-published body text and for transport delivery already completed or in flight when erasure started. Changing identity key namespaces requires an explicit operator migration.

Version 0.1 introduces a fresh schema and has no predecessor migration. Future releases must include schema/identity upgrade notes and integration tests; keep the supported Strapi peer range aligned with tested versions. Strapi transactions are version-sensitive and must be revalidated on upgrades. No npm publication or marketplace submission is performed by building this package. Before publishing, verify the supplied public repository and maintainer metadata, confirm a private security-reporting channel and retain independent-host acceptance evidence. Report vulnerabilities privately through the published maintainer security channel once established.

## Marketplace release checklist

- Confirm package-name availability and choose the final npm name/scope with its account owner. The development name is not a registry reservation.
- Confirm publisher/maintainer access, npm account security and the public repository owner before publication.
- Verify the supplied public repository/homepage/issue URLs and Libraries Global maintainer metadata, and confirm a private security-reporting channel before release.
- Re-run tests, strict typing, SDK verify, packed PostgreSQL host acceptance and an interactive admin review against each supported Strapi version; verify the tarball contains no host imports or operational data.
- Tag a version with a changelog, supported-version matrix, schema/identity migration notes and backup/rollback instructions.
- Publish npm only through the authorised owner, then submit the public MIT package to the Strapi marketplace. npm publication and marketplace acceptance are separate external steps.

Maintenance policy: target Strapi's stable v5 line and PostgreSQL; add another runtime/database only after its acceptance matrix passes. Revalidate transaction, authorization, privacy erasure and outbox behavior on upgrades. Prioritise security/data-loss fixes, publish migration notes for every schema or identity change, and preserve records during disable/uninstall. Track bugs publicly, receive vulnerabilities privately and do not promise an unsupported support SLA. The npm account owner must confirm release ownership and the private security-reporting channel before public release.
