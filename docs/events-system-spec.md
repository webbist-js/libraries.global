# Events System — Specification

> Status: **DRAFT — architecture confirmed, ready for Phase 1**
> Last updated: 2026-05-03

---

## Background & goals

Libraries host talks, exhibitions, storytimes, book clubs, archive open days and more. This system aggregates those events from disparate third-party providers into a single canonical store, making them discoverable across the libraries.global atlas — on individual library pages, location browse pages (region / country / continent), and a new global events dashboard (`/programme`).

**Core constraints:**

- Events are **ephemeral** — we do not want a permanent archive. Expired events are purged nightly.
- We **do** want an audit trail of each sync run for debugging and provider health monitoring.
- Credentials for third-party providers must be stored **encrypted at rest**.
- The system must support credentials scoped to a single library _or_ to a named group of libraries (e.g. one Eventbrite account covering all branches of a city network).
- No AI dependencies in the critical path. Venue-to-library matching is deterministic, based on explicit credential-to-library mappings.
- **Strapi's API must never be impacted by sync load.** All heavy scraping, normalisation, and bulk writing happens in a separate process.
- The system must be designed to handle **thousands to tens of thousands of credentials** and **hundreds of millions of events** across its lifetime.

---

## What we learned from the reference plugin

The old `libraryon-events` v4 plugin provided the proof-of-concept. Key patterns worth keeping, and things we are dropping:

| Pattern                                           | Decision                                                |
| ------------------------------------------------- | ------------------------------------------------------- |
| Provider abstraction (fetch / normalize / upsert) | Keep                                                    |
| Credential-per-library / credential-per-group     | Keep — redesigned scope model                           |
| Sequential import pipeline with named steps       | Keep — now runs outside Strapi                          |
| Per-provider `eventType` mapping tables           | Keep — ported and corrected during TypeScript rewrite   |
| Comprehensive audit log per sync run              | Keep                                                    |
| Nightly expired-event purge via cron              | Keep — cron now in sync worker, not Strapi              |
| Redis-backed session manager                      | Drop — in-process state is sufficient                   |
| BullMQ / external queue                           | Drop — sequential worker loop with concurrency limiting |
| OpenAI venue matching & AI tag classification     | Drop — explicit FK mapping                              |
| `authority` entity concept                        | Drop — replaced by credential `group` label             |
| `plugin::encryptable-field` Strapi dependency     | Drop — AES-256-GCM in-service                           |
| Strapi v4 APIs                                    | Drop — rewrite in v5 Document Service + TypeScript      |
| Running import pipeline inside Strapi             | **Drop — caused API slowdowns and crashes at scale**    |

---

## Architecture

### The core problem

Running all of the sync work inside a Strapi plugin (as the v4 reference plugin did) directly impacts API response times:

- Node.js is single-threaded. Even async I/O-bound work competes with incoming API requests on the same event loop.
- Strapi's process handles both HTTP traffic and all plugin background tasks — there is no isolation.
- At small scale (dozens of credentials) this is tolerable. At the target scale — potentially **thousands to tens of thousands of credentials** fetched concurrently, with bulk upserts of large event sets — the API process degrades or crashes entirely.

### Solution: separate sync worker

The system is split into two components that share only the database and the credential encryption key.

```
┌──────────────────────────────────────────────────────────────────────┐
│  apps/sync-worker/  (standalone Node.js / TypeScript process)        │
│                                                                      │
│  Responsibilities:                                                   │
│  - Reads active credentials directly from the shared database        │
│  - Decrypts credentials (shared EVENTS_CREDENTIAL_KEY)               │
│  - Concurrently fetches events from all providers (HTTP/iCal/XML)    │
│  - Normalises raw events to the canonical schema                     │
│  - Bulk-upserts events directly to the database in chunks            │
│  - Purges expired events                                             │
│  - Writes import-run audit records with live progress updates        │
│  - Runs a tiny HTTP server (health + credential test-ping only)      │
│  - Scheduled by external cron / PM2 / systemd                       │
│                                                                      │
│  Never calls Strapi's HTTP API. Direct DB access only.               │
└──────────────────────────────────────────────────────────────────────┘
          ↕  shared DATABASE_URL (direct connection)
┌──────────────────────────────────────────────────────────────────────┐
│  apps/strapi/plugins/events/  (plugin::events)                       │
│                                                                      │
│  Responsibilities:                                                   │
│  - Owns all content type schemas and DB migrations                   │
│    (ev_event_credentials, ev_events, ev_import_runs,                 │
│     ev_sync_commands)                                                │
│  - Admin panel dashboard (credentials, run history, live sync        │
│    progress, pending review queue, worker health)                    │
│  - Content API: read-only event endpoints consumed by Next.js        │
│  - Contains zero import-pipeline or provider code                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
          ↓  read-only Strapi content API calls
┌──────────────────────────────────────────────────────────────────────┐
│  apps/ui/  (Next.js frontend)                                        │
│  - Library page Events tab                                           │
│  - Location pages Events section                                     │
│  - /programme global events dashboard                                │
└──────────────────────────────────────────────────────────────────────┘
```

