# Event Feeds: self-serve credentials for claimed libraries

**Date:** 2026-10-05
**Status:** Approved design (2026-10-05)
**Related:** ADR-0004 (design for three million libraries), ADR-0005 (moderation runs in the frontend), CONTEXT.md (Event, Source Provider, Library Claim, Capability, Submission, Review Event), `docs/events-system-spec.md` (worker architecture), `2026-09-26-access-contribution-pro-implementation-design.md` §3 (access axes), `2026-09-29-community-moderation-and-audit-design.md` (queues, Review Events, notifications).

## 1. Summary

A librarian who has claimed a library can connect that library's events platform (Eventbrite, an iCal feed, TicketSource, WeGotTickets, Spydus, Solus or Aspen) from `/contribute/events`, see whether the connection works, and manage it afterwards. Every credential value we accept is reviewed by a Moderator before the sync worker uses it. The values are encrypted in the database. Only Strapi admin users holding a dedicated permission can ever read them back.

A self-serve path exists today, but it doesn't work end to end. Section 2 lists what's there and what this design replaces.

| Workstream                | Outcome                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A. Providers and registry | One provider registry for every form, route and schema; providers in a shared package; all seven implemented providers registered |
| B. Credential model       | Status, pending replacement slot, masked hints, ownership, private fields, an append-only audit log, admin reveal                 |
| C. Feed API               | Strapi feed endpoints (connect, test, replace, pause, resume, disconnect, withdraw) and the Next proxies in front of them         |
| D. Moderation             | `event_feed` Submission type in the `index` queue, review panels on the site and in admin, apply and reject                       |
| E. Librarian UI           | `/contribute/events` becomes a feed dashboard with connect and replace forms                                                      |
| F. Worker                 | Status-driven loading, per-feed sync, failure tracking and auto-pause                                                             |
| G. Eventbrite OAuth       | "Connect with Eventbrite" when app keys are configured                                                                            |
| H. Docs                   | CLAUDE.md, CONTEXT.md, events-system-spec and env examples                                                                        |

Decisions taken with the owner on 2026-10-05:

1. **Every value is reviewed.** A new connection and a replacement value both go to review. A Moderator with an `index` (or `all`) scope, the editorial board, or the owner in Strapi admin decides. The review shows whether the connection test passed.
2. **Only Strapi admin can read a value.** Admin users whose role has the new **Reveal event credentials** permission can reveal a value, and every reveal is logged. Nobody else ever sees a value: not site Moderators, not the board, not the librarian who entered it. Values never appear in a Submission, an API response, a log line, Sentry or an email.
3. **Feeds belong to the Library, not the person.** Anyone holding a current Library Claim on a library has the same access to its feeds: view, test, replace, pause, resume, disconnect. Staff turnover doesn't strand a feed. A feed that serves several libraries (`scope: group`) stays admin-only, and claimants see it read-only.
4. **Reducing actions are direct.** Pause, resume, disconnect and withdraw take effect at once, without review: they only stop syncing or remove a value. Each is logged, and disconnect and auto-pause email the library's other claimants.
5. **The secret never enters a Submission.** The value is stored encrypted on the credential row. The Submission carries a reference to that row, masked hints and the test result.
6. **Tests run inside Strapi.** The provider code moves to a shared package, so Strapi tests a value in-process. Testing no longer depends on Strapi reaching the worker over the network.
7. **No marketplace encryption plugin.** The encryptable-field plugins on the marketplace support Strapi v4 only, use unauthenticated AES-CBC and decrypt on every read. Values stay in `@repo/events-crypto` (AES-256-GCM, bound to the row), with the columns marked `private`.
8. **All seven implemented providers ship.** Aspen, Solus, Spydus, TicketSource and WeGotTickets have complete provider code but were never registered. Meetup and BiblioCommons have no provider code and leave every enum.
9. **No points** for event feeds. It's stewardship of a library the person represents, not a contribution to the index, and points would reward connecting feeds for their own sake.
10. **Moderators are emailed** when a feed submission arrives (`ALERT_TYPES`), because the page promises review within 48 hours.
11. **Disconnect deletes** the credential row (and so the value) and every Event it synced.
12. **Eventbrite OAuth ships** behind configuration: the button appears only when the app's keys are set.

## 2. What exists today

- `/contribute/events` (`EventFeedForm.tsx`) posts to `POST /api/contribute/event-feed`, which checks `isVerifiedLibrarian` and `auth-bridge/claim-status`, then calls `POST /api/events/credential-submit`. Strapi stores the credential with `isActive: false`, and the owner switches it on in the events plugin's admin.
- **Eventbrite can't sync.** The worker reads `organizationId` and `accessToken`; both the site form and the admin form send `apiKey` and `orgId`. The site form's TicketSource, WeGotTickets and Spydus fields are also wrong.
- **Only Eventbrite and iCal are registered** in `apps/sync-worker/src/providers/index.ts`. The provider enums disagree across the credential schema, the site form, the admin form, the worker's `ProviderKey` and Event `sourceProvider`. The admin form offers four providers the schema rejects.
- **Strapi trusts the caller.** `credential-submit` doesn't re-check the claim, and it doesn't store who submitted the credential.
- **No review trail, status or management.** There's no Review Event, Moderator queue, notification or audit. After submitting, the librarian sees nothing and can't change anything.
- **The worker test returns raw provider error text**, and `syncLibraryFeedFlags` loads up to 5,000 active credentials on every write (an ADR-0004 breach).

Everything in this list is replaced. `POST /api/contribute/event-feed`, `POST /api/events/credential-submit` and the worker's `POST /test-credential` are deleted (pre-launch: no redirects).

## 3. Terms

Add to CONTEXT.md:

- **Event Feed:** a Library's connection to one Source Provider. It is one Event Credential and the Libraries it feeds. A claimant or staff connects it; it is active, paused or waiting for review. _Avoid:_ integration.
- **Event Credential:** the stored, encrypted values (tokens, keys, feed URLs) a Source Provider needs, kept on the Event Feed's row. Write-only for everyone except Strapi admin users with the Reveal permission.

The existing CONTEXT entry for Source Provider says to avoid "feed" as a synonym for a Source Provider. That rule stands: an Event Feed is the connection, not the provider.

## 4. Security model

| Who                                             | Sees                                                                                    | Can do                                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Claimant of the library                         | Status, provider, masked hints, last sync, error in plain words, review state           | Connect, test, replace (reviewed), pause, resume, disconnect, withdraw |
| Site Moderator (`index` scope), board           | Provider, library, masked hints (current → new), test results, submitter's claim status | Approve, reject, ask for changes, re-run the test                      |
| Strapi admin, `events.read`                     | Everything a Moderator sees, plus source, who connected it, error detail                | —                                                                      |
| Strapi admin, `events.manage-credentials`       | As above                                                                                | Create, edit, pause, delete, test                                      |
| Strapi admin, `events.reveal-credentials` (new) | The values, on request, one slot at a time                                              | Reveal (logged)                                                        |
| Sync worker                                     | Decrypted values of active feeds                                                        | Sync                                                                   |

Rules:

- **Encryption.** `@repo/events-crypto` stays as it is: AES-256-GCM, a random 12-byte IV, and the row's documentId as additional authenticated data. The pending replacement slot is bound to `${documentId}:pending`, so a value can't be moved between rows or slots. `EVENTS_CREDENTIAL_KEY` and `EVENTS_CREDENTIAL_KEY_PREV` are held only by Strapi and the worker. The Next app never holds the key.
- **Key rotation.** A new script, `pnpm --filter @repo/strapi events:rekey`, re-encrypts every current and pending value under `EVENTS_CREDENTIAL_KEY`, reading with the `_PREV` fallback, in batches of 200 rows by id.
- **Private fields.** `credentialsEncrypted`, `pendingCredentialsEncrypted` and `connectedBy` are `"private": true`, so Strapi's sanitiser strips them from every content API response. The content type stays hidden from the Content Manager and the Content-Type Builder. Admin controllers select explicit fields and never spread a row into a response.
- **Out of every other channel.** Values never go into a Submission's `fields` or `draftData`, a Review Event, an email, a log line or an error message. Strapi's Sentry scrub already deletes `request.data`. The Next server and edge Sentry configs get the same `beforeSend` scrub (delete `request.data`, `request.cookies`, and every header except `user-agent`). Replay already masks inputs.
- **Write-only in the browser.** Secret inputs use `type="password"` with a show toggle, `autoComplete="new-password"`, `spellCheck={false}` and `data-sentry-mask`. Nothing is saved as a draft, in `localStorage` or in the URL. After a successful submit the form state is cleared.
- **Masked hints.** At encryption time Strapi derives a hint per field from the registry's `display` rule (§5) and stores it in `hints`. Rules: `secret` gives `••••` plus the last 4 characters (just `••••` when the value is shorter than 12); `url-secret` gives `scheme://host/…`; `plain` shows the value (organisation id, endpoint). Hints are what claimants and Moderators see.
- **Coded errors.** A test or sync failure surfaces outside Strapi admin only as a code: `ok`, `auth_failed`, `not_found`, `unreachable`, `rate_limited`, `unrecognised_format`, `provider_error` or `decrypt_failed`. The redacted detail (`redactUrlsInText`) goes only to `lastErrorMessage`, which only Strapi admin reads.
- **Authority.** Next routes pre-check `requireCapability(user, "events.feed")` and that the library is in the session's `claimedLibraryIds`. Strapi re-reads the caller's claims on every feed request (`claimAffiliationFilter`, at most `SESSION_PROFILE_MAX_CLAIMS`) and is the real gate.
- **Binding.** The generic `POST /content-moderation/submissions` refuses `event_feed` (400, `use_event_feed_endpoint`); only the events plugin creates these Submissions, through the submission service. On a decision, the apply step requires `credential.pendingSubmissionDocumentId === submission.documentId`. A Submission forged any other way can't touch a credential.
- **Limits.**
  - Next, per user: feed writes 10 an hour, tests 20 an hour.
  - Strapi: at most 3 open `event_feed` Submissions per user, 5 feeds per library, one pending replacement per feed, and one test per feed every 30 seconds.
  - Moderator re-tests go through the moderation proxy's write limiter.
- **SSRF.** Tests now fetch from Strapi as well as the worker. Both use the package's `safeFetch`, which blocks private, loopback, link-local, CGNAT and metadata ranges, pins the DNS answer, re-checks every redirect, and caps time (15 s) and size (5 MB).

## 5. Providers and registry (Workstream A)

### 5.1 Registry

`packages/shared-data/src/event-providers.ts` exports `EVENT_PROVIDERS`, the single source of truth. Each entry has:

```ts
type EventProviderField = {
  key: string // the exact key the provider code reads
  label: string
  hint?: string
  required: boolean
  kind: "text" | "url" | "id"
  secret: boolean
  display: "plain" | "secret" | "url-secret"
  pattern?: string // RegExp source, checked on both sides
  maxLength: number // ≤ 2,048
}
type EventProviderDef = {
  key: EventProviderKey
  label: string
  description: string
  fields: EventProviderField[]
  oauth?: "eventbrite"
}
```

| Provider     | Fields (secret in bold)                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| eventbrite   | organizationId (id), **accessToken**                                                                                   |
| ical         | **feedUrl** (url-secret: private calendar addresses carry a token), username, **password** (both optional, HTTP Basic) |
| ticketsource | **apiKey**                                                                                                             |
| wegottickets | **feedUrl** (url-secret)                                                                                               |
| spydus       | endpoint (url), **customerKey**, username, **password**, institutionID, locationCode                                   |
| solus        | endpoint (url), **secretKey**                                                                                          |
| aspen        | endpoint (url), clientId, **clientSecret**                                                                             |

`validateFeedValues(provider, values)` (same module) is called by the Next route and by Strapi. It rejects unknown keys and keys outside the registry, requires the required fields, and checks patterns and lengths. URLs must be `http:` or `https:` and carry no userinfo. Values are trimmed, and empty optional fields are dropped.

The registry decides the credential schema's `provider` enum (the seven keys). A Strapi test asserts that the enum equals `Object.keys(EVENT_PROVIDERS)`, and a worker test asserts that every registry entry has a registered provider whose code reads exactly those keys. Meetup, BiblioCommons, `custom_ical`, `google_events`, `facebook_events` and `librarycloud` leave every form and enum. Event `sourceProvider` keeps its values, since old Event rows are disposable test data.