### Why direct DB access and not the Strapi Admin API?

Routing all event writes through Strapi's HTTP API would:

- Still generate load on Strapi's process for every write batch
- Introduce HTTP round-trip latency for each upsert chunk
- Require auth token management and request serialisation overhead
- Completely defeat the purpose of the separation

The sync worker connects to the same PostgreSQL database that Strapi uses. It knows the table names from the plugin schema (`ev_events`, `ev_event_credentials`, etc.) and reads/writes them directly using **knex** — the same query builder Strapi uses internally. Schema ownership remains with Strapi (migrations run via Strapi's bootstrap), but the worker is an equal peer on the data.

### The worker's tiny HTTP server

The sync worker runs a minimal HTTP server on `WORKER_PORT` (default `3100`) serving exactly two endpoints:

```
GET  /health
     Returns worker liveness, last sync time, next scheduled sync,
     current sync status, and version.
     { ok: true, lastSync: "...", nextSync: "...", status: "idle"|"running", version: "..." }

POST /test-credential
     Body: { credentialId: number }
     Loads and decrypts the credential, runs the provider's test() function,
     returns { ok: boolean, error?: string }
     Used by the Strapi admin panel "Test" button without duplicating provider logic.
```

The Strapi admin API proxies the test-ping: `POST /api/events/admin/credentials/:id/test` → calls `WORKER_URL/test-credential`. On the same host this is a loopback call. On separate deployments it uses an internal network address.

### Strapi ↔ Worker communication channels

All communication goes through the shared database or the worker's health endpoint. There are no direct Strapi-to-Worker API calls except for the test-ping proxy.

| Direction      | Mechanism                                                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin → Worker | `POST /api/events/admin/sync` inserts a row into `ev_sync_commands`. Worker polls this table every 2 minutes.                                                                                                    |
| Worker → Admin | Worker writes live progress to the `ev_import_runs` row (`status`, `eventsFetched`, `eventsCreated`, etc.). Admin dashboard polls `GET /api/events/admin/runs/:runId` every 3 seconds while status is `running`. |
| Admin → Worker | Credential test-ping: Strapi proxies `POST WORKER_URL/test-credential`.                                                                                                                                          |
| Worker → Admin | Health check: Admin dashboard polls `GET WORKER_URL/health` every 30 seconds.                                                                                                                                    |
| Worker → DB    | Direct knex writes to `ev_events`, `ev_import_runs`, `ev_event_credentials` (status fields only).                                                                                                                |
| Admin → DB     | Strapi Document Service reads/writes credentials and reads events/runs via the plugin's services.                                                                                                                |

### Sync concurrency model

Naive sequential credential processing at 10,000 credentials × ~2 seconds per API call = ~5.5 hours per sync run. This is unacceptable.

The worker processes credentials concurrently using a bounded pool (default concurrency: `50`). This is configurable via `EVENTS_SYNC_CONCURRENCY`.

```
10,000 credentials ÷ 50 concurrent = 200 batches × ~2s avg = ~6–7 minutes per full sync
```

Memory is bounded by processing events per-credential in streaming fashion — raw events from one credential are normalised and upserted before the next batch is fetched. Peak heap usage is proportional to one batch of concurrent credentials, not total event count.

```
for each chunk of 50 credentials (in parallel):
  fetch → normalize → upsert → update credential status
```

The upsert step within each credential chunk uses SQL `INSERT ... ON CONFLICT DO UPDATE`, batched at 500 rows per statement to avoid excessive lock contention on `ev_events`.

### Deployment options

| Deployment context         | Worker scheduling                                                   |
| -------------------------- | ------------------------------------------------------------------- |
| Single VPS (PM2 / systemd) | PM2 cron mode or systemd timer; `apps/sync-worker/dist/index.js`    |
| Docker Compose             | Separate `sync-worker` service; `restart: unless-stopped`           |
| Railway / Render / fly.io  | Separate background service with cron or always-on process          |
| Serverless (Lambda, etc.)  | Not recommended — import runs are long-lived (minutes, not seconds) |

---

## Sync worker language choice

The workload is primarily **I/O-bound** (thousands of concurrent HTTP calls to provider APIs) with light CPU work (JSON/XML/iCal parsing, Levenshtein matching, SHA-1 hashing, SQL batch writes). Language choice matters, but not as dramatically as one might assume.

### Node.js / TypeScript

**Default choice for Phase 1.**

| Aspect            | Assessment                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Concurrency       | libuv handles thousands of concurrent HTTP connections well via the event loop. `p-limit` provides clean bounded concurrency for the credential pool. |
| CPU               | Single-threaded. Normalisation of 1M events takes ~2–5s in V8. Levenshtein matching at scale is fine. Not a bottleneck.                               |
| Memory            | V8 heap pressure is the main concern with large event payloads. Mitigated by the per-credential streaming pattern described above.                    |
| DB                | knex is the same library Strapi uses — zero friction, shared query patterns.                                                                          |
| Shared code       | Types, crypto helpers, and normalization logic are shared with the Strapi plugin. A `packages/events-shared/` package can hold these.                 |
| Ecosystem         | Excellent — `ical.js`, `node-fetch`/`undici`, `node-cron`, `knex`, `fast-levenshtein`.                                                                |
| Development speed | Fastest to build — same language as the rest of the monorepo.                                                                                         |

### Go

**Strong upgrade path if Node.js proves insufficient at scale.**

| Aspect            | Assessment                                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Concurrency       | Goroutines are cheaper than async Promise chains at very high concurrency. A semaphore-limited goroutine pool for credential fetching is cleaner and more efficient than Node.js at 10,000+ concurrent connections. |
| CPU               | True parallelism via GOMAXPROCS. Normalization, Levenshtein, and SHA hashing run on multiple OS threads simultaneously.                                                                                             |
| Memory            | ~4KB per goroutine vs significantly more per Node.js async context at high concurrency.                                                                                                                             |
| DB                | `pgx` is a highly optimised PostgreSQL driver; bulk copy mode (`pgx/v5/pgxpool`) can upsert faster than knex batch inserts.                                                                                         |
| Shared code       | Nothing shared with TypeScript. Credential shapes and event types would be maintained in two places.                                                                                                                |
| Ecosystem         | `ical-go`, `resty`, `robfig/cron`, `pgx`. Smaller but sufficient.                                                                                                                                                   |
| Binary            | Compiled to a single static binary — trivially deployable.                                                                                                                                                          |
| Development speed | Slower to build. No TypeScript type sharing. Likely 2–3× more time to reach feature parity with the Node.js version.                                                                                                |

### Rust

**Not recommended for this workload.**

Rust excels at CPU-intensive or memory-constrained tasks. This system's bottleneck is network I/O and database write throughput — both of which are equally fast in Go and Rust. The marginal CPU performance of Rust over Go is irrelevant when the event loop is waiting on TCP connections 95% of the time.

The development cost (borrow checker friction on complex async state machines, smaller async ecosystem) is not justified by the performance gain over Go for this use case.

### Decision

**Build in TypeScript/Node.js for Phase 1.** The concurrency model is adequate for the target scale, the ecosystem is mature, and shared types with the Strapi plugin are a genuine advantage for correctness.

**Design the worker with a clean interface boundary** — all provider logic, pipeline steps, and DB access are behind clearly-typed module boundaries — so that a Go rewrite of the worker (swapping only `apps/sync-worker/`) is a viable path if real-world performance data demands it.

---

## Data model

All tables are owned by the `plugin::events` Strapi plugin (schema files + migrations). The sync worker reads and writes them directly via knex. Table names are prefixed `ev_` to avoid collisions.

### `event-credential` → `ev_event_credentials`

One row per configured provider connection.

| Field                  | Type                 | Notes                                                                                         |
| ---------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| `provider`             | enum                 | `eventbrite`, `ticketsource`, `meetup`, `ical`, `wegottickets`, `spydus`, `bibliocommons`     |
| `label`                | string               | Human name, e.g. "Manchester City Libraries – Eventbrite"                                     |
| `scope`                | enum                 | `library` \| `group`                                                                          |
| `libraries`            | manyToMany → Library | Explicit library mapping — required for `scope=library`, used as scope hint for `scope=group` |
| `isActive`             | boolean              | Whether this credential is included in sync runs                                              |
| `lastVerifiedAt`       | datetime             | When the credential last passed a test-ping                                                   |
| `lastSyncAt`           | datetime             | Timestamp of the most recent sync that used this credential                                   |
| `lastSyncStatus`       | enum                 | `ok` \| `partial` \| `error` \| `null`                                                        |
| `lastErrorMessage`     | text \| null         | Last error string, cleared on success                                                         |
| `credentialsEncrypted` | text                 | AES-256-GCM blob — see Encryption section                                                     |

`credentialsEncrypted` decrypts to a provider-specific JSON object. Shapes by provider:

```ts
// eventbrite
{ organizationId: string; accessToken: string }

// ical / rss
{ feedUrl: string; username?: string; password?: string }

// ticketsource
{ apiKey: string; organisationId?: string }

// meetup
{ apiKey: string; groupUrlName: string }

// wegottickets
{ xmlFeedUrl: string }

// spydus
{ endpoint: string; username: string; password: string; branchCode?: string }

// bibliocommons
{ subdomain: string; apiKey: string }
```

---

### `event` → `ev_events`

The live events table. Short-lived: events are purged after expiry.

| Field              | Type                | Notes                                                                                                                               |
| ------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `externalId`       | string              | Provider's own ID for this event                                                                                                    |
| `sourceProvider`   | enum                | Same enum as credential                                                                                                             |
| `credentialId`     | integer             | FK to the event-credential row that produced this event                                                                             |
| `syncHash`         | string              | SHA-1 of `(externalId + provider + startTime + title)` — used for change detection                                                  |
| `library`          | manyToOne → Library | Resolved library entity                                                                                                             |
| `libraryEntityRef` | string              | Denormalized, indexed (e.g. `GB-BL-001`) — fast location-tree queries                                                               |
| `title`            | string              |                                                                                                                                     |
| `description`      | text                | Full description from provider                                                                                                      |
| `summary`          | text                | ≤ 280 chars, auto-truncated from description                                                                                        |
| `url`              | string              | Canonical event URL at the provider                                                                                                 |
| `imageUrl`         | string \| null      | Direct URL from provider — not hosted by us                                                                                         |
| `startTime`        | datetime            | UTC                                                                                                                                 |
| `endTime`          | datetime \| null    | UTC; null = unknown end                                                                                                             |
| `allDay`           | boolean             |                                                                                                                                     |
| `timezone`         | string              | IANA tz, e.g. `Europe/London`                                                                                                       |
| `eventType`        | enum                | `talk`, `exhibition`, `storytime`, `book_club`, `workshop`, `tour`, `screening`, `reading_group`, `performance`, `drop_in`, `other` |
| `audience`         | json                | `string[]` e.g. `["adults","children"]`                                                                                             |
| `tags`             | json                | `string[]` — raw tags from provider, not normalised                                                                                 |
| `isFree`           | boolean             |                                                                                                                                     |
| `priceMin`         | decimal \| null     | Local currency                                                                                                                      |
| `priceMax`         | decimal \| null     |                                                                                                                                     |
| `registrationUrl`  | string \| null      | Booking / ticketing link                                                                                                            |
| `capacity`         | integer \| null     |                                                                                                                                     |
| `status`           | enum                | `upcoming`, `ongoing`, `cancelled`, `postponed`                                                                                     |
| `pendingReview`    | boolean             | `true` if group-scoped credential matched venue with low confidence — surfaced for admin triage                                     |
| `importedAt`       | datetime            | When first inserted                                                                                                                 |
| `lastSeenAt`       | datetime            | Updated each sync if still present upstream                                                                                         |

**Indexes:** `(libraryEntityRef, startTime)`, unique `(sourceProvider, externalId)`, `startTime ASC` (supports purge), `pendingReview` partial index.

---

### `import-run` → `ev_import_runs`

Audit record for each sync execution. Updated in real time by the worker so the admin dashboard can show live progress. Retained for 90 days then pruned.

| Field                  | Type                            | Notes                                                        |
| ---------------------- | ------------------------------- | ------------------------------------------------------------ |
| `runId`                | string                          | UUID                                                         |
| `triggeredBy`          | enum                            | `cron`, `manual`                                             |
| `triggeredByUser`      | manyToOne → admin::user \| null | Set for manual runs                                          |
| `startedAt`            | datetime                        |                                                              |
| `completedAt`          | datetime \| null                |                                                              |
| `durationMs`           | integer \| null                 |                                                              |
| `status`               | enum                            | `running`, `success`, `partial`, `failed`                    |
| `credentialsTotal`     | integer                         | Total active credentials at run start                        |
| `credentialsAttempted` | integer                         | Updated live during sync                                     |
| `credentialsFailed`    | integer                         |                                                              |
| `eventsFetched`        | integer                         | Raw events returned by providers — updated live              |
| `eventsCreated`        | integer                         | Updated live                                                 |
| `eventsUpdated`        | integer                         | Updated live                                                 |
| `eventsUnchanged`      | integer                         |                                                              |
| `eventsExpiredPurged`  | integer                         | Events deleted this run                                      |
| `eventsPendingReview`  | integer                         | Events held for admin triage                                 |
| `errorCount`           | integer                         |                                                              |
| `providerBreakdown`    | json                            | `{ eventbrite: { fetched, created, updated, errors }, ... }` |
| `failedCredentials`    | json                            | `[{ credentialId, label, error }]`                           |
| `notes`                | text \| null                    | Human-readable outcome summary written at completion         |

---

### `sync-command` → `ev_sync_commands`

Lightweight control table for the admin-triggered manual sync. The worker polls this every 2 minutes.

| Field         | Type             | Notes                                      |
| ------------- | ---------------- | ------------------------------------------ |
| `requestedAt` | datetime         | When the admin triggered the sync          |
| `requestedBy` | integer          | admin::user id                             |
| `consumedAt`  | datetime \| null | Set by worker when it picks up the command |

The worker marks a command as consumed immediately on pickup. Only one sync runs at a time — a second command inserted while a sync is running is ignored until the current run completes.

---

## Import pipeline

All steps run inside the **sync worker**. Steps run per-credential-batch with bounded concurrency. A failure in an individual credential or event is non-fatal — logged, skipped, the sync continues.

### Step 1 — loadCredentials

Query all `ev_event_credentials` where `isActive = true`. Decrypt `credentialsEncrypted` for each using the shared `EVENTS_CREDENTIAL_KEY`. Build the credential batch.

### Step 2 — validateCredentials

For each credential, call the provider's `test()` function. Mark failed credentials as skipped. Update `lastVerifiedAt` on success; set `lastSyncStatus = error` and `lastErrorMessage` on failure. Non-fatal — other credentials proceed.

This step can run concurrently (same `p-limit(50)` pool as step 3).

### Step 3 — fetchEvents

For each valid credential, call the provider's `fetch()` function. Returns an array of `RawEvent[]`. Individual credential failures are logged and added to `failedCredentials` in the run record; other credentials continue.

Concurrent with step 2 — credentials that pass validation immediately proceed to fetch within the same worker pool.

### Step 4 — matchLibraries

- **`scope=library` credentials**: all fetched events inherit the credential's explicit library FK. No fuzzy matching required.
- **`scope=group` credentials**:
  1. Apply the provider's venue pre-filter (see Provider section) to aggressively remove events clearly not at library venues before anything reaches the matching stage.
  2. For surviving events, run Levenshtein distance between the event's `venueName` and each `Library.name` in the credential's `libraries` set.
  3. Distance ≤ 0.25 → confident match; assign library FK.
  4. Distance 0.25–0.40 → low-confidence match; set `pendingReview = true`, assign tentative FK, increment `eventsPendingReview`.
  5. Distance > 0.40 → discard silently; log to the run record. Do **not** surface for review.

The guiding principle is **filter aggressively first, review only the remainder**. The reference project suffered from excessive noise in the admin review queue from unrelated venue events.

### Step 5 — normalizeEvents

Map each `RawEvent` to the canonical `event` shape:

- Compute `syncHash` = SHA-1 of `(externalId + provider + startTime.toISOString() + title)`.
- Map provider category/type string to `EventType` via the provider's `eventTypeMap` lookup table. Fall back to `"other"` if unmapped.
- Parse and convert `startTime` / `endTime` to UTC.
- Truncate `description` to `summary` at ≤ 280 chars on the last word boundary.
- Detect `isFree`: `price === 0` or provider explicitly marks as free.
- Parse `audience` from provider tags/categories.

### Step 6 — deduplicateUpsert

Bulk operation via knex directly against `ev_events`. Batched at 500 rows per `INSERT ... ON CONFLICT DO UPDATE` statement:

```sql
INSERT INTO ev_events (external_id, source_provider, sync_hash, ...)
VALUES (...)
ON CONFLICT (source_provider, external_id) DO UPDATE SET
  sync_hash     = EXCLUDED.sync_hash,
  title         = CASE WHEN ev_events.sync_hash != EXCLUDED.sync_hash
                       THEN EXCLUDED.title ELSE ev_events.title END,
  -- ... (all mutable fields, conditional on hash change)
  last_seen_at  = NOW()
```

After each batch, the worker updates the running `eventsCreated` / `eventsUpdated` / `eventsUnchanged` counts on the `ev_import_runs` row so the dashboard shows live progress.

### Step 7 — purgeExpired

```sql
DELETE FROM ev_events WHERE end_time < NOW() - INTERVAL '1 hour'
```

The 1-hour buffer handles timezone edge cases and late-running events. Count of deleted rows written to `eventsExpiredPurged` on the run record.

### Step 8 — writeImportRun

Set `status` to `success` / `partial` / `failed`, write `completedAt`, `durationMs`, `providerBreakdown`, `failedCredentials`, and `notes`. Update `lastSyncAt` and `lastSyncStatus` on each credential row.

---

## Provider abstraction

Each provider lives in `apps/sync-worker/src/providers/` and implements this TypeScript interface:

```ts
export type ProviderKey =
  | "eventbrite"
  | "ical"
  | "ticketsource"
  | "meetup"
  | "wegottickets"
  | "spydus"
  | "bibliocommons"

export type EventType =
  | "talk"
  | "exhibition"
  | "storytime"
  | "book_club"
  | "workshop"
  | "tour"
  | "screening"
  | "reading_group"
  | "performance"
  | "drop_in"
  | "other"

export interface RawEvent {
  externalId: string
  title: string
  description: string
  url: string
  imageUrl?: string
  startTime: string // ISO 8601
  endTime?: string
  allDay: boolean
  timezone: string // IANA
  providerCategory?: string // raw category string — fed into eventTypeMap
  tags: string[]
  isFree: boolean
  priceMin?: number
  priceMax?: number
  registrationUrl?: string
  capacity?: number
  venueName?: string // used for group-scope matching
  venueAddress?: string
}

export interface LibraryHint {
  entityRef: string
  name: string
  address?: string
}

export interface EventProvider {
  readonly name: ProviderKey
  readonly eventTypeMap: Record<string, EventType>
  test(
    credentials: Record<string, string>
  ): Promise<{ ok: boolean; error?: string }>
  fetch(
    credentials: Record<string, string>,
    hints: LibraryHint[]
  ): Promise<RawEvent[]>
}
```

The `eventTypeMap` is a per-provider static lookup table. The key is the exact category/type string as returned by the provider; the value is the canonical `EventType`. Example for Eventbrite:

```ts
const eventTypeMap: Record<string, EventType> = {
  lectures_and_books: "talk",
  literary_arts: "talk",
  seminars: "talk",
  workshops_and_classes: "workshop",
  learning_and_education: "workshop",
  family_and_education: "storytime",
  kids_and_family: "storytime",
  reading_groups: "reading_group",
  book_club: "book_club",
  exhibitions: "exhibition",
  performing_arts: "performance",
  theatre_arts: "performance",
  film_and_media: "screening",
  tours: "tour",
  charity_and_causes: "other",
  community: "other",
  food_and_drink: "other",
  music: "performance",
  other: "other",
}
```

### Planned providers

| Provider          | Auth                           | Venue pre-filter strategy                                            | Phase |
| ----------------- | ------------------------------ | -------------------------------------------------------------------- | ----- |
| **Eventbrite**    | OAuth token + organisation ID  | Filter by venue `name` containing library keyword list               | 1     |
| **iCal / RSS**    | Feed URL, optional basic-auth  | No venue filter needed — credential is already scoped to one library | 1     |
| **TicketSource**  | API key                        | Filter by venue category                                             | 4     |
| **Meetup**        | API key + group URL            | Group URL is already library-scoped                                  | 4     |
| **WeGotTickets**  | XML feed URL                   | XML feed is already library-scoped per credential                    | 4     |
| **Spydus**        | Endpoint + username + password | Library management system — all events are library events by nature  | 4     |
| **BiblioCommons** | Subdomain + API key            | Low priority — no test credentials currently available               | 4     |

---

## Admin dashboard (Strapi plugin)

The Strapi admin panel extension (`admin/src/`) contains a full React dashboard built using the **Strapi Design System**. It is the operator's primary interface for the events system.

### Dashboard panels

#### 1. System status bar

A compact header strip shown across all dashboard views:

- **Worker status**: green dot (`ONLINE`) or red dot (`OFFLINE` / `STALE`) based on polling `WORKER_URL/health` every 30 seconds. Shows last heartbeat time.
- **Events in store**: total row count in `ev_events`.
- **Last sync**: relative time + status badge (`Success`, `Partial`, `Failed`).
- **Next scheduled sync**: derived from `EVENTS_SYNC_CRON` (parsed and displayed as human-readable).

#### 2. Sync controls

Prominent "Trigger Sync Now" button. Disabled while a sync is `running`.

When clicked: calls `POST /api/events/admin/sync`, which inserts into `ev_sync_commands`. The UI then polls the latest `ev_import_runs` row every 3 seconds while `status = running`, showing a live progress panel:

```
Syncing...  ████████░░░░░░░░░░░░  47 / 200 credentials
  Fetched:   8,320 events
  Created:   1,204
  Updated:     88
  Unchanged: 7,028
  Pending review: 12
```

Counts update in real time as the worker flushes each credential batch.

#### 3. Import run history

A paginated table of recent sync runs (`GET /api/events/admin/runs`):

| Column    | Content                                             |
| --------- | --------------------------------------------------- |
| Status    | Badge: `Success` / `Partial` / `Failed` / `Running` |
| Triggered | `Cron` or `Manual (username)`                       |
| Started   | Relative timestamp                                  |
| Duration  | e.g. `6m 42s`                                       |
| Events    | `+1,204 new  88 updated  7,028 unchanged`           |
| Errors    | Error count badge if > 0                            |
| Actions   | "View details"                                      |

Clicking "View details" opens a slide-over panel showing `providerBreakdown` (per-provider table of fetched/created/updated/errors), the full `failedCredentials` list with error messages, and the run `notes`.

#### 4. Credential manager

Full CRUD for `ev_event_credentials`:

- List view: table of credentials with columns `Label`, `Provider`, `Scope`, `Status` (last sync status badge), `Last Verified`, `Active` toggle.
- Add/Edit: side panel form. Provider selector (`<Select>`) dynamically renders the correct credential field inputs for that provider (e.g. Eventbrite shows `Organization ID` + `Access Token` inputs; iCal shows `Feed URL` + optional basic-auth fields).
- **Test** button on each row: calls `POST /api/events/admin/credentials/:id/test` → proxied to the sync worker → returns `{ ok, error? }` inline in the table row with success/error styling.
- **Active toggle**: patches `isActive` via `PUT /api/events/admin/credentials/:id`.
- **Delete**: confirmation modal.

#### 5. Pending review queue

Shows all events with `pendingReview = true` (`GET /api/events/admin/pending-review`).

Each card displays:

- Event title, date/time, and provider badge
- The venue name as received from the provider
- The tentative library match (name + `entityRef`)
- Levenshtein match score
- **Confirm match** button → `PATCH /api/events/admin/pending-review/:id { action: "approve" }` — clears `pendingReview`, keeps the tentative library FK.
- **Discard** button → deletes the event row.

#### 6. Provider health summary

A grid of cards, one per provider that has at least one active credential. Each card shows:

- Provider name and icon
- Total active credentials for this provider
- Aggregate last sync status (all OK / some errors / all errors)
- Most recent error message if any credential has `lastSyncStatus = error`

---

## Credential encryption

No external plugin dependency. In-service AES-256-GCM using Node.js `node:crypto`. The same implementation is used in both the Strapi plugin (write path, when saving credentials via the admin UI) and the sync worker (read path, when decrypting for sync). The implementation lives in `packages/events-crypto/` (a small shared package in the monorepo) to avoid duplication.

- **Key**: `EVENTS_CREDENTIAL_KEY` env var — 64-character hex string (32 bytes). Must be set in both Strapi and the sync worker.
- **Stored blob**: `{ iv: string, tag: string, ct: string }` serialised as base64 JSON in the `credentialsEncrypted` column.
- The key never leaves the server. All admin API responses that include credential data omit `credentialsEncrypted` entirely.
- **On every save**: re-encrypt the full credentials object, even if only one field changed.
- **Key rotation**: add `EVENTS_CREDENTIAL_KEY_PREV` env var (both services). Decrypt with current key first; fall back to previous key. Re-encrypt with current key on the next credential save. Remove `_PREV` once all credentials have been re-saved.

---

## Cron jobs

All cron runs in the **sync worker process**, never in Strapi's `bootstrap()`.

| Job            | Schedule                        | Action                                                    |
| -------------- | ------------------------------- | --------------------------------------------------------- |
| `sync`         | `0 */6 * * *` (every 6h)        | Full import pipeline                                      |
| `purge`        | `0 3 * * *` (03:00 UTC nightly) | Delete events where `end_time < now() - 1h`               |
| `prune-logs`   | `0 4 * * 0` (Sunday 04:00 UTC)  | Delete `ev_import_runs` rows older than 90 days           |
| `poll-command` | `*/2 * * * *` (every 2 min)     | Check `ev_sync_commands` for admin-triggered manual syncs |

Sync interval is configurable via `EVENTS_SYNC_CRON` env var. The sync worker uses [node-cron](https://github.com/node-cron/node-cron).

---

## API surface

### Content API (public, no auth)

All read-only. Returns only upcoming or ongoing events (`status != 'cancelled'`).

```
GET /api/events/library/:entityRef
    Events for one library, sorted startTime ASC.
    ?limit=20&page=1&type=talk&isFree=true&from=ISO&to=ISO

GET /api/events/location
    Events for all libraries within a location scope, paginated.
    ?continent=europe&country=gb&region=greater-london&limit=20&page=1

GET /api/events/global
    All upcoming events. Powers /programme.
    ?type=&isFree=&country=&continent=&from=&to=&limit=&page=

GET /api/events/this-week
    Events from NOW to NOW+7 days. Used in homepage / hero banners.

GET /api/events/stats
    { totalEvents, totalThisWeek, percentFree, peakDay, peakHour,
      topLibraries: [{ entityRef, name, count }],
      byProvider: { eventbrite: N, ical: N, ... } }
```

### Admin API (isAuthenticatedAdmin)

```
GET    /api/events/admin/credentials
POST   /api/events/admin/credentials
PUT    /api/events/admin/credentials/:id
DELETE /api/events/admin/credentials/:id
POST   /api/events/admin/credentials/:id/test     → proxies to WORKER_URL/test-credential

GET    /api/events/admin/runs?limit=20&page=1
GET    /api/events/admin/runs/:runId

GET    /api/events/admin/pending-review?limit=20&page=1
PATCH  /api/events/admin/pending-review/:id       → { action: "approve" | "discard" }

POST   /api/events/admin/sync                     → inserts ev_sync_commands row
GET    /api/events/admin/worker-health            → proxies GET WORKER_URL/health
```

---

## Frontend integration

### Library detail page

New "Events" tab. Fetches `GET /api/events/library/:entityRef`. Chronological list with event type chip, time, free/paid badge, image thumbnail (from `imageUrl`, provider-hosted), and registration link.

### Location pages (region / country / continent)

New "Events" collapsible section below the library grid. Shows the next 5–8 upcoming events for that location scope, with "View all events →" linking to `/programme?country=...`.

### `/programme` — global events dashboard

| Section                        | Data source                                                               |
| ------------------------------ | ------------------------------------------------------------------------- |
| Hero stats bar                 | `/api/events/stats`                                                       |
| Featured event hero            | First upcoming event with `imageUrl`                                      |
| Filter bar                     | Type, format, time range, free/paid, scope (global / continent / country) |
| "Today's programme" timeline   | Events for today, grouped by hour                                         |
| "Where the doors are open" map | Events geo-plotted on MapLibre GL using library coordinates               |
| "Where events come from"       | `byProvider` from `/api/events/stats`                                     |
| "Most active libraries"        | `topLibraries` from `/api/events/stats`                                   |

---

## File structure

### Strapi plugin (`apps/strapi/src/plugins/events/`)

```
plugin::events — owns schemas, admin UI, read-only content API
  package.json
  strapi-admin.ts         — registers the admin panel extension
  strapi-server.ts        — registers content types, routes, services
  admin/
    src/
      index.tsx           — plugin registration
      pages/
        Dashboard.tsx     — main events dashboard
        CredentialForm.tsx
        PendingReview.tsx
      components/
        StatusBar.tsx
        SyncControls.tsx
        RunHistoryTable.tsx
        RunDetailPanel.tsx
        CredentialList.tsx
        ProviderHealthGrid.tsx
  server/
    content-types/
      event-credential/schema.json
      event/schema.json
      import-run/schema.json
      sync-command/schema.json
      index.ts
    controllers/
      events.ts           — content API + public stats
      admin.ts            — admin CRUD, run history, pending review, sync trigger
      index.ts
    routes/
      content-api.ts
      admin.ts
      index.ts
    services/
      credentials.ts      — encrypt / decrypt / CRUD (uses packages/events-crypto)
      index.ts
```

The plugin contains **no pipeline code, no provider implementations, and no cron jobs**.

### Shared crypto package (`packages/events-crypto/`)

```
packages/events-crypto/
  package.json
  src/
    index.ts    — encrypt(plaintext, key), decrypt(blob, key, prevKey?)
```

Imported by both the Strapi plugin and the sync worker. Keeps the AES-256-GCM implementation in one place.

### Sync worker (`apps/sync-worker/`)

```
apps/sync-worker/
  package.json
  tsconfig.json
  .env.example      — DATABASE_URL, EVENTS_CREDENTIAL_KEY, EVENTS_SYNC_CRON,
                       EVENTS_SYNC_CONCURRENCY, WORKER_PORT
  src/
    index.ts          — entry point: starts HTTP server, registers crons, starts poll loop
    server.ts         — tiny HTTP server: GET /health, POST /test-credential
    db.ts             — knex connection pool (shared DATABASE_URL)
    cron.ts           — node-cron job registration
    pipeline/
      sync.ts               — orchestrates all 8 steps, manages concurrency pool
      load-credentials.ts
      validate.ts
      fetch.ts
      match-libraries.ts    — Levenshtein venue matching
      normalize.ts          — RawEvent → canonical Event, syncHash, summary truncation
      upsert.ts             — bulk INSERT ... ON CONFLICT, chunked at 500 rows
      purge.ts              — DELETE expired events
      write-run.ts          — finalise ev_import_runs, update credential statuses
    providers/
      types.ts              — EventProvider interface, RawEvent, LibraryHint, all enums
      eventbrite.ts
      ical.ts
      ticketsource.ts
      meetup.ts
      wegottickets.ts
      spydus.ts
      bibliocommons.ts
      index.ts              — provider registry: Map<ProviderKey, EventProvider>
    lib/
      levenshtein.ts        — fast-levenshtein wrapper with normalised distance helper
      date.ts               — UTC conversion, ISO week helpers
```

---

## Implementation phases

### Phase 1 — Backend foundation

- `packages/events-crypto/` — AES-256-GCM shared package
- `plugin::events` content type schemas + DB migrations (all 4 tables)
- Credential service in Strapi plugin (encrypt / decrypt / CRUD), admin API routes
- Sync worker scaffold with knex, node-cron, `p-limit`, TypeScript
- `eventbrite.ts` provider with venue pre-filter and `eventTypeMap`
- `ical.ts` provider (generic iCal/RSS feed fallback)
- Full 8-step pipeline in sync worker with bounded concurrency
- Worker HTTP server (`/health`, `/test-credential`)
- Cron registration (sync, purge, prune, poll-command) in sync worker
- Content API routes + controller (library, location, global, this-week, stats)

### Phase 2 — Admin dashboard

- Strapi admin panel extension scaffold
- Status bar (worker health + event count + last/next sync)
- Import run history table + detail slide-over
- Credential manager (list, add, edit, test-ping, active toggle, delete)
- Manual sync trigger with live progress polling
- Pending review triage queue

### Phase 3 — Frontend

- Library detail page Events tab
- Location pages Events collapsible section
- `/programme` global events dashboard (all sections from mockup)

### Phase 4 — Additional providers

- TicketSource, WeGotTickets, Spydus, Meetup
- BiblioCommons (when test credentials are available)
- Provider health summary panel in admin dashboard

---

## Out of scope

- BullMQ / Redis / any external queue infrastructure
- AI-based venue matching or tag classification
- RSVP or in-platform ticket booking (we link out to `registrationUrl`)
- Long-term historical event archive
- Push notifications or email digests for events
- User-personalised event recommendations
- Event submission by library staff (separate contribution flow, future)
- Image re-hosting — provider `imageUrl` values are used directly as strings