### 5.2 `@repo/event-providers`

`apps/sync-worker/src/providers/*`, `lib/safe-fetch.ts`, `lib/redact-url.ts` and `lib/date.ts` move to `packages/event-providers`. The package builds to `dist/`, like `@repo/shared-data`, and has its own tests (the worker's provider and safe-fetch tests move with it). Library matching (`match-libraries.ts`, `levenshtein.ts`) stays in the worker.

- `EventProvider.test` returns `{ ok: true } | { ok: false; code: FeedTestCode; detail: string }`. A shared `classifyFailure(statusOrError)` maps HTTP 401/403 to `auth_failed`, 404 to `not_found`, 429 to `rate_limited`, network errors, DNS failures, timeouts and blocked addresses to `unreachable`, and parse failures to `unrecognised_format`; anything else is `provider_error`.
- `testFeed(provider, values)` is the one entry point Strapi calls.
- The worker's registry registers all seven providers.

## 6. Data model (Workstream B)

### 6.1 `plugin::events.event-credential` (changed)

| Field                                   | Type                                                  | Notes                                                                                  |
| --------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `provider`                              | enum, the seven registry keys                         | changed                                                                                |
| `status`                                | enum `draft`, `pending`, `active`, `paused`; required | replaces `isActive`. `draft` only for an OAuth connection waiting for its organisation |
| `pausedReason`                          | enum `library`, `admin`, `sync_failures`              | set with `paused`                                                                      |
| `source`                                | enum `admin`, `library`; required                     | who connected it                                                                       |
| `connectedBy`                           | string, **private**                                   | `ba:<Better Auth id>` or `admin:<id>`; cleared on account erasure                      |
| `credentialsEncrypted`                  | text, required, **private**                           | the current value; for `pending` rows, the value under review                          |
| `hints`                                 | json                                                  | masked hints of the current value                                                      |
| `pendingCredentialsEncrypted`           | text, **private**                                     | a replacement under review (AAD `${documentId}:pending`)                               |
| `pendingHints`                          | json                                                  |                                                                                        |
| `pendingSubmissionDocumentId`           | string                                                | the open `event_feed` Submission, connect or replace                                   |
| `submissionDocumentId`                  | string                                                | the Submission that approved the current value                                         |
| `lastTestedAt` / `lastTestResult`       | datetime / enum (test codes)                          | current value                                                                          |
| `pendingTestedAt` / `pendingTestResult` | datetime / enum                                       | pending value                                                                          |
| `consecutiveFailures`                   | integer, default 0                                    | worker writes                                                                          |
| `lastErrorCode`                         | enum (test codes)                                     | worker writes; `lastErrorMessage` stays, admin only                                    |
| `autoPauseNotifiedAt`                   | datetime                                              | Strapi cron writes                                                                     |

The worker loads `status = 'active'` only. `hasActiveFeed` counts `active` feeds. `syncLibraryFeedFlags` stops loading every credential: it asks which of the given library ids have an active credential linked (one filtered query, ids in chunks of 500) and updates only those libraries.

A pending connection is a row with `status: pending`, created at submit time. A rejected or withdrawn connection deletes its row, so the value goes with it. A pending replacement sits in the `pending*` slot while the current value keeps syncing.

Indexes, through the plugin's `ensure-event-indexes.ts`: `ev_event_credentials (status)` and `ev_credential_events (credential_document_id, created_at)`.

### 6.2 `plugin::events.credential-event` (new, append-only)

The collection is `ev_credential_events`, hidden from the Content Manager, with `routes: []`. Fields:

- `credentialDocumentId`, `provider`, and `libraryDocumentIds` (json)
- `action`: `connect_submitted`, `replace_submitted`, `approved`, `rejected`, `withdrawn`, `tested`, `paused`, `resumed`, `auto_paused`, `disconnected`, `revealed`, `admin_created`, `admin_updated` or `admin_deleted`
- `actor`: `ba:<id>`, `admin:<id>` or `system`
- `submissionDocumentId`, `resultCode`, and `note` (≤ 500 characters, never a value)

It is written only through `recordCredentialEvent()` in the events plugin, inside the caller's transaction where there is one. Account erasure rewrites the actor to `ba:erased`.

### 6.3 `plugin::events.sync-command` (changed)

Add an optional `credentialDocumentId`. When it's set, the worker syncs only that feed.

### 6.4 Admin permission

Register `plugin::events.reveal-credentials` ("Reveal event credentials") next to `read`, `manage-credentials` and `review`. It isn't granted to any role by default. `docs/strapi-role-permissions.md` gains a line for it.

## 7. Flows

### 7.1 Connect

1. On `/contribute/events/connect`, the librarian picks one of their claimed libraries, a provider and its fields.
2. **Test connection** calls `POST /api/contribute/event-feeds/test`, which goes to Strapi `POST /api/events/feeds/test`. Strapi tests the value in memory and stores nothing. The result is shown inline in plain words.
3. **Send for review** calls `POST /api/contribute/event-feeds`, which goes to Strapi `POST /api/events/feeds`. Strapi:
   1. checks the claim and the limits, and validates against the registry;
   2. runs the test again, outside any transaction (it can take up to 15 seconds). `auth_failed`, `not_found` and `unrecognised_format` refuse the request (422 with the code): the librarian has to fix those. `ok`, `unreachable`, `rate_limited` and `provider_error` continue, and the result is recorded;
   3. then, in one transaction, creates the credential: `status: pending`, `source: library`, `connectedBy`, `scope: library`, the one library, the encrypted value and hints, and the test result;
   4. in the same transaction, creates the Submission through the submission service: `submissionType: event_feed`, `targetEntityType: library`, `targetDocumentId` set to the library, and `fields: { kind: "connect", credentialDocumentId, provider, hints, test: { result, testedAt } }`. It is finalised straight to `pending`, which writes its Review Event;
   5. sets `pendingSubmissionDocumentId` and records `connect_submitted`, then commits.
4. Moderators are emailed (decision 10). The librarian lands on the dashboard and sees "Waiting for review".

### 7.2 Replace

`PUT /api/events/feeds/:documentId/values` follows the same checks and test. It refuses with 409 when the feed already has a pending replacement or is `pending` itself; for a pending connection, withdraw it and connect again instead. Strapi writes the `pending*` slot and creates a Submission with `kind: "replace"` and `previousHints`, then records `replace_submitted`. The current value keeps syncing until the decision.

### 7.3 Review

- **On the site:** an `event_feed` Submission appears in the `index` queue. Its review page shows an **Event feed** panel with:
  - the library (linked), provider and kind;
  - the values as hints, current → new for a replacement;
  - the test result at submit time and the latest result, shown with colour, icon and text;
  - **Test again**: `POST /api/moderation/submissions/:documentId/feed-test` runs the test on the value under review and stores `pendingTestResult` (or `lastTestResult` for a connection, whose value is the current slot of a `pending` row);
  - whether the submitter still holds a claim on the library.
- **In Strapi admin:** the owner's queue gets the same panel. An admin with `reveal-credentials` also gets **Reveal value**: `POST /events/admin/credentials/:documentId/reveal` with `{ slot: "current" | "pending" }`. The response is `Cache-Control: no-store` and records `revealed`. The values appear in a modal and are dropped from state when it closes.
- "Approve and publish" doesn't apply to feeds. The approve button reads **Approve and activate**.

### 7.4 Decisions

All of these run inside the existing `updateStatus` transaction.

- **Approve a connection.** Requires the binding and that the submitter still holds a claim. A lost claim gives 409 `claim_lost`, with the copy "The submitter no longer holds a claim on this library. Reject it instead." Then:
  - `status: active`, `submissionDocumentId`, and `pendingSubmissionDocumentId` cleared;
  - `resultDocumentId` is set to the credential;
  - `hasActiveFeed` is recomputed, a sync command is queued for this feed, and `approved` is recorded.
- **Approve a replacement.** The same checks, then:
  - decrypt the pending slot and encrypt it again as the current value (AAD `documentId`);
  - move the pending hints and test result across, and clear the `pending*` fields;
  - reset `consecutiveFailures`; if `pausedReason` is `sync_failures`, set `status: active`;
  - queue a sync and record `approved`.
- **Reject.** A connection deletes the row. A replacement clears the `pending*` fields. Records `rejected`.
- **Needs changes.** Nothing changes on the credential. The librarian sees the note on the dashboard. Until resubmission ships (C-M1), they withdraw and send a new value.
- **Withdraw**, by any claimant. A pending connection is deleted; a pending replacement is cleared. The open Submission moves to `rejected` with reviewer `system` and the note "Withdrawn by the library". Records `withdrawn`.

### 7.5 Manage

These are direct, and every one re-checks the claim. Group feeds are refused (403 `group_feed`).

- **Test:** tests the current value, updates `lastTestResult` and records `tested`.
- **Pause:** `active` → `paused` (`pausedReason: library`); recompute the flag; record `paused`.
- **Resume:** `paused` → `active`, unless the feed is waiting for review. Recompute the flag, queue a sync, record `resumed`.
- **Disconnect:** in one transaction, reject the open Submission as for a withdrawal, delete every Event with this `credentialId` (one `deleteMany`: Events are worker-written derived data), delete the row, recompute the flag and record `disconnected`. Afterwards, email the library's other claimants.

### 7.6 Sync failures and auto-pause

The worker records the outcome of every feed sync: `lastSyncAt`, `lastSyncStatus`, `lastErrorCode` and the redacted `lastErrorMessage`, and it increments or resets `consecutiveFailures`. A decrypt failure records `decrypt_failed` instead of only logging.

After `EVENTS_AUTOPAUSE_AFTER` consecutive failures (default 4, about a day at the 6-hour cron), the worker sets `status: paused` and `pausedReason: sync_failures`.

A Strapi cron every 15 minutes finds auto-paused feeds where `autoPauseNotifiedAt` is null. For each it recomputes the flag, records `auto_paused`, emails every claimant ("Your library's Eventbrite feed stopped working: the sign-in was refused. Replace its details to restart it.") and sets `autoPauseNotifiedAt`. The same cron deletes `draft` rows (OAuth) older than an hour.

### 7.7 Claims and account erasure

Feeds survive their connector losing a claim: they belong to the library. Every request re-reads claims, so a person who loses their claim loses access at once.

`erase-account` (in its transaction):

- deletes `pending` and `draft` rows with `connectedBy = ba:<id>`;
- clears the `pending*` fields where the open replacement Submission belongs to the user;
- sets `connectedBy` to null on the rest;
- rewrites `ba:<id>` actors in `credential-event` to `ba:erased`.

## 8. API (Workstream C)

### 8.1 Strapi, events plugin content API

Every route is bridge-secret gated, identifies the caller by `X-Ba-User-Id`, re-checks claims, and answers 404 for a feed outside the caller's libraries.

| Method and path                                   | Does                                                                                                                                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /events/feeds`                               | The caller's claimed libraries with their feeds. Group feeds are marked read-only. Per feed: status, provider, hints, review state and note, last sync, error code, upcoming Event count |
| `GET /events/feeds/providers`                     | The registry, with `oauth` availability                                                                                                                                                  |
| `POST /events/feeds/test`                         | Test values without storing them                                                                                                                                                         |
| `POST /events/feeds`                              | Connect (§7.1)                                                                                                                                                                           |
| `PUT /events/feeds/:documentId/values`            | Replace (§7.2)                                                                                                                                                                           |
| `POST /events/feeds/:documentId/test`             | Test the current value                                                                                                                                                                   |
| `POST /events/feeds/:documentId/pause` / `resume` |                                                                                                                                                                                          |
| `DELETE /events/feeds/:documentId/pending`        | Withdraw a pending replacement                                                                                                                                                           |
| `DELETE /events/feeds/:documentId`                | Disconnect, or withdraw a pending connection                                                                                                                                             |
| `POST /events/feeds/oauth/eventbrite`             | Exchange an OAuth code (§10)                                                                                                                                                             |
| `POST /events/feeds/:documentId/organization`     | Finish an OAuth draft (§10)                                                                                                                                                              |

`POST /credential-submit` is deleted.

### 8.2 Strapi, events plugin admin API

- `POST /admin/credentials/:documentId/reveal` (new, `reveal-credentials`).
- `POST /admin/credentials/:documentId/test` runs in-process instead of calling the worker.
- Create, update and delete validate with the registry, set `source: admin` and `connectedBy: admin:<id>`, and record `admin_*` events.
- `listCredentials` returns explicit fields.

### 8.3 Strapi, content-moderation

- `event_feed` joins the submission schema enum.
- The generic create, draft and finalize controllers refuse it.
- The `updateStatus` apply and reject branches follow §7.4.
- `reviewFields` allowlists `kind`, `credentialDocumentId`, `provider`, `hints`, `previousHints` and `test`.
- `review()` returns the live feed: status, current and pending hints, both test results, and the submitter's claim status.
- New moderation route `POST /moderation/submissions/:documentId/feed-test`, behind the same scope checks.
- Labels and summaries are added in `submission-summary.ts`, `target-labels.ts` (resolves to the library name), `email-templates.ts` (`TYPE_LABELS`) and `notifications.ts` (`ALERT_TYPES` and its `alertSummary` branch).

### 8.4 Next

`apps/ui/src/app/api/contribute/event-feeds/` proxies §8.1 one to one. It is built from one helper in `lib/event-feed-proxy.ts`, modelled on `moderation-proxy.ts`:

- `requireCapability("events.feed")` and a check that the library or feed is among the session's claims;
- the limiters from §4 and `readJsonCapped` at 16 KB;
- `validateFeedValues` as a pre-check;
- `bridgeUserHeaders` and `Cache-Control: no-store`;
- it never logs bodies and never echoes values.

The moderation proxy allowlists the `feed-test` route. `POST /api/contribute/event-feed` is deleted.

## 9. UI (Workstreams D and E)

- **`/contribute/events`, Event feeds.**
  - Gated on `events.feed`, not `isVerifiedLibrarian`. The non-claimant state keeps today's copy and its claim link.
  - One section per claimed library. A feed row shows: provider, a status badge (colour, icon and text: Active, Paused, Waiting for review, Needs changes, Stopped working), hints, "Last synced 3 hours ago · 12 upcoming events", and the error in plain words.
  - Each row has a Test button, plus Replace, Pause/Resume and Disconnect (with a confirm dialog naming the library and provider) behind a "More" menu.
  - A waiting replacement shows "New details waiting for review" with Withdraw.
  - Group feeds read "Managed by Libraries Global".
  - Each library has a **Connect a feed** button. The page takes `?library=<documentId>` to scroll to and highlight one library.
- **`/contribute/events/connect`.** Three steps: library (preselected when there's one, a select otherwise, never a search over every library), provider (registry cards; Eventbrite shows **Connect with Eventbrite** when OAuth is available, with the manual token route beneath), and details (registry fields, Test connection, Send for review). The aside explains review and encryption honestly: "Only Libraries Global staff can read these details. Moderators see only the masked hints and the test result."
- **`/contribute/events/[documentId]/replace`.** The same details step, with the current hints shown.
- **Library page.** `LibraryHelpPanel` links to `/contribute/events?library=<documentId>`.
- **Moderation.**
  - `EventFeedPanel` in `components/moderation/` goes into the `PANELS` map, with the title "The event feed".
  - `event_feed` joins `targetLinks` (library page and Index editor).
  - Labels, colours, `summaryOf` and `detailOf` are added in the UI `submissionMeta.ts` and its parity test, and the type gets a `KIND_META` entry for My submissions and the profile.
- **Strapi admin.**
  - `EventFeedPanel` in `SubmissionPanels.tsx` with Reveal; labels and summaries in the admin `submissionMeta.ts`.
  - The events plugin's `CredentialList` shows status, source, connected by, pending replacement and test results, with Reveal and Test.
  - `CredentialForm` builds its fields from the registry, with a status select instead of the Active toggle.

All copy is plain and sentence case. Status is never conveyed by colour alone.

## 10. Eventbrite OAuth (Workstream G)

The feature is available when Strapi has `EVENTBRITE_CLIENT_ID`, `EVENTBRITE_CLIENT_SECRET` and `EVENTBRITE_REDIRECT_URI` (`${APP_PUBLIC_URL}/api/contribute/event-feeds/eventbrite/callback`), and Next has `EVENTBRITE_CLIENT_ID`.

1. `GET /api/contribute/event-feeds/eventbrite/start?library=<documentId>` runs the same pre-checks as a connect. It sets a `__Host-` cookie holding a random nonce (httpOnly, Secure, SameSite=Lax, 10 minutes). It then redirects to `https://www.eventbrite.com/oauth/authorize?response_type=code&client_id=…&redirect_uri=…&state=…`. The `state` is an HMAC-SHA256-signed `{ nonce, userId, libraryDocumentId, exp }`, keyed with HKDF from `BETTER_AUTH_SECRET` (info `event-feed-oauth-state`).
2. `GET …/callback?code&state` verifies the signature, the expiry, the nonce against the cookie and the session user against `state.userId`, then clears the cookie. It posts `{ code, libraryDocumentId }` to Strapi `POST /events/feeds/oauth/eventbrite`.
3. Strapi checks the claim and exchanges the code at `https://www.eventbrite.com/oauth/token` (`grant_type=authorization_code`, client id, secret, code, redirect URI). It reads `GET /v3/users/me/organizations/` and creates a `draft` credential holding the encrypted `accessToken`. The organisations (id and name, not secret) go in `hints.organizations`.
4. With one organisation, Strapi completes at once (step 5). With several, Next redirects to the connect page's organisation step, which posts the choice to `POST /events/feeds/:documentId/organization`.
5. Completing sets `organizationId`, tests, and runs §7.1 from step 3.3 (`draft` → `pending`, with a Submission).

The token never reaches the browser or Next. The review is the same as for a pasted token. Whether Eventbrite tokens expire and how a library revokes one is checked against Eventbrite's documentation while building; the plan records the answer.

## 11. Worker (Workstream F)

- Import providers from `@repo/event-providers`; register all seven.
- `loadCredentials({ credentialDocumentId? })` reads `status = 'active'`.
- The command poller passes `credentialDocumentId` through to `runSync`.
- `updateCredentialStatus` writes `lastErrorCode` and `consecutiveFailures`, and auto-pauses as in §7.6.
- Remove `POST /test-credential`. The HTTP server serves `/health` only.

## 12. Out of scope, and known gaps

- **Typing in individual Events.** CONTEXT.md says Events are never manually curated.
- **The worker has no production home.** There's no deploy target, and it needs direct Postgres access. With tests in Strapi, the feed flow no longer needs Strapi to reach the worker, but syncing needs the worker running somewhere. This is a launch blocker for Events as a whole and is tracked separately.
- **Worker writes never reach the Meilisearch `event` index.** Only `seed:meilisearch` rebuilds it, so disconnecting leaves stale Events in search until the next reseed, the same as today's expiry purge. Tracked separately.
- Unrelated worker and admin oddities (`setNextSync` is never called, blank Pending Review columns, `cronExpression`) are left alone.

## 13. Testing

- **`packages/shared-data`:** registry validation (unknown keys, required fields, patterns, URL rules) and hint derivation.
- **`packages/event-providers`:** the moved provider and safe-fetch tests, `classifyFailure`, and each provider's `test` mapping.
- **`packages/access`:** `canSubmit("event_feed")` with and without the claim; the `index` queue list in `moderation.test.ts` grows to six.
- **Strapi:**
  - Feeds: connect, replace, test, pause, resume, disconnect and withdraw, each with an owner and a non-claimant, and group feeds refused.
  - The enum equals the registry.
  - Private fields absent from every response.
  - The generic submission route refuses `event_feed`.
  - Apply and reject for both kinds; the binding mismatch is refused; a lost claim gives 409; a failure halfway rolls back.
  - The moderation detail never carries a value.
  - Reveal needs the permission and records an event.
  - Cron auto-pause handling, erasure, and the flag recompute touching only the given libraries.
- **Worker:** status filter, per-feed sync, failure counting and auto-pause.
- **UI:** proxy pre-checks and limits (Vitest); the `submissionMeta` parity test.
- **Playwright `access` project:** the `librarian` fixture connects an iCal feed (a fixture `.ics` served by the test server), `moderator-global` approves it, and the feed shows Active; a reader gets the claim prompt; a librarian can't reach another library's feed.

## 14. Order

A → B → C → D → E → F → G → H. A and B are foundations. D needs C's credential service. E needs C and D. F can follow B. G comes last. This work starts only after the other session's content-moderation changes are committed: D edits the same plugin.
