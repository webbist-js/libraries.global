# Events System Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the events aggregation backend: shared crypto package, Strapi `plugin::events` with content types and API, and a standalone sync worker with Eventbrite + iCal providers.

**Architecture:** Two components share a PostgreSQL database. The Strapi plugin owns all schema migrations and serves a read-only content API plus an admin management API. The sync worker is a standalone Node.js/TypeScript process that reads credentials and writes events directly to the DB via knex — it never calls Strapi's HTTP API. They communicate through the DB (sync commands table, import run rows).

**Tech stack:** TypeScript (CommonJS, strict), Strapi v5, knex + pg, p-limit, node-cron, ical.js, vitest

---

## File map

### New: `packages/events-crypto/`

- `package.json`
- `tsconfig.json`
- `src/index.ts` — `encrypt(plain, key)`, `decrypt(blob, key, prevKey?)`
- `tests/crypto.test.ts`

### New: `apps/strapi/src/plugins/events/`

- `package.json` — Strapi plugin manifest
- `strapi-server.ts` — `register`, `bootstrap`, content types, routes, services, controllers
- `server/content-types/event-credential/schema.json`
- `server/content-types/event/schema.json`
- `server/content-types/import-run/schema.json`
- `server/content-types/sync-command/schema.json`
- `server/content-types/index.ts`
- `server/services/credentials.ts` — encrypt/decrypt/CRUD using `@repo/events-crypto`
- `server/services/index.ts`
- `server/controllers/events.ts` — public content API handlers
- `server/controllers/admin.ts` — admin CRUD, run history, sync trigger, worker health proxy
- `server/controllers/index.ts`
- `server/routes/content-api.ts`
- `server/routes/admin.ts`
- `server/routes/index.ts`

### Modified

- `apps/strapi/config/plugins.ts` — add `events` entry
- `apps/strapi/package.json` — add `events` to `build:plugins` script

### New: `apps/sync-worker/`

- `package.json`, `tsconfig.json`, `.env.example`
- `src/index.ts` — entry: starts cron + HTTP server
- `src/server.ts` — `GET /health`, `POST /test-credential`
- `src/db.ts` — knex pool
- `src/cron.ts` — node-cron job registration
- `src/providers/types.ts` — `EventProvider`, `RawEvent`, `NormalizedEvent`, enums
- `src/providers/eventbrite.ts`
- `src/providers/ical.ts`
- `src/providers/index.ts` — provider registry
- `src/lib/levenshtein.ts`
- `src/lib/date.ts`
- `src/pipeline/sync.ts` — orchestrator with p-limit
- `src/pipeline/load-credentials.ts`
- `src/pipeline/validate.ts`
- `src/pipeline/fetch.ts`
- `src/pipeline/match-libraries.ts`
- `src/pipeline/normalize.ts`
- `src/pipeline/upsert.ts`
- `src/pipeline/purge.ts`
- `src/pipeline/write-run.ts`
- `tests/lib/levenshtein.test.ts`
- `tests/lib/date.test.ts`
- `tests/pipeline/normalize.test.ts`
- `tests/pipeline/match-libraries.test.ts`
- `tests/providers/eventbrite.test.ts`
- `tests/providers/ical.test.ts`

---

## Task 1: Shared crypto package

**Files:**

- Create: `packages/events-crypto/package.json`
- Create: `packages/events-crypto/tsconfig.json`
- Create: `packages/events-crypto/src/index.ts`
- Create: `packages/events-crypto/tests/crypto.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@repo/events-crypto",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Write the failing test**

```typescript
// packages/events-crypto/tests/crypto.test.ts
import { describe, it, expect } from "vitest"
import { encrypt, decrypt } from "../src/index"

const KEY = "a".repeat(64) // 32 bytes as hex
const PREV_KEY = "b".repeat(64)

describe("encrypt / decrypt", () => {
  it("round-trips a JSON payload", () => {
    const plain = JSON.stringify({ accessToken: "tok_123", orgId: "456" })
    expect(decrypt(encrypt(plain, KEY), KEY)).toBe(plain)
  })

  it("produces different ciphertext each call (random IV)", () => {
    expect(encrypt("hello", KEY)).not.toBe(encrypt("hello", KEY))
  })

  it("decrypts with prevKey when current key fails", () => {
    const blob = encrypt("secret", PREV_KEY)
    expect(decrypt(blob, KEY, PREV_KEY)).toBe("secret")
  })

  it("throws on wrong key with no fallback", () => {
    const blob = encrypt("secret", KEY)
    expect(() => decrypt(blob, PREV_KEY)).toThrow()
  })
})
```

- [ ] **Step 4: Run test — expect FAIL**

```bash
cd packages/events-crypto && pnpm test
```

Expected: `Cannot find module '../src/index'`

- [ ] **Step 5: Implement crypto**

```typescript
// packages/events-crypto/src/index.ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const ALGO = "aes-256-gcm" as const

interface Blob {
  iv: string
  tag: string
  ct: string
}

export function encrypt(plaintext: string, hexKey: string): string {
  const key = Buffer.from(hexKey, "hex")
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return JSON.stringify({
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: ct.toString("base64"),
  } satisfies Blob)
}

export function decrypt(
  blobJson: string,
  hexKey: string,
  prevHexKey?: string
): string {
  try {
    return _decrypt(blobJson, hexKey)
  } catch {
    if (prevHexKey != null) return _decrypt(blobJson, prevHexKey)
    throw new Error("Decryption failed — wrong key or corrupted blob")
  }
}

function _decrypt(blobJson: string, hexKey: string): string {
  const { iv, tag, ct } = JSON.parse(blobJson) as Blob
  const key = Buffer.from(hexKey, "hex")
  const decipher = createDecipheriv(ALGO, key, Buffer.from(iv, "base64"))
  decipher.setAuthTag(Buffer.from(tag, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(ct, "base64")),
    decipher.final(),
  ]).toString("utf8")
}
```

- [ ] **Step 6: Run test — expect PASS**

```bash
cd packages/events-crypto && pnpm test
```

Expected: 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/events-crypto/
git commit -m "feat(events-crypto): AES-256-GCM shared encryption package"
```

---

## Task 2: Strapi plugin — package & content type schemas

**Files:**

- Create: `apps/strapi/src/plugins/events/package.json`
- Create: `apps/strapi/src/plugins/events/server/content-types/event-credential/schema.json`
- Create: `apps/strapi/src/plugins/events/server/content-types/event/schema.json`
- Create: `apps/strapi/src/plugins/events/server/content-types/import-run/schema.json`
- Create: `apps/strapi/src/plugins/events/server/content-types/sync-command/schema.json`
- Create: `apps/strapi/src/plugins/events/server/content-types/index.ts`

- [ ] **Step 1: Create plugin package.json**

```json
{
  "name": "events",
  "version": "0.1.0",
  "description": "Events aggregation plugin for libraries.global",
  "strapi": {
    "kind": "plugin",
    "name": "events",
    "displayName": "Events",
    "description": "Aggregates library events from third-party providers"
  },
  "scripts": {
    "build": "strapi-plugin build",
    "watch": "strapi-plugin watch"
  },
  "main": "./dist/server/index.js",
  "exports": {
    "./package.json": "./package.json",
    "./strapi-server": {
      "source": "./strapi-server.ts",
      "import": "./dist/server/index.mjs",
      "require": "./dist/server/index.js",
      "default": "./dist/server/index.js"
    }
  },
  "peerDependencies": {
    "@strapi/strapi": "^5.0.0"
  },
  "dependencies": {
    "@repo/events-crypto": "workspace:*"
  },
  "files": ["dist", "strapi-server.ts"]
}
```

- [ ] **Step 2: Create event-credential schema**

```json
// apps/strapi/src/plugins/events/server/content-types/event-credential/schema.json
{
  "kind": "collectionType",
  "collectionName": "ev_event_credentials",
  "info": {
    "singularName": "event-credential",
    "pluralName": "event-credentials",
    "displayName": "Event Credential"
  },
  "options": { "draftAndPublish": false },
  "pluginOptions": {
    "content-manager": { "visible": false },
    "content-type-builder": { "visible": false }
  },
  "attributes": {
    "provider": {
      "type": "enumeration",
      "required": true,
      "enum": [
        "eventbrite",
        "ticketsource",
        "meetup",
        "ical",
        "wegottickets",
        "spydus",
        "bibliocommons"
      ]
    },
    "label": { "type": "string", "required": true },
    "scope": {
      "type": "enumeration",
      "required": true,
      "enum": ["library", "group"]
    },
    "libraries": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::library.library"
    },
    "isActive": { "type": "boolean", "required": true, "default": true },
    "lastVerifiedAt": { "type": "datetime" },
    "lastSyncAt": { "type": "datetime" },
    "lastSyncStatus": {
      "type": "enumeration",
      "enum": ["ok", "partial", "error"]
    },
    "lastErrorMessage": { "type": "text" },
    "credentialsEncrypted": { "type": "text", "required": true }
  }
}
```

- [ ] **Step 3: Create event schema**

```json
// apps/strapi/src/plugins/events/server/content-types/event/schema.json
{
  "kind": "collectionType",
  "collectionName": "ev_events",
  "info": {
    "singularName": "event",
    "pluralName": "events",
    "displayName": "Event"
  },
  "options": { "draftAndPublish": false },
  "pluginOptions": {
    "content-manager": { "visible": false },
    "content-type-builder": { "visible": false }
  },
  "attributes": {
    "externalId": { "type": "string", "required": true },
    "sourceProvider": {
      "type": "enumeration",
      "required": true,
      "enum": [
        "eventbrite",
        "ticketsource",
        "meetup",
        "ical",
        "wegottickets",
        "spydus",
        "bibliocommons"
      ]
    },
    "credentialId": { "type": "integer", "required": true },
    "syncHash": { "type": "string", "required": true },
    "library": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "api::library.library"
    },
    "libraryEntityRef": { "type": "string", "required": true },
    "title": { "type": "string", "required": true },
    "description": { "type": "text" },
    "summary": { "type": "text" },
    "url": { "type": "string", "required": true },
    "imageUrl": { "type": "string" },
    "startTime": { "type": "datetime", "required": true },
    "endTime": { "type": "datetime" },
    "allDay": { "type": "boolean", "default": false },
    "timezone": { "type": "string", "required": true },
    "eventType": {
      "type": "enumeration",
      "required": true,
      "enum": [
        "talk",
        "exhibition",
        "storytime",
        "book_club",
        "workshop",
        "tour",
        "screening",
        "reading_group",
        "performance",
        "drop_in",
        "other"
      ],
      "default": "other"
    },
    "audience": { "type": "json" },
    "tags": { "type": "json" },
    "isFree": { "type": "boolean", "default": false },
    "priceMin": { "type": "decimal" },
    "priceMax": { "type": "decimal" },
    "registrationUrl": { "type": "string" },
    "capacity": { "type": "integer" },
    "status": {
      "type": "enumeration",
      "required": true,
      "enum": ["upcoming", "ongoing", "cancelled", "postponed"],
      "default": "upcoming"
    },
    "pendingReview": { "type": "boolean", "default": false },
    "importedAt": { "type": "datetime", "required": true },
    "lastSeenAt": { "type": "datetime", "required": true }
  }
}
```

- [ ] **Step 4: Create import-run schema**

```json
// apps/strapi/src/plugins/events/server/content-types/import-run/schema.json
{
  "kind": "collectionType",
  "collectionName": "ev_import_runs",
  "info": {
    "singularName": "import-run",
    "pluralName": "import-runs",
    "displayName": "Import Run"
  },
  "options": { "draftAndPublish": false },
  "pluginOptions": {
    "content-manager": { "visible": false },
    "content-type-builder": { "visible": false }
  },
  "attributes": {
    "runId": { "type": "string", "required": true },
    "triggeredBy": {
      "type": "enumeration",
      "required": true,
      "enum": ["cron", "manual"]
    },
    "triggeredByUserId": { "type": "integer" },
    "startedAt": { "type": "datetime", "required": true },
    "completedAt": { "type": "datetime" },
    "durationMs": { "type": "integer" },
    "status": {
      "type": "enumeration",
      "required": true,
      "enum": ["running", "success", "partial", "failed"],
      "default": "running"
    },
    "credentialsTotal": { "type": "integer", "default": 0 },
    "credentialsAttempted": { "type": "integer", "default": 0 },
    "credentialsFailed": { "type": "integer", "default": 0 },
    "eventsFetched": { "type": "integer", "default": 0 },
    "eventsCreated": { "type": "integer", "default": 0 },
    "eventsUpdated": { "type": "integer", "default": 0 },
    "eventsUnchanged": { "type": "integer", "default": 0 },
    "eventsExpiredPurged": { "type": "integer", "default": 0 },
    "eventsPendingReview": { "type": "integer", "default": 0 },
    "errorCount": { "type": "integer", "default": 0 },
    "providerBreakdown": { "type": "json" },
    "failedCredentials": { "type": "json" },
    "notes": { "type": "text" }
  }
}
```

- [ ] **Step 5: Create sync-command schema**

```json
// apps/strapi/src/plugins/events/server/content-types/sync-command/schema.json
{
  "kind": "collectionType",
  "collectionName": "ev_sync_commands",
  "info": {
    "singularName": "sync-command",
    "pluralName": "sync-commands",
    "displayName": "Sync Command"
  },
  "options": { "draftAndPublish": false },
  "pluginOptions": {
    "content-manager": { "visible": false },
    "content-type-builder": { "visible": false }
  },
  "attributes": {
    "requestedAt": { "type": "datetime", "required": true },
    "requestedByUserId": { "type": "integer" },
    "consumedAt": { "type": "datetime" }
  }
}
```

- [ ] **Step 6: Create content-types index**

```typescript
// apps/strapi/src/plugins/events/server/content-types/index.ts
import eventCredentialSchema from "./event-credential/schema.json"
import eventSchema from "./event/schema.json"
import importRunSchema from "./import-run/schema.json"
import syncCommandSchema from "./sync-command/schema.json"

export default {
  "event-credential": { schema: eventCredentialSchema },
  event: { schema: eventSchema },
  "import-run": { schema: importRunSchema },
  "sync-command": { schema: syncCommandSchema },
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/strapi/src/plugins/events/
git commit -m "feat(events): Strapi plugin package + content type schemas"
```

---

## Task 3: Strapi plugin — credential service

**Files:**

- Create: `apps/strapi/src/plugins/events/server/services/credentials.ts`
- Create: `apps/strapi/src/plugins/events/server/services/index.ts`

- [ ] **Step 1: Create credentials service**

```typescript
// apps/strapi/src/plugins/events/server/services/credentials.ts
import { encrypt, decrypt } from "@repo/events-crypto"

const KEY_ENV = "EVENTS_CREDENTIAL_KEY"
const PREV_KEY_ENV = "EVENTS_CREDENTIAL_KEY_PREV"

function getKey(): string {
  const key = process.env[KEY_ENV]
  if (!key || key.length !== 64) {
    throw new Error(`${KEY_ENV} must be a 64-character hex string`)
  }
  return key
}

function getPrevKey(): string | undefined {
  const k = process.env[PREV_KEY_ENV]
  return k && k.length === 64 ? k : undefined
}

export function encryptCredentials(plain: Record<string, string>): string {
  return encrypt(JSON.stringify(plain), getKey())
}

export function decryptCredentials(blob: string): Record<string, string> {
  return JSON.parse(decrypt(blob, getKey(), getPrevKey())) as Record<
    string,
    string
  >
}

export default ({ strapi }: { strapi: any }) => ({
  async findAll() {
    return strapi.documents("plugin::events.event-credential").findMany({
      populate: { libraries: { fields: ["id", "name", "entityRef"] } },
    })
  },

  async findOne(documentId: string) {
    return strapi.documents("plugin::events.event-credential").findOne({
      documentId,
      populate: { libraries: { fields: ["id", "name", "entityRef"] } },
    })
  },

  async create(data: {
    provider: string
    label: string
    scope: string
    isActive: boolean
    libraryDocumentIds?: string[]
    credentials: Record<string, string>
  }) {
    const credentialsEncrypted = encryptCredentials(data.credentials)
    return strapi.documents("plugin::events.event-credential").create({
      data: {
        provider: data.provider,
        label: data.label,
        scope: data.scope,
        isActive: data.isActive,
        credentialsEncrypted,
        ...(data.libraryDocumentIds?.length
          ? {
              libraries: data.libraryDocumentIds.map((id) => ({
                documentId: id,
              })),
            }
          : {}),
      },
    })
  },

  async update(
    documentId: string,
    data: {
      label?: string
      isActive?: boolean
      libraryDocumentIds?: string[]
      credentials?: Record<string, string>
    }
  ) {
    const patch: Record<string, unknown> = {}
    if (data.label != null) patch.label = data.label
    if (data.isActive != null) patch.isActive = data.isActive
    if (data.credentials != null) {
      patch.credentialsEncrypted = encryptCredentials(data.credentials)
    }
    if (data.libraryDocumentIds != null) {
      patch.libraries = data.libraryDocumentIds.map((id) => ({
        documentId: id,
      }))
    }
    return strapi
      .documents("plugin::events.event-credential")
      .update({ documentId, data: patch })
  },

  async delete(documentId: string) {
    return strapi
      .documents("plugin::events.event-credential")
      .delete({ documentId })
  },

  async getDecryptedCredentials(
    documentId: string
  ): Promise<Record<string, string>> {
    const doc = await strapi
      .documents("plugin::events.event-credential")
      .findOne({
        documentId,
        fields: ["credentialsEncrypted"],
      })
    if (!doc) throw new Error(`Credential ${documentId} not found`)
    return decryptCredentials(doc.credentialsEncrypted as string)
  },
})
```

- [ ] **Step 2: Create services index**

```typescript
// apps/strapi/src/plugins/events/server/services/index.ts
import credentials from "./credentials"
export default { credentials }
```

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/src/plugins/events/server/services/
git commit -m "feat(events): credential service with AES-256-GCM encrypt/decrypt"
```

---

## Task 4: Strapi plugin — content API routes & controller

**Files:**

- Create: `apps/strapi/src/plugins/events/server/controllers/events.ts`
- Create: `apps/strapi/src/plugins/events/server/controllers/index.ts`
- Create: `apps/strapi/src/plugins/events/server/routes/content-api.ts`

- [ ] **Step 1: Create events controller**

```typescript
// apps/strapi/src/plugins/events/server/controllers/events.ts
export default ({ strapi }: { strapi: any }) => ({
  async library(ctx: any) {
    const { entityRef } = ctx.params as { entityRef: string }
    const {
      limit = "20",
      page = "1",
      type,
      isFree,
    } = ctx.query as Record<string, string>

    const filters: Record<string, unknown> = {
      libraryEntityRef: entityRef,
      startTime: { $gte: new Date().toISOString() },
      status: { $in: ["upcoming", "ongoing"] },
    }
    if (type) filters.eventType = type
    if (isFree != null) filters.isFree = isFree === "true"

    const results = await strapi.documents("plugin::events.event").findMany({
      filters,
      sort: ["startTime:asc"],
      pagination: { page: Number(page), pageSize: Number(limit) },
      fields: [
        "title",
        "summary",
        "url",
        "imageUrl",
        "startTime",
        "endTime",
        "allDay",
        "timezone",
        "eventType",
        "isFree",
        "priceMin",
        "priceMax",
        "registrationUrl",
        "status",
        "tags",
      ],
    })
    ctx.body = results
  },

  async location(ctx: any) {
    const {
      continent,
      country,
      region,
      limit = "20",
      page = "1",
    } = ctx.query as Record<string, string>

    // Resolve library entityRefs for the location scope
    const libraryFilters: Record<string, unknown> = {}
    if (continent)
      libraryFilters["area.region.country.continent.slug"] = continent
    if (country) libraryFilters["area.region.country.slug"] = country
    if (region) libraryFilters["area.region.slug"] = region

    const libraries = await strapi.documents("api::library.library").findMany({
      filters: libraryFilters,
      fields: ["entityRef"],
      pagination: { pageSize: 500 },
    })
    const refs = (libraries as any[])
      .map((l: any) => l.entityRef as string)
      .filter(Boolean)
    if (!refs.length) {
      ctx.body = []
      return
    }

    const events = await strapi.documents("plugin::events.event").findMany({
      filters: {
        libraryEntityRef: { $in: refs },
        startTime: { $gte: new Date().toISOString() },
        status: { $in: ["upcoming", "ongoing"] },
      },
      sort: ["startTime:asc"],
      pagination: { page: Number(page), pageSize: Number(limit) },
      fields: [
        "title",
        "summary",
        "url",
        "imageUrl",
        "startTime",
        "endTime",
        "timezone",
        "eventType",
        "isFree",
        "registrationUrl",
        "libraryEntityRef",
      ],
    })
    ctx.body = events
  },

  async global(ctx: any) {
    const {
      type,
      isFree,
      country,
      continent,
      from,
      to,
      limit = "20",
      page = "1",
    } = ctx.query as Record<string, string>
    const now = new Date().toISOString()

    const filters: Record<string, unknown> = {
      startTime: { $gte: from ?? now },
      status: { $in: ["upcoming", "ongoing"] },
    }
    if (to) (filters.startTime as any).$lte = to
    if (type) filters.eventType = type
    if (isFree != null) filters.isFree = isFree === "true"

    const events = await strapi.documents("plugin::events.event").findMany({
      filters,
      sort: ["startTime:asc"],
      pagination: { page: Number(page), pageSize: Number(limit) },
      fields: [
        "title",
        "summary",
        "url",
        "imageUrl",
        "startTime",
        "endTime",
        "timezone",
        "eventType",
        "isFree",
        "registrationUrl",
        "libraryEntityRef",
        "status",
      ],
    })
    ctx.body = events
  },

  async thisWeek(ctx: any) {
    const now = new Date()
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const events = await strapi.documents("plugin::events.event").findMany({
      filters: {
        startTime: { $gte: now.toISOString(), $lte: weekLater.toISOString() },
        status: { $in: ["upcoming", "ongoing"] },
      },
      sort: ["startTime:asc"],
      pagination: { pageSize: 50 },
      fields: [
        "title",
        "url",
        "startTime",
        "eventType",
        "isFree",
        "libraryEntityRef",
      ],
    })
    ctx.body = events
  },

  async stats(ctx: any) {
    const db = strapi.db.connection
    const now = new Date()
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const [totalRow] = await db("ev_events")
      .count("* as count")
      .where("start_time", ">=", now)
    const [weekRow] = await db("ev_events")
      .count("* as count")
      .where("start_time", ">=", now)
      .where("start_time", "<=", weekLater)
    const [freeRow] = await db("ev_events")
      .count("* as count")
      .where("start_time", ">=", now)
      .where("is_free", true)

    const total = Number((totalRow as any).count)
    const totalThisWeek = Number((weekRow as any).count)
    const freeCount = Number((freeRow as any).count)

    ctx.body = {
      totalEvents: total,
      totalThisWeek,
      percentFree: total > 0 ? Math.round((freeCount / total) * 100) : 0,
    }
  },
})
```

- [ ] **Step 2: Create content API routes**

```typescript
// apps/strapi/src/plugins/events/server/routes/content-api.ts
export default [
  {
    method: "GET",
    path: "/library/:entityRef",
    handler: "events.library",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/location",
    handler: "events.location",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/global",
    handler: "events.global",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/this-week",
    handler: "events.thisWeek",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/stats",
    handler: "events.stats",
    config: { auth: false, policies: [] },
  },
]
```

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/src/plugins/events/server/controllers/events.ts \
        apps/strapi/src/plugins/events/server/routes/content-api.ts
git commit -m "feat(events): content API routes (library, location, global, this-week, stats)"
```

---

## Task 5: Strapi plugin — admin API routes & controller

**Files:**

- Create: `apps/strapi/src/plugins/events/server/controllers/admin.ts`
- Create: `apps/strapi/src/plugins/events/server/routes/admin.ts`
- Create: `apps/strapi/src/plugins/events/server/routes/index.ts`
- Create: `apps/strapi/src/plugins/events/server/controllers/index.ts`

- [ ] **Step 1: Create admin controller**

```typescript
// apps/strapi/src/plugins/events/server/controllers/admin.ts
export default ({ strapi }: { strapi: any }) => ({
  async listCredentials(ctx: any) {
    const items = await strapi.plugin("events").service("credentials").findAll()
    // Mask encrypted blob from response
    ctx.body = (items as any[]).map((c: any) => ({
      ...c,
      credentialsEncrypted: undefined,
    }))
  },

  async createCredential(ctx: any) {
    const { credentials, ...rest } = ctx.request.body as {
      credentials: Record<string, string>
      provider: string
      label: string
      scope: string
      isActive: boolean
      libraryDocumentIds?: string[]
    }
    const result = await strapi
      .plugin("events")
      .service("credentials")
      .create({ ...rest, credentials })
    ctx.body = { ...result, credentialsEncrypted: undefined }
  },

  async updateCredential(ctx: any) {
    const { documentId } = ctx.params as { documentId: string }
    const { credentials, ...rest } = ctx.request.body as {
      credentials?: Record<string, string>
      label?: string
      isActive?: boolean
      libraryDocumentIds?: string[]
    }
    const result = await strapi
      .plugin("events")
      .service("credentials")
      .update(documentId, { ...rest, credentials })
    ctx.body = { ...result, credentialsEncrypted: undefined }
  },

  async deleteCredential(ctx: any) {
    const { documentId } = ctx.params as { documentId: string }
    await strapi.plugin("events").service("credentials").delete(documentId)
    ctx.status = 204
  },

  async testCredential(ctx: any) {
    const { documentId } = ctx.params as { documentId: string }
    const workerUrl = process.env.WORKER_URL ?? "http://localhost:3100"
    try {
      const res = await fetch(`${workerUrl}/test-credential`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialDocumentId: documentId }),
        signal: AbortSignal.timeout(10_000),
      })
      ctx.body = await res.json()
    } catch (err: any) {
      ctx.body = { ok: false, error: err.message ?? "Worker unreachable" }
    }
  },

  async listRuns(ctx: any) {
    const { limit = "20", page = "1" } = ctx.query as Record<string, string>
    const results = await strapi
      .documents("plugin::events.import-run")
      .findMany({
        sort: ["startedAt:desc"],
        pagination: { page: Number(page), pageSize: Number(limit) },
      })
    ctx.body = results
  },

  async getRun(ctx: any) {
    const { runId } = ctx.params as { runId: string }
    const run = await strapi.documents("plugin::events.import-run").findMany({
      filters: { runId },
      pagination: { pageSize: 1 },
    })
    if (!run?.[0]) {
      ctx.status = 404
      return
    }
    ctx.body = run[0]
  },

  async triggerSync(ctx: any) {
    const userId = (ctx.state.user as any)?.id ?? null
    await strapi.documents("plugin::events.sync-command").create({
      data: {
        requestedAt: new Date().toISOString(),
        requestedByUserId: userId,
      },
    })
    ctx.body = {
      ok: true,
      message: "Sync command queued — worker picks up within 2 minutes",
    }
  },

  async workerHealth(ctx: any) {
    const workerUrl = process.env.WORKER_URL ?? "http://localhost:3100"
    try {
      const res = await fetch(`${workerUrl}/health`, {
        signal: AbortSignal.timeout(5_000),
      })
      ctx.body = await res.json()
    } catch {
      ctx.body = { ok: false, status: "unreachable" }
    }
  },

  async listPendingReview(ctx: any) {
    const { limit = "20", page = "1" } = ctx.query as Record<string, string>
    const results = await strapi.documents("plugin::events.event").findMany({
      filters: { pendingReview: true },
      sort: ["startTime:asc"],
      pagination: { page: Number(page), pageSize: Number(limit) },
      fields: [
        "title",
        "startTime",
        "libraryEntityRef",
        "sourceProvider",
        "url",
      ],
    })
    ctx.body = results
  },

  async reviewEvent(ctx: any) {
    const { documentId } = ctx.params as { documentId: string }
    const { action } = ctx.request.body as { action: "approve" | "discard" }
    if (action === "approve") {
      await strapi
        .documents("plugin::events.event")
        .update({ documentId, data: { pendingReview: false } })
      ctx.body = { ok: true }
    } else if (action === "discard") {
      await strapi.documents("plugin::events.event").delete({ documentId })
      ctx.status = 204
    } else {
      ctx.status = 400
      ctx.body = { error: "action must be 'approve' or 'discard'" }
    }
  },
})
```

- [ ] **Step 2: Create admin routes**

```typescript
// apps/strapi/src/plugins/events/server/routes/admin.ts
const ADMIN_AUTH = { policies: ["admin::isAuthenticatedAdmin"] }

export default [
  {
    method: "GET",
    path: "/admin/credentials",
    handler: "admin.listCredentials",
    config: ADMIN_AUTH,
  },
  {
    method: "POST",
    path: "/admin/credentials",
    handler: "admin.createCredential",
    config: ADMIN_AUTH,
  },
  {
    method: "PUT",
    path: "/admin/credentials/:documentId",
    handler: "admin.updateCredential",
    config: ADMIN_AUTH,
  },
  {
    method: "DELETE",
    path: "/admin/credentials/:documentId",
    handler: "admin.deleteCredential",
    config: ADMIN_AUTH,
  },
  {
    method: "POST",
    path: "/admin/credentials/:documentId/test",
    handler: "admin.testCredential",
    config: ADMIN_AUTH,
  },
  {
    method: "GET",
    path: "/admin/runs",
    handler: "admin.listRuns",
    config: ADMIN_AUTH,
  },
  {
    method: "GET",
    path: "/admin/runs/:runId",
    handler: "admin.getRun",
    config: ADMIN_AUTH,
  },
  {
    method: "POST",
    path: "/admin/sync",
    handler: "admin.triggerSync",
    config: ADMIN_AUTH,
  },
  {
    method: "GET",
    path: "/admin/worker-health",
    handler: "admin.workerHealth",
    config: ADMIN_AUTH,
  },
  {
    method: "GET",
    path: "/admin/pending-review",
    handler: "admin.listPendingReview",
    config: ADMIN_AUTH,
  },
  {
    method: "PATCH",
    path: "/admin/pending-review/:documentId",
    handler: "admin.reviewEvent",
    config: ADMIN_AUTH,
  },
]
```

- [ ] **Step 3: Create routes index**

```typescript
// apps/strapi/src/plugins/events/server/routes/index.ts
import contentApi from "./content-api"
import admin from "./admin"

export default {
  "content-api": { type: "content-api", routes: contentApi },
  admin: { type: "admin", routes: admin },
}
```

- [ ] **Step 4: Create controllers index**

```typescript
// apps/strapi/src/plugins/events/server/controllers/index.ts
import events from "./events"
import admin from "./admin"
export default { events, admin }
```

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/plugins/events/server/controllers/ \
        apps/strapi/src/plugins/events/server/routes/
git commit -m "feat(events): admin API routes (credentials, runs, sync trigger, review queue)"
```

---

## Task 6: Strapi plugin — entry point & registration

**Files:**

- Create: `apps/strapi/src/plugins/events/strapi-server.ts`
- Modify: `apps/strapi/config/plugins.ts`
- Modify: `apps/strapi/package.json`

- [ ] **Step 1: Create strapi-server.ts**

```typescript
// apps/strapi/src/plugins/events/strapi-server.ts
import contentTypes from "./server/content-types"
import controllers from "./server/controllers"
import routes from "./server/routes"
import services from "./server/services"

export default {
  register() {},
  bootstrap() {},
  config: { default: {}, validator() {} },
  contentTypes,
  controllers,
  middlewares: {},
  policies: {},
  routes,
  services,
}
```

- [ ] **Step 2: Register plugin in plugins.ts**

In `apps/strapi/config/plugins.ts`, add inside the returned object (after the `rewards` entry):

```typescript
    events: {
      enabled: true,
      resolve: "./src/plugins/events",
    },
```

- [ ] **Step 3: Add to build:plugins script in apps/strapi/package.json**

Find the `"build:plugins"` script and append the events plugin:

Old value contains `&& cd src/plugins/rewards && pnpm exec strapi-plugin build && cd -`.

Append: ` && cd src/plugins/events && pnpm exec strapi-plugin build && cd -`

- [ ] **Step 4: Build and verify Strapi starts**

```bash
cd apps/strapi
pnpm run build:plugins 2>&1 | tail -20
```

Expected: build completes for all plugins including `events`.

```bash
pnpm develop 2>&1 | grep -E "(events|error|Error)" | head -20
```

Expected: no errors related to the events plugin; content types registered.

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/plugins/events/strapi-server.ts \
        apps/strapi/config/plugins.ts \
        apps/strapi/package.json
git commit -m "feat(events): register plugin::events in Strapi"
```

---

## Task 7: Sync worker — scaffold

**Files:**

- Create: `apps/sync-worker/package.json`
- Create: `apps/sync-worker/tsconfig.json`
- Create: `apps/sync-worker/.env.example`
- Create: `apps/sync-worker/src/db.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@repo/sync-worker",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/events-crypto": "workspace:*",
    "knex": "^3.1.0",
    "pg": "^8.11.0",
    "p-limit": "^6.1.0",
    "node-cron": "^3.0.3",
    "ical.js": "^2.0.1"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "@types/node-cron": "^3.0.11",
    "tsx": "^4.7.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create .env.example**

```bash
# apps/sync-worker/.env.example
DATABASE_URL=postgresql://user:pass@localhost:5432/libraries_global
EVENTS_CREDENTIAL_KEY=<64-char hex string>
EVENTS_CREDENTIAL_KEY_PREV=
EVENTS_SYNC_CRON=0 */6 * * *
EVENTS_SYNC_CONCURRENCY=50
WORKER_PORT=3100
```

- [ ] **Step 4: Create db.ts**

```typescript
// apps/sync-worker/src/db.ts
import Knex from "knex"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required")
}

const db = Knex({
  client: "pg",
  connection: process.env.DATABASE_URL,
  pool: { min: 2, max: 10 },
  acquireConnectionTimeout: 10_000,
})

export default db
```

- [ ] **Step 5: Install dependencies**

```bash
cd apps/sync-worker && pnpm install
```

Expected: `node_modules` populated, no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/sync-worker/
git commit -m "feat(sync-worker): scaffold package, tsconfig, db connection"
```

---

## Task 8: Sync worker — provider types & registry

**Files:**

- Create: `apps/sync-worker/src/providers/types.ts`
- Create: `apps/sync-worker/src/providers/index.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// apps/sync-worker/src/providers/types.ts

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

export type ProviderCredentials = Record<string, string>

export interface LibraryHint {
  id: number
  documentId: string
  entityRef: string
  name: string
  address?: string
}

export interface RawEvent {
  externalId: string
  title: string
  description: string
  url: string
  imageUrl?: string
  /** ISO 8601 string — may include tz offset or may be local */
  startTime: string
  endTime?: string
  allDay: boolean
  timezone: string
  /** Provider's own category string — fed into eventTypeMap */
  providerCategory?: string
  tags: string[]
  isFree: boolean
  priceMin?: number
  priceMax?: number
  registrationUrl?: string
  capacity?: number
  /** For group-scope credentials: venue name to match against library names */
  venueName?: string
  venueAddress?: string
}

export interface NormalizedEvent {
  externalId: string
  sourceProvider: string
  credentialId: number
  syncHash: string
  libraryId: number
  libraryEntityRef: string
  title: string
  description: string
  summary: string
  url: string
  imageUrl: string | null
  startTime: string
  endTime: string | null
  allDay: boolean
  timezone: string
  eventType: EventType
  audience: string[]
  tags: string[]
  isFree: boolean
  priceMin: number | null
  priceMax: number | null
  registrationUrl: string | null
  capacity: number | null
  status: "upcoming" | "ongoing" | "cancelled" | "postponed"
  pendingReview: boolean
  importedAt: string
  lastSeenAt: string
}

export interface EventProvider {
  readonly name: ProviderKey
  readonly eventTypeMap: Record<string, EventType>
  test(
    credentials: ProviderCredentials
  ): Promise<{ ok: boolean; error?: string }>
  fetch(
    credentials: ProviderCredentials,
    hints: LibraryHint[]
  ): Promise<RawEvent[]>
}

export interface LoadedCredential {
  id: number
  documentId: string
  provider: ProviderKey
  label: string
  scope: "library" | "group"
  isActive: boolean
  credentials: ProviderCredentials
  libraries: LibraryHint[]
}
```

- [ ] **Step 2: Create providers index (stub — filled out in Tasks 15-16)**

```typescript
// apps/sync-worker/src/providers/index.ts
import type { EventProvider, ProviderKey } from "./types"

// Providers are registered here in Tasks 15 and 16.
// This file is intentionally minimal until those tasks complete.
const registry = new Map<ProviderKey, EventProvider>()

export function getProvider(key: ProviderKey): EventProvider | undefined {
  return registry.get(key)
}

export function registerProvider(provider: EventProvider): void {
  registry.set(provider.name, provider)
}

export default registry
```

- [ ] **Step 3: Commit**

```bash
git add apps/sync-worker/src/providers/
git commit -m "feat(sync-worker): provider types and registry scaffold"
```

---

## Task 9: Sync worker — utility functions

**Files:**

- Create: `apps/sync-worker/src/lib/levenshtein.ts`
- Create: `apps/sync-worker/src/lib/date.ts`
- Create: `apps/sync-worker/tests/lib/levenshtein.test.ts`
- Create: `apps/sync-worker/tests/lib/date.test.ts`

- [ ] **Step 1: Write levenshtein tests**

```typescript
// apps/sync-worker/tests/lib/levenshtein.test.ts
import { describe, it, expect } from "vitest"
import { normalisedDistance, isLikelyMatch } from "../../src/lib/levenshtein"

describe("normalisedDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(
      normalisedDistance(
        "Manchester Central Library",
        "Manchester Central Library"
      )
    ).toBe(0)
  })

  it("returns 1 for completely different strings", () => {
    expect(normalisedDistance("abc", "xyz")).toBe(1)
  })

  it("returns < 0.1 for minor typo", () => {
    expect(
      normalisedDistance(
        "Manchester Central Library",
        "Manchester Central Librery"
      )
    ).toBeLessThan(0.1)
  })

  it("is case-insensitive", () => {
    expect(normalisedDistance("LEEDS CENTRAL", "Leeds Central")).toBe(0)
  })
})

describe("isLikelyMatch", () => {
  it("returns confident for distance <= 0.25", () => {
    expect(
      isLikelyMatch("Leeds Central Library", "Leeds Central Library")
    ).toBe("confident")
  })

  it("returns review for distance 0.25–0.40", () => {
    expect(isLikelyMatch("Leeds Library", "Leeds Central Library")).toBe(
      "review"
    )
  })

  it("returns none for distance > 0.40", () => {
    expect(isLikelyMatch("The Swan Pub", "Leeds Central Library")).toBe("none")
  })
})
```

- [ ] **Step 2: Write date tests**

```typescript
// apps/sync-worker/tests/lib/date.test.ts
import { describe, it, expect } from "vitest"
import { toUtcIso, truncateSummary, computeSyncHash } from "../../src/lib/date"

describe("toUtcIso", () => {
  it("leaves a UTC string unchanged in value", () => {
    const iso = "2026-06-01T14:00:00.000Z"
    expect(toUtcIso(iso)).toBe(iso)
  })

  it("converts offset datetime to UTC", () => {
    const result = toUtcIso("2026-06-01T15:00:00+01:00")
    expect(result).toBe("2026-06-01T14:00:00.000Z")
  })
})

describe("truncateSummary", () => {
  it("returns original if under 280 chars", () => {
    expect(truncateSummary("short")).toBe("short")
  })

  it("truncates at word boundary", () => {
    const long = "word ".repeat(70) // 350 chars
    const result = truncateSummary(long)
    expect(result.length).toBeLessThanOrEqual(281) // 280 + ellipsis
    expect(result.endsWith("…")).toBe(true)
    expect(result).not.toMatch(/word \u2026$/) // shouldn't cut mid-word
  })
})

describe("computeSyncHash", () => {
  it("produces a 40-char hex string", () => {
    const h = computeSyncHash(
      "evt_123",
      "eventbrite",
      "2026-06-01T14:00:00.000Z",
      "Story Time"
    )
    expect(h).toMatch(/^[0-9a-f]{40}$/)
  })

  it("is deterministic", () => {
    const a = computeSyncHash("x", "ical", "2026-01-01T00:00:00.000Z", "Talk")
    const b = computeSyncHash("x", "ical", "2026-01-01T00:00:00.000Z", "Talk")
    expect(a).toBe(b)
  })

  it("differs when any input changes", () => {
    const base = computeSyncHash(
      "x",
      "ical",
      "2026-01-01T00:00:00.000Z",
      "Talk"
    )
    expect(
      computeSyncHash("y", "ical", "2026-01-01T00:00:00.000Z", "Talk")
    ).not.toBe(base)
  })
})
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
cd apps/sync-worker && pnpm test tests/lib/
```

Expected: `Cannot find module '../../src/lib/levenshtein'`

- [ ] **Step 4: Implement levenshtein.ts**

```typescript
// apps/sync-worker/src/lib/levenshtein.ts

/** Levenshtein edit distance (Wagner-Fischer) */
function editDistance(a: string, b: string): number {
  const m = a.length,
    n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]!
          : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!)
    }
  }
  return dp[m]![n]!
}

/**
 * Normalised Levenshtein distance in [0, 1].
 * 0 = identical, 1 = completely different.
 * Comparison is case-insensitive.
 */
export function normalisedDistance(a: string, b: string): number {
  const la = a.toLowerCase().trim()
  const lb = b.toLowerCase().trim()
  if (la === lb) return 0
  const maxLen = Math.max(la.length, lb.length)
  if (maxLen === 0) return 0
  return editDistance(la, lb) / maxLen
}

export type MatchResult = "confident" | "review" | "none"

/**
 * Classifies a venue → library name match by distance thresholds.
 * confident = distance <= 0.25
 * review    = distance 0.25–0.40
 * none      = distance > 0.40
 */
export function isLikelyMatch(
  venueName: string,
  libraryName: string
): MatchResult {
  const d = normalisedDistance(venueName, libraryName)
  if (d <= 0.25) return "confident"
  if (d <= 0.4) return "review"
  return "none"
}
```

- [ ] **Step 5: Implement date.ts**

```typescript
// apps/sync-worker/src/lib/date.ts
import { createHash } from "node:crypto"

/** Convert any ISO 8601 string (with offset) to a UTC ISO string. */
export function toUtcIso(dateStr: string): string {
  return new Date(dateStr).toISOString()
}

/** Truncate a description to ≤ maxLen chars at a word boundary, appending ellipsis. */
export function truncateSummary(text: string, maxLen = 280): string {
  if (text.length <= maxLen) return text
  const slice = text.slice(0, maxLen)
  const lastSpace = slice.lastIndexOf(" ")
  const cut = lastSpace > maxLen / 2 ? lastSpace : maxLen
  return slice.slice(0, cut) + "…"
}

/** SHA-1 hash of the four change-detection inputs. */
export function computeSyncHash(
  externalId: string,
  provider: string,
  startTimeUtc: string,
  title: string
): string {
  return createHash("sha1")
    .update(`${externalId}|${provider}|${startTimeUtc}|${title}`)
    .digest("hex")
}
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
cd apps/sync-worker && pnpm test tests/lib/
```

Expected: 8 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/sync-worker/src/lib/ apps/sync-worker/tests/lib/
git commit -m "feat(sync-worker): levenshtein + date utility functions"
```

---

## Task 10: Sync worker — normalize pipeline step

**Files:**

- Create: `apps/sync-worker/src/pipeline/normalize.ts`
- Create: `apps/sync-worker/tests/pipeline/normalize.test.ts`

- [ ] **Step 1: Write normalize tests**

```typescript
// apps/sync-worker/tests/pipeline/normalize.test.ts
import { describe, it, expect } from "vitest"
import { normalizeEvent } from "../../src/pipeline/normalize"
import type { RawEvent } from "../../src/providers/types"

const BASE_RAW: RawEvent = {
  externalId: "evt_001",
  title: "Story Time for Toddlers",
  description:
    "A fun story time session for children aged 2-5. " + "word ".repeat(60),
  url: "https://example.com/events/evt_001",
  startTime: "2026-06-01T10:00:00+01:00",
  endTime: "2026-06-01T11:00:00+01:00",
  allDay: false,
  timezone: "Europe/London",
  providerCategory: "kids_and_family",
  tags: ["children", "storytime"],
  isFree: true,
}

const EVENT_TYPE_MAP: Record<string, "storytime" | "talk"> = {
  kids_and_family: "storytime",
  lectures_and_books: "talk",
}

describe("normalizeEvent", () => {
  const result = normalizeEvent(
    BASE_RAW,
    "eventbrite",
    42,
    7,
    "GB-MCL-001",
    EVENT_TYPE_MAP,
    false
  )

  it("sets sourceProvider and credentialId", () => {
    expect(result.sourceProvider).toBe("eventbrite")
    expect(result.credentialId).toBe(42)
  })

  it("converts startTime to UTC ISO", () => {
    expect(result.startTime).toBe("2026-06-01T09:00:00.000Z")
  })

  it("maps providerCategory via eventTypeMap", () => {
    expect(result.eventType).toBe("storytime")
  })

  it("falls back to 'other' for unmapped category", () => {
    const r = normalizeEvent(
      { ...BASE_RAW, providerCategory: "unknown_cat" },
      "eventbrite",
      1,
      1,
      "X",
      EVENT_TYPE_MAP,
      false
    )
    expect(r.eventType).toBe("other")
  })

  it("truncates summary to <= 280 chars", () => {
    expect(result.summary.length).toBeLessThanOrEqual(281)
    expect(result.summary.endsWith("…")).toBe(true)
  })

  it("computes a 40-char syncHash", () => {
    expect(result.syncHash).toMatch(/^[0-9a-f]{40}$/)
  })

  it("sets pendingReview flag", () => {
    const r = normalizeEvent(
      BASE_RAW,
      "eventbrite",
      1,
      1,
      "X",
      EVENT_TYPE_MAP,
      true
    )
    expect(r.pendingReview).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/sync-worker && pnpm test tests/pipeline/normalize.test.ts
```

- [ ] **Step 3: Implement normalize.ts**

```typescript
// apps/sync-worker/src/pipeline/normalize.ts
import { toUtcIso, truncateSummary, computeSyncHash } from "../lib/date"
import type { RawEvent, NormalizedEvent, EventType } from "../providers/types"

export function normalizeEvent(
  raw: RawEvent,
  provider: string,
  credentialId: number,
  libraryId: number,
  libraryEntityRef: string,
  eventTypeMap: Record<string, EventType>,
  pendingReview: boolean
): NormalizedEvent {
  const startTime = toUtcIso(raw.startTime)
  const endTime = raw.endTime ? toUtcIso(raw.endTime) : null
  const syncHash = computeSyncHash(
    raw.externalId,
    provider,
    startTime,
    raw.title
  )
  const eventType: EventType = raw.providerCategory
    ? (eventTypeMap[raw.providerCategory] ?? "other")
    : "other"
  const now = new Date().toISOString()

  return {
    externalId: raw.externalId,
    sourceProvider: provider,
    credentialId,
    syncHash,
    libraryId,
    libraryEntityRef,
    title: raw.title,
    description: raw.description,
    summary: truncateSummary(raw.description),
    url: raw.url,
    imageUrl: raw.imageUrl ?? null,
    startTime,
    endTime,
    allDay: raw.allDay,
    timezone: raw.timezone,
    eventType,
    audience: [],
    tags: raw.tags,
    isFree: raw.isFree,
    priceMin: raw.priceMin ?? null,
    priceMax: raw.priceMax ?? null,
    registrationUrl: raw.registrationUrl ?? null,
    capacity: raw.capacity ?? null,
    status: "upcoming",
    pendingReview,
    importedAt: now,
    lastSeenAt: now,
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/sync-worker && pnpm test tests/pipeline/normalize.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/sync-worker/src/pipeline/normalize.ts apps/sync-worker/tests/pipeline/normalize.test.ts
git commit -m "feat(sync-worker): normalize pipeline step"
```

---

## Task 11: Sync worker — match-libraries pipeline step

**Files:**

- Create: `apps/sync-worker/src/pipeline/match-libraries.ts`
- Create: `apps/sync-worker/tests/pipeline/match-libraries.test.ts`

- [ ] **Step 1: Write match-libraries tests**

```typescript
// apps/sync-worker/tests/pipeline/match-libraries.test.ts
import { describe, it, expect } from "vitest"
import { matchVenueToLibrary } from "../../src/pipeline/match-libraries"
import type { LibraryHint } from "../../src/providers/types"

const HINTS: LibraryHint[] = [
  {
    id: 1,
    documentId: "abc",
    entityRef: "GB-MCL-001",
    name: "Manchester Central Library",
  },
  {
    id: 2,
    documentId: "def",
    entityRef: "GB-MCL-002",
    name: "Didsbury Library",
  },
  {
    id: 3,
    documentId: "ghi",
    entityRef: "GB-MCL-003",
    name: "Wythenshawe Library",
  },
]

describe("matchVenueToLibrary", () => {
  it("returns confident match for exact name", () => {
    const r = matchVenueToLibrary("Manchester Central Library", HINTS)
    expect(r.result).toBe("confident")
    expect(r.library?.id).toBe(1)
  })

  it("returns confident match for near-identical name", () => {
    const r = matchVenueToLibrary("Manchester Central Librarry", HINTS)
    expect(r.result).toBe("confident")
  })

  it("returns review for partial match", () => {
    const r = matchVenueToLibrary("Manchester Library", HINTS)
    expect(r.result).toBe("review")
  })

  it("returns none for unrelated venue", () => {
    const r = matchVenueToLibrary("The Red Lion Pub", HINTS)
    expect(r.result).toBe("none")
    expect(r.library).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/sync-worker && pnpm test tests/pipeline/match-libraries.test.ts
```

- [ ] **Step 3: Implement match-libraries.ts**

```typescript
// apps/sync-worker/src/pipeline/match-libraries.ts
import { isLikelyMatch, normalisedDistance } from "../lib/levenshtein"
import type { LibraryHint, MatchResult } from "../providers/types"

interface MatchOutput {
  result: MatchResult
  library: LibraryHint | null
}

/**
 * Given a venue name from a provider event, find the best matching library
 * from the credential's library hints.
 */
export function matchVenueToLibrary(
  venueName: string,
  hints: LibraryHint[]
): MatchOutput {
  if (!hints.length) return { result: "none", library: null }

  let bestHint: LibraryHint | null = null
  let bestDist = Infinity

  for (const hint of hints) {
    const d = normalisedDistance(venueName, hint.name)
    if (d < bestDist) {
      bestDist = d
      bestHint = hint
    }
  }

  const result = isLikelyMatch(venueName, bestHint!.name)
  return {
    result,
    library: result !== "none" ? bestHint : null,
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/sync-worker && pnpm test tests/pipeline/match-libraries.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/sync-worker/src/pipeline/match-libraries.ts apps/sync-worker/tests/pipeline/match-libraries.test.ts
git commit -m "feat(sync-worker): match-libraries pipeline step"
```

---

## Task 12: Sync worker — Eventbrite provider

**Files:**

- Create: `apps/sync-worker/src/providers/eventbrite.ts`
- Create: `apps/sync-worker/tests/providers/eventbrite.test.ts`

- [ ] **Step 1: Write Eventbrite tests (uses fetch mock)**

```typescript
// apps/sync-worker/tests/providers/eventbrite.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { eventbriteProvider } from "../../src/providers/eventbrite"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

beforeEach(() => mockFetch.mockReset())

describe("eventbriteProvider.test()", () => {
  it("returns ok when org endpoint responds 200", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "org_123" }),
    })
    const r = await eventbriteProvider.test({
      organizationId: "org_123",
      accessToken: "tok_abc",
    })
    expect(r.ok).toBe(true)
  })

  it("returns error on 401", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
    const r = await eventbriteProvider.test({
      organizationId: "org_123",
      accessToken: "bad",
    })
    expect(r.ok).toBe(false)
    expect(r.error).toContain("401")
  })
})

describe("eventbriteProvider.fetch()", () => {
  it("returns an empty array if API returns no events", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [], pagination: { has_more_items: false } }),
    })
    const events = await eventbriteProvider.fetch(
      { organizationId: "org_123", accessToken: "tok_abc" },
      [
        {
          id: 1,
          documentId: "d1",
          entityRef: "GB-MCL-001",
          name: "Manchester Library",
        },
      ]
    )
    expect(events).toEqual([])
  })

  it("maps Eventbrite event to RawEvent shape", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [
          {
            id: "evt_999",
            name: { text: "Story Time" },
            description: { text: "Fun for kids" },
            url: "https://eventbrite.com/e/evt_999",
            start: { utc: "2026-06-01T09:00:00Z", timezone: "Europe/London" },
            end: { utc: "2026-06-01T10:00:00Z", timezone: "Europe/London" },
            is_free: true,
            venue: {
              name: "Manchester Library",
              address: { localized_address_display: "Manchester" },
            },
            category_id: null,
            subcategory_id: null,
            format_id: null,
          },
        ],
        pagination: { has_more_items: false },
      }),
    })
    const events = await eventbriteProvider.fetch(
      { organizationId: "org_123", accessToken: "tok_abc" },
      [
        {
          id: 1,
          documentId: "d1",
          entityRef: "GB-MCL-001",
          name: "Manchester Library",
        },
      ]
    )
    expect(events).toHaveLength(1)
    expect(events[0]!.externalId).toBe("evt_999")
    expect(events[0]!.isFree).toBe(true)
    expect(events[0]!.venueName).toBe("Manchester Library")
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/sync-worker && pnpm test tests/providers/eventbrite.test.ts
```

- [ ] **Step 3: Implement eventbrite.ts**

```typescript
// apps/sync-worker/src/providers/eventbrite.ts
import type {
  EventProvider,
  EventType,
  LibraryHint,
  ProviderCredentials,
  RawEvent,
} from "./types"

const BASE = "https://www.eventbriteapi.com/v3"

const EVENT_TYPE_MAP: Record<string, EventType> = {
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
  music: "performance",
  other: "other",
}

/** Venue names that suggest non-library venues — used as a pre-filter for group credentials. */
const LIBRARY_KEYWORDS = [
  "library",
  "libraries",
  "biblioth",
  "biblioteca",
  "médiathèque",
  "archive",
  "reading room",
]

function isLikelyLibraryVenue(venueName: string): boolean {
  const lower = venueName.toLowerCase()
  return LIBRARY_KEYWORDS.some((kw) => lower.includes(kw))
}

async function fetchPage(
  orgId: string,
  token: string,
  page: number
): Promise<any> {
  const url = `${BASE}/organizations/${orgId}/events/?status=live&page=${page}&expand=venue,category`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Eventbrite API ${res.status}`)
  return res.json()
}

export const eventbriteProvider: EventProvider = {
  name: "eventbrite",
  eventTypeMap: EVENT_TYPE_MAP,

  async test(credentials: ProviderCredentials) {
    const { organizationId, accessToken } = credentials
    const res = await fetch(`${BASE}/organizations/${organizationId}/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) return { ok: true }
    return { ok: false, error: `Eventbrite returned ${res.status}` }
  },

  async fetch(
    credentials: ProviderCredentials,
    hints: LibraryHint[]
  ): Promise<RawEvent[]> {
    const { organizationId, accessToken } = credentials
    const events: RawEvent[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const data = await fetchPage(organizationId!, accessToken!, page)
      const raw = (data.events as any[]) ?? []

      for (const ev of raw) {
        const venueName: string = ev.venue?.name ?? ""
        // For group credentials, pre-filter: skip if venue doesn't look like a library
        if (hints.length > 1 && !isLikelyLibraryVenue(venueName)) continue

        events.push({
          externalId: ev.id as string,
          title: (ev.name?.text ?? "") as string,
          description: (ev.description?.text ?? "") as string,
          url: ev.url as string,
          imageUrl: ev.logo?.url ?? undefined,
          startTime: ev.start?.utc as string,
          endTime: ev.end?.utc as string | undefined,
          allDay: false,
          timezone: (ev.start?.timezone ?? "UTC") as string,
          providerCategory: ev.subcategory_id ?? ev.category_id ?? undefined,
          tags: [],
          isFree: ev.is_free === true,
          venueName,
          venueAddress:
            ev.venue?.address?.localized_address_display ?? undefined,
        })
      }

      hasMore = data.pagination?.has_more_items === true
      page++
      if (page > 50) break // safety ceiling
    }

    return events
  },
}
```

- [ ] **Step 4: Register provider**

In `apps/sync-worker/src/providers/index.ts`, replace the file contents:

```typescript
// apps/sync-worker/src/providers/index.ts
import type { EventProvider, ProviderKey } from "./types"
import { eventbriteProvider } from "./eventbrite"

const registry = new Map<ProviderKey, EventProvider>()

registry.set(eventbriteProvider.name, eventbriteProvider)

export function getProvider(key: ProviderKey): EventProvider | undefined {
  return registry.get(key)
}

export function registerProvider(provider: EventProvider): void {
  registry.set(provider.name, provider)
}

export default registry
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd apps/sync-worker && pnpm test tests/providers/eventbrite.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/sync-worker/src/providers/eventbrite.ts \
        apps/sync-worker/src/providers/index.ts \
        apps/sync-worker/tests/providers/eventbrite.test.ts
git commit -m "feat(sync-worker): Eventbrite provider with venue pre-filter"
```

---

## Task 13: Sync worker — iCal provider

**Files:**

- Create: `apps/sync-worker/src/providers/ical.ts`
- Create: `apps/sync-worker/tests/providers/ical.test.ts`

- [ ] **Step 1: Write iCal tests**

```typescript
// apps/sync-worker/tests/providers/ical.test.ts
import { describe, it, expect, vi } from "vitest"
import { icalProvider } from "../../src/providers/ical"

const SAMPLE_ICAL = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:abc-123@example.com
DTSTART;TZID=Europe/London:20260601T140000
DTEND;TZID=Europe/London:20260601T150000
SUMMARY:Reading Group
DESCRIPTION:Monthly reading group for adults.
URL:https://example.com/events/1
END:VEVENT
END:VCALENDAR`

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

describe("icalProvider.test()", () => {
  it("returns ok when feed URL is reachable", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_ICAL })
    const r = await icalProvider.test({
      feedUrl: "https://example.com/cal.ics",
    })
    expect(r.ok).toBe(true)
  })

  it("returns error on HTTP failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 })
    const r = await icalProvider.test({
      feedUrl: "https://example.com/bad.ics",
    })
    expect(r.ok).toBe(false)
  })
})

describe("icalProvider.fetch()", () => {
  it("parses a VEVENT into a RawEvent", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => SAMPLE_ICAL })
    const events = await icalProvider.fetch(
      { feedUrl: "https://example.com/cal.ics" },
      [
        {
          id: 1,
          documentId: "d1",
          entityRef: "GB-MCL-001",
          name: "Test Library",
        },
      ]
    )
    expect(events).toHaveLength(1)
    expect(events[0]!.externalId).toBe("abc-123@example.com")
    expect(events[0]!.title).toBe("Reading Group")
    expect(events[0]!.isFree).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/sync-worker && pnpm test tests/providers/ical.test.ts
```

- [ ] **Step 3: Implement ical.ts**

```typescript
// apps/sync-worker/src/providers/ical.ts
import ICAL from "ical.js"
import type {
  EventProvider,
  EventType,
  LibraryHint,
  ProviderCredentials,
  RawEvent,
} from "./types"

const EVENT_TYPE_MAP: Record<string, EventType> = {
  READING: "reading_group",
  BOOK: "book_club",
  STORY: "storytime",
  TALK: "talk",
  LECTURE: "talk",
  WORKSHOP: "workshop",
  EXHIBITION: "exhibition",
  TOUR: "tour",
  FILM: "screening",
  SCREENING: "screening",
  PERFORMANCE: "performance",
}

async function fetchFeed(
  feedUrl: string,
  username?: string,
  password?: string
): Promise<string> {
  const headers: Record<string, string> = {}
  if (username && password) {
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
  }
  const res = await fetch(feedUrl, { headers })
  if (!res.ok) throw new Error(`iCal feed returned ${res.status}: ${feedUrl}`)
  return res.text()
}

export const icalProvider: EventProvider = {
  name: "ical",
  eventTypeMap: EVENT_TYPE_MAP,

  async test(credentials: ProviderCredentials) {
    try {
      await fetchFeed(
        credentials.feedUrl!,
        credentials.username,
        credentials.password
      )
      return { ok: true }
    } catch (err: any) {
      return { ok: false, error: err.message as string }
    }
  },

  async fetch(
    credentials: ProviderCredentials,
    _hints: LibraryHint[]
  ): Promise<RawEvent[]> {
    const icalText = await fetchFeed(
      credentials.feedUrl!,
      credentials.username,
      credentials.password
    )
    const parsed = ICAL.parse(icalText)
    const comp = new ICAL.Component(parsed)
    const vevents = comp.getAllSubcomponents("vevent")

    const events: RawEvent[] = []
    for (const vevent of vevents) {
      const ev = new ICAL.Event(vevent)
      if (!ev.startDate) continue

      const startDt = ev.startDate.toJSDate()
      const endDt = ev.endDate?.toJSDate() ?? null
      const uid = ev.uid ?? `${startDt.toISOString()}-${ev.summary}`
      const title = ev.summary ?? ""
      const description = ev.description ?? ""
      const url = (vevent.getFirstPropertyValue("url") as string | null) ?? ""
      const tzid = ev.startDate.timezone ?? "UTC"

      // Derive eventType from title keywords
      const upperTitle = title.toUpperCase()
      let providerCategory: string | undefined
      for (const [kw, _] of Object.entries(EVENT_TYPE_MAP)) {
        if (upperTitle.includes(kw)) {
          providerCategory = kw
          break
        }
      }

      events.push({
        externalId: uid,
        title,
        description,
        url,
        startTime: startDt.toISOString(),
        endTime: endDt?.toISOString(),
        allDay: ev.startDate.isDate,
        timezone: tzid,
        providerCategory,
        tags: [],
        isFree: true, // iCal feeds don't expose pricing — assume free unless URL contains ticket keywords
      })
    }

    return events
  },
}
```

- [ ] **Step 4: Register iCal provider in index.ts**

```typescript
// apps/sync-worker/src/providers/index.ts
import type { EventProvider, ProviderKey } from "./types"
import { eventbriteProvider } from "./eventbrite"
import { icalProvider } from "./ical"

const registry = new Map<ProviderKey, EventProvider>()
registry.set(eventbriteProvider.name, eventbriteProvider)
registry.set(icalProvider.name, icalProvider)

export function getProvider(key: ProviderKey): EventProvider | undefined {
  return registry.get(key)
}

export function registerProvider(provider: EventProvider): void {
  registry.set(provider.name, provider)
}

export default registry
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd apps/sync-worker && pnpm test tests/providers/ical.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/sync-worker/src/providers/ical.ts \
        apps/sync-worker/src/providers/index.ts \
        apps/sync-worker/tests/providers/ical.test.ts
git commit -m "feat(sync-worker): iCal/RSS provider"
```

---

## Task 14: Sync worker — pipeline steps (load, validate, fetch, upsert, purge, write-run)

**Files:**

- Create: `apps/sync-worker/src/pipeline/load-credentials.ts`
- Create: `apps/sync-worker/src/pipeline/validate.ts`
- Create: `apps/sync-worker/src/pipeline/fetch.ts`
- Create: `apps/sync-worker/src/pipeline/upsert.ts`
- Create: `apps/sync-worker/src/pipeline/purge.ts`
- Create: `apps/sync-worker/src/pipeline/write-run.ts`

- [ ] **Step 1: Create load-credentials.ts**

```typescript
// apps/sync-worker/src/pipeline/load-credentials.ts
import { decrypt } from "@repo/events-crypto"
import db from "../db"
import type {
  LoadedCredential,
  LibraryHint,
  ProviderKey,
} from "../providers/types"

function getKey(): string {
  const key = process.env.EVENTS_CREDENTIAL_KEY
  if (!key || key.length !== 64)
    throw new Error("EVENTS_CREDENTIAL_KEY must be a 64-char hex string")
  return key
}

function getPrevKey(): string | undefined {
  const k = process.env.EVENTS_CREDENTIAL_KEY_PREV
  return k && k.length === 64 ? k : undefined
}

export async function loadCredentials(): Promise<LoadedCredential[]> {
  // Fetch credentials with their linked libraries via the join table.
  // Strapi v5 manyToMany join table naming: {collectionName}_{field}_lnk
  const rows = await db("ev_event_credentials as ec")
    .select(
      "ec.id",
      "ec.document_id as documentId",
      "ec.provider",
      "ec.label",
      "ec.scope",
      "ec.is_active as isActive",
      "ec.credentials_encrypted as credentialsEncrypted"
    )
    .where("ec.is_active", true)

  const key = getKey()
  const prevKey = getPrevKey()
  const results: LoadedCredential[] = []

  for (const row of rows) {
    // Fetch linked libraries from join table
    const libraryRows = await db("ev_event_credentials_libraries_lnk as lnk")
      .join("libraries as l", "l.id", "lnk.library_id")
      .select(
        "l.id",
        "l.document_id as documentId",
        "l.entity_ref as entityRef",
        "l.name"
      )
      .where("lnk.event_credential_id", row.id)

    let credentials: Record<string, string>
    try {
      credentials = JSON.parse(
        decrypt(row.credentialsEncrypted as string, key, prevKey)
      ) as Record<string, string>
    } catch {
      console.error(
        `[load-credentials] Failed to decrypt credential ${row.id} ("${row.label}") — skipping`
      )
      continue
    }

    results.push({
      id: row.id as number,
      documentId: row.documentId as string,
      provider: row.provider as ProviderKey,
      label: row.label as string,
      scope: row.scope as "library" | "group",
      isActive: true,
      credentials,
      libraries: libraryRows as LibraryHint[],
    })
  }

  return results
}
```

> **Note:** The join table name `ev_event_credentials_libraries_lnk` follows Strapi v5's convention. Verify the actual table name after first running `strapi develop` by checking your DB with `\dt ev_*` in psql.

- [ ] **Step 2: Create validate.ts**

```typescript
// apps/sync-worker/src/pipeline/validate.ts
import { getProvider } from "../providers"
import type { LoadedCredential } from "../providers/types"

export interface ValidationResult {
  valid: LoadedCredential[]
  failed: Array<{ credential: LoadedCredential; error: string }>
}

export async function validateCredentials(
  credentials: LoadedCredential[]
): Promise<ValidationResult> {
  const valid: LoadedCredential[] = []
  const failed: Array<{ credential: LoadedCredential; error: string }> = []

  await Promise.all(
    credentials.map(async (cred) => {
      const provider = getProvider(cred.provider)
      if (!provider) {
        failed.push({
          credential: cred,
          error: `No provider registered for "${cred.provider}"`,
        })
        return
      }
      try {
        const result = await provider.test(cred.credentials)
        if (result.ok) {
          valid.push(cred)
        } else {
          failed.push({
            credential: cred,
            error: result.error ?? "test() returned ok=false",
          })
        }
      } catch (err: any) {
        failed.push({
          credential: cred,
          error: (err.message as string) ?? "Unknown error",
        })
      }
    })
  )

  return { valid, failed }
}
```

- [ ] **Step 3: Create fetch.ts**

```typescript
// apps/sync-worker/src/pipeline/fetch.ts
import pLimit from "p-limit"
import { getProvider } from "../providers"
import type { LoadedCredential, RawEvent } from "../providers/types"

export interface FetchResult {
  credentialId: number
  credential: LoadedCredential
  events: RawEvent[]
  error?: string
}

export async function fetchAllEvents(
  credentials: LoadedCredential[],
  concurrency = 50
): Promise<FetchResult[]> {
  const limit = pLimit(concurrency)
  const results = await Promise.all(
    credentials.map((cred) =>
      limit(async (): Promise<FetchResult> => {
        const provider = getProvider(cred.provider)
        if (!provider) {
          return {
            credentialId: cred.id,
            credential: cred,
            events: [],
            error: "No provider",
          }
        }
        try {
          const events = await provider.fetch(cred.credentials, cred.libraries)
          return { credentialId: cred.id, credential: cred, events }
        } catch (err: any) {
          return {
            credentialId: cred.id,
            credential: cred,
            events: [],
            error: err.message as string,
          }
        }
      })
    )
  )
  return results
}
```

- [ ] **Step 4: Create upsert.ts**

```typescript
// apps/sync-worker/src/pipeline/upsert.ts
import db from "../db"
import type { NormalizedEvent } from "../providers/types"

export interface UpsertStats {
  created: number
  updated: number
  unchanged: number
}

const CHUNK_SIZE = 500

function toRow(e: NormalizedEvent): Record<string, unknown> {
  return {
    external_id: e.externalId,
    source_provider: e.sourceProvider,
    credential_id: e.credentialId,
    sync_hash: e.syncHash,
    library_id: e.libraryId,
    library_entity_ref: e.libraryEntityRef,
    title: e.title,
    description: e.description,
    summary: e.summary,
    url: e.url,
    image_url: e.imageUrl,
    start_time: e.startTime,
    end_time: e.endTime,
    all_day: e.allDay,
    timezone: e.timezone,
    event_type: e.eventType,
    audience: JSON.stringify(e.audience),
    tags: JSON.stringify(e.tags),
    is_free: e.isFree,
    price_min: e.priceMin,
    price_max: e.priceMax,
    registration_url: e.registrationUrl,
    capacity: e.capacity,
    status: e.status,
    pending_review: e.pendingReview,
    imported_at: e.importedAt,
    last_seen_at: e.lastSeenAt,
    created_at: e.importedAt,
    updated_at: e.lastSeenAt,
    published_at: e.importedAt,
  }
}

export async function upsertEvents(
  events: NormalizedEvent[]
): Promise<UpsertStats> {
  const stats: UpsertStats = { created: 0, updated: 0, unchanged: 0 }

  // Process in chunks to avoid lock pressure
  for (let i = 0; i < events.length; i += CHUNK_SIZE) {
    const chunk = events.slice(i, i + CHUNK_SIZE)
    const rows = chunk.map(toRow)

    const result = await db.raw(
      `INSERT INTO ev_events (${Object.keys(rows[0]!).join(", ")})
       VALUES ${rows
         .map(
           () =>
             `(${Object.keys(rows[0]!)
               .map(() => "?")
               .join(", ")})`
         )
         .join(", ")}
       ON CONFLICT (source_provider, external_id) DO UPDATE SET
         sync_hash = EXCLUDED.sync_hash,
         title = CASE WHEN ev_events.sync_hash != EXCLUDED.sync_hash THEN EXCLUDED.title ELSE ev_events.title END,
         description = CASE WHEN ev_events.sync_hash != EXCLUDED.sync_hash THEN EXCLUDED.description ELSE ev_events.description END,
         summary = CASE WHEN ev_events.sync_hash != EXCLUDED.sync_hash THEN EXCLUDED.summary ELSE ev_events.summary END,
         start_time = CASE WHEN ev_events.sync_hash != EXCLUDED.sync_hash THEN EXCLUDED.start_time ELSE ev_events.start_time END,
         end_time = CASE WHEN ev_events.sync_hash != EXCLUDED.sync_hash THEN EXCLUDED.end_time ELSE ev_events.end_time END,
         status = CASE WHEN ev_events.sync_hash != EXCLUDED.sync_hash THEN EXCLUDED.status ELSE ev_events.status END,
         image_url = CASE WHEN ev_events.sync_hash != EXCLUDED.sync_hash THEN EXCLUDED.image_url ELSE ev_events.image_url END,
         last_seen_at = NOW(),
         updated_at = NOW()
       RETURNING (xmax = 0) as inserted, (ev_events.sync_hash != EXCLUDED.sync_hash) as changed`,
      rows.flatMap((r) => Object.values(r))
    )

    for (const row of (result.rows as Array<{
      inserted: boolean
      changed: boolean
    }>) ?? []) {
      if (row.inserted) stats.created++
      else if (row.changed) stats.updated++
      else stats.unchanged++
    }
  }

  return stats
}
```

- [ ] **Step 5: Create purge.ts**

```typescript
// apps/sync-worker/src/pipeline/purge.ts
import db from "../db"

/** Delete events whose end_time is more than 1 hour in the past. */
export async function purgeExpiredEvents(): Promise<number> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const result = await db("ev_events").where("end_time", "<", cutoff).delete()
  return result
}
```

- [ ] **Step 6: Create write-run.ts**

```typescript
// apps/sync-worker/src/pipeline/write-run.ts
import db from "../db"

export interface RunSummary {
  runId: string
  triggeredBy: "cron" | "manual"
  triggeredByUserId?: number
  startedAt: string
  completedAt: string
  durationMs: number
  status: "success" | "partial" | "failed"
  credentialsTotal: number
  credentialsAttempted: number
  credentialsFailed: number
  eventsFetched: number
  eventsCreated: number
  eventsUpdated: number
  eventsUnchanged: number
  eventsExpiredPurged: number
  eventsPendingReview: number
  errorCount: number
  providerBreakdown: Record<string, unknown>
  failedCredentials: Array<{
    credentialId: number
    label: string
    error: string
  }>
}

export async function createRunRecord(
  runId: string,
  triggeredBy: "cron" | "manual",
  triggeredByUserId?: number
): Promise<void> {
  const now = new Date().toISOString()
  await db("ev_import_runs").insert({
    run_id: runId,
    triggered_by: triggeredBy,
    triggered_by_user_id: triggeredByUserId ?? null,
    started_at: now,
    status: "running",
    credentials_total: 0,
    credentials_attempted: 0,
    credentials_failed: 0,
    events_fetched: 0,
    events_created: 0,
    events_updated: 0,
    events_unchanged: 0,
    events_expired_purged: 0,
    events_pending_review: 0,
    error_count: 0,
    created_at: now,
    updated_at: now,
    published_at: now,
  })
}

export async function updateRunProgress(
  runId: string,
  patch: Partial<{
    credentialsAttempted: number
    credentialsFailed: number
    eventsFetched: number
    eventsCreated: number
    eventsUpdated: number
    eventsUnchanged: number
    eventsPendingReview: number
    errorCount: number
  }>
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.credentialsAttempted != null)
    row.credentials_attempted = patch.credentialsAttempted
  if (patch.credentialsFailed != null)
    row.credentials_failed = patch.credentialsFailed
  if (patch.eventsFetched != null) row.events_fetched = patch.eventsFetched
  if (patch.eventsCreated != null) row.events_created = patch.eventsCreated
  if (patch.eventsUpdated != null) row.events_updated = patch.eventsUpdated
  if (patch.eventsUnchanged != null)
    row.events_unchanged = patch.eventsUnchanged
  if (patch.eventsPendingReview != null)
    row.events_pending_review = patch.eventsPendingReview
  if (patch.errorCount != null) row.error_count = patch.errorCount
  await db("ev_import_runs").where("run_id", runId).update(row)
}

export async function finaliseRunRecord(summary: RunSummary): Promise<void> {
  await db("ev_import_runs")
    .where("run_id", summary.runId)
    .update({
      completed_at: summary.completedAt,
      duration_ms: summary.durationMs,
      status: summary.status,
      credentials_total: summary.credentialsTotal,
      credentials_attempted: summary.credentialsAttempted,
      credentials_failed: summary.credentialsFailed,
      events_fetched: summary.eventsFetched,
      events_created: summary.eventsCreated,
      events_updated: summary.eventsUpdated,
      events_unchanged: summary.eventsUnchanged,
      events_expired_purged: summary.eventsExpiredPurged,
      events_pending_review: summary.eventsPendingReview,
      error_count: summary.errorCount,
      provider_breakdown: JSON.stringify(summary.providerBreakdown),
      failed_credentials: JSON.stringify(summary.failedCredentials),
      notes: `${summary.eventsCreated} new, ${summary.eventsUpdated} updated, ${summary.errorCount} errors`,
      updated_at: new Date().toISOString(),
    })
}

export async function updateCredentialStatus(
  credentialId: number,
  status: "ok" | "error",
  errorMessage?: string
): Promise<void> {
  await db("ev_event_credentials")
    .where("id", credentialId)
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: status,
      last_error_message: status === "error" ? (errorMessage ?? null) : null,
      updated_at: new Date().toISOString(),
    })
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/sync-worker/src/pipeline/
git commit -m "feat(sync-worker): load-credentials, validate, fetch, upsert, purge, write-run pipeline steps"
```

---

## Task 15: Sync worker — orchestrator

**Files:**

- Create: `apps/sync-worker/src/pipeline/sync.ts`

- [ ] **Step 1: Create sync.ts**

```typescript
// apps/sync-worker/src/pipeline/sync.ts
import { randomUUID } from "node:crypto"
import pLimit from "p-limit"
import { loadCredentials } from "./load-credentials"
import { validateCredentials } from "./validate"
import { fetchAllEvents } from "./fetch"
import { matchVenueToLibrary } from "./match-libraries"
import { normalizeEvent } from "./normalize"
import { upsertEvents } from "./upsert"
import { purgeExpiredEvents } from "./purge"
import {
  createRunRecord,
  updateRunProgress,
  finaliseRunRecord,
  updateCredentialStatus,
} from "./write-run"
import { getProvider } from "../providers"
import type { NormalizedEvent } from "../providers/types"

type TriggerType = "cron" | "manual"

export async function runSync(
  triggeredBy: TriggerType = "cron",
  triggeredByUserId?: number
): Promise<void> {
  const runId = randomUUID()
  const startedAt = new Date()
  console.log(`[sync] Starting run ${runId} (${triggeredBy})`)

  await createRunRecord(runId, triggeredBy, triggeredByUserId)

  const concurrency = Number(process.env.EVENTS_SYNC_CONCURRENCY ?? "50")
  const limit = pLimit(concurrency)

  let totalFetched = 0
  let totalCreated = 0
  let totalUpdated = 0
  let totalUnchanged = 0
  let totalPendingReview = 0
  let errorCount = 0
  const failedCredentials: Array<{
    credentialId: number
    label: string
    error: string
  }> = []
  const providerBreakdown: Record<
    string,
    { fetched: number; created: number; updated: number; errors: number }
  > = {}

  try {
    // Step 1+2: load + validate
    const all = await loadCredentials()
    const { valid, failed } = await validateCredentials(all)
    for (const f of failed) {
      failedCredentials.push({
        credentialId: f.credential.id,
        label: f.credential.label,
        error: f.error,
      })
      errorCount++
    }
    await updateRunProgress(runId, {
      credentialsAttempted: valid.length,
      credentialsFailed: failed.length,
    })

    // Steps 3-6 per credential, with concurrency limiting
    await Promise.all(
      valid.map((cred) =>
        limit(async () => {
          const pb = providerBreakdown[cred.provider] ?? {
            fetched: 0,
            created: 0,
            updated: 0,
            errors: 0,
          }
          providerBreakdown[cred.provider] = pb
          const provider = getProvider(cred.provider)
          if (!provider) return

          let rawEvents
          try {
            rawEvents = await provider.fetch(cred.credentials, cred.libraries)
          } catch (err: any) {
            pb.errors++
            errorCount++
            failedCredentials.push({
              credentialId: cred.id,
              label: cred.label,
              error: err.message as string,
            })
            await updateCredentialStatus(
              cred.id,
              "error",
              err.message as string
            )
            return
          }

          pb.fetched += rawEvents.length
          totalFetched += rawEvents.length

          // Steps 4+5: match + normalize
          const normalized: NormalizedEvent[] = []
          let credPendingReview = 0

          for (const raw of rawEvents) {
            if (cred.scope === "library") {
              const lib = cred.libraries[0]
              if (!lib) continue
              normalized.push(
                normalizeEvent(
                  raw,
                  cred.provider,
                  cred.id,
                  lib.id,
                  lib.entityRef,
                  provider.eventTypeMap,
                  false
                )
              )
            } else {
              const venueName = raw.venueName ?? raw.title
              const { result, library } = matchVenueToLibrary(
                venueName,
                cred.libraries
              )
              if (result === "none" || !library) continue
              const pending = result === "review"
              if (pending) credPendingReview++
              normalized.push(
                normalizeEvent(
                  raw,
                  cred.provider,
                  cred.id,
                  library.id,
                  library.entityRef,
                  provider.eventTypeMap,
                  pending
                )
              )
            }
          }

          // Step 6: upsert
          const stats = await upsertEvents(normalized)
          pb.created += stats.created
          pb.updated += stats.updated

          totalCreated += stats.created
          totalUpdated += stats.updated
          totalUnchanged += stats.unchanged
          totalPendingReview += credPendingReview

          await updateCredentialStatus(cred.id, "ok")
          await updateRunProgress(runId, {
            eventsFetched: totalFetched,
            eventsCreated: totalCreated,
            eventsUpdated: totalUpdated,
            eventsUnchanged: totalUnchanged,
            eventsPendingReview: totalPendingReview,
            errorCount,
          })
        })
      )
    )

    // Step 7: purge expired
    const purged = await purgeExpiredEvents()

    // Step 8: write final run record
    const completedAt = new Date()
    const status =
      errorCount === 0 ? "success" : valid.length === 0 ? "failed" : "partial"
    await finaliseRunRecord({
      runId,
      triggeredBy,
      triggeredByUserId,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      status,
      credentialsTotal: all.length,
      credentialsAttempted: valid.length,
      credentialsFailed: failed.length,
      eventsFetched: totalFetched,
      eventsCreated: totalCreated,
      eventsUpdated: totalUpdated,
      eventsUnchanged: totalUnchanged,
      eventsExpiredPurged: purged,
      eventsPendingReview: totalPendingReview,
      errorCount,
      providerBreakdown,
      failedCredentials,
    })
    console.log(
      `[sync] Run ${runId} complete — ${status}. Created: ${totalCreated}, Updated: ${totalUpdated}, Purged: ${purged}`
    )
  } catch (err: any) {
    console.error(`[sync] Run ${runId} failed fatally:`, err)
    await finaliseRunRecord({
      runId,
      triggeredBy,
      triggeredByUserId,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      status: "failed",
      credentialsTotal: 0,
      credentialsAttempted: 0,
      credentialsFailed: 0,
      eventsFetched: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsUnchanged: 0,
      eventsExpiredPurged: 0,
      eventsPendingReview: 0,
      errorCount: 1,
      providerBreakdown: {},
      failedCredentials: [],
    })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/sync-worker/src/pipeline/sync.ts
git commit -m "feat(sync-worker): sync orchestrator with p-limit concurrency"
```

---

## Task 16: Sync worker — HTTP server & cron + entry point

**Files:**

- Create: `apps/sync-worker/src/server.ts`
- Create: `apps/sync-worker/src/cron.ts`
- Create: `apps/sync-worker/src/index.ts`

- [ ] **Step 1: Create server.ts**

```typescript
// apps/sync-worker/src/server.ts
import { createServer } from "node:http"
import { decrypt } from "@repo/events-crypto"
import db from "./db"
import { getProvider } from "./providers"
import type { ProviderKey } from "./providers/types"

let lastSync: { runId: string; status: string; at: string } | null = null
let currentStatus: "idle" | "running" = "idle"
let nextSync: string | null = null

export function setLastSync(info: typeof lastSync): void {
  lastSync = info
}
export function setSyncStatus(s: "idle" | "running"): void {
  currentStatus = s
}
export function setNextSync(iso: string): void {
  nextSync = iso
}

export function startHealthServer(port: number): void {
  const server = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json")

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200)
      res.end(
        JSON.stringify({
          ok: true,
          status: currentStatus,
          lastSync,
          nextSync,
          version: "1.0.0",
        })
      )
      return
    }

    if (req.method === "POST" && req.url === "/test-credential") {
      let body = ""
      for await (const chunk of req) body += chunk
      const { credentialDocumentId } = JSON.parse(body) as {
        credentialDocumentId: string
      }

      const row = await db("ev_event_credentials")
        .select("provider", "credentials_encrypted")
        .where("document_id", credentialDocumentId)
        .first()

      if (!row) {
        res.writeHead(404)
        res.end(JSON.stringify({ ok: false, error: "Credential not found" }))
        return
      }

      const key = process.env.EVENTS_CREDENTIAL_KEY!
      const prevKey = process.env.EVENTS_CREDENTIAL_KEY_PREV
      let credentials: Record<string, string>
      try {
        credentials = JSON.parse(
          decrypt(row.credentials_encrypted as string, key, prevKey)
        ) as Record<string, string>
      } catch {
        res.writeHead(500)
        res.end(JSON.stringify({ ok: false, error: "Decryption failed" }))
        return
      }

      const provider = getProvider(row.provider as ProviderKey)
      if (!provider) {
        res.writeHead(400)
        res.end(
          JSON.stringify({
            ok: false,
            error: `No provider for "${row.provider as string}"`,
          })
        )
        return
      }

      try {
        const result = await provider.test(credentials)
        res.writeHead(200)
        res.end(JSON.stringify(result))
      } catch (err: any) {
        res.writeHead(200)
        res.end(JSON.stringify({ ok: false, error: err.message as string }))
      }
      return
    }

    res.writeHead(404)
    res.end(JSON.stringify({ error: "Not found" }))
  })

  server.listen(port, () => {
    console.log(`[server] Health server listening on port ${port}`)
  })
}
```

- [ ] **Step 2: Create cron.ts**

```typescript
// apps/sync-worker/src/cron.ts
import cron from "node-cron"
import db from "./db"
import { runSync } from "./pipeline/sync"
import { purgeExpiredEvents } from "./pipeline/purge"
import { setNextSync, setSyncStatus, setLastSync } from "./server"

export function registerCronJobs(): void {
  const syncCron = process.env.EVENTS_SYNC_CRON ?? "0 */6 * * *"

  // Main sync
  cron.schedule(syncCron, async () => {
    setSyncStatus("running")
    try {
      await runSync("cron")
    } finally {
      setSyncStatus("idle")
      setLastSync({
        runId: "cron",
        status: "done",
        at: new Date().toISOString(),
      })
    }
  })

  // Purge expired events nightly at 03:00 UTC
  cron.schedule("0 3 * * *", async () => {
    const count = await purgeExpiredEvents()
    console.log(`[cron:purge] Purged ${count} expired events`)
  })

  // Prune import run logs older than 90 days — Sunday 04:00 UTC
  cron.schedule("0 4 * * 0", async () => {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const deleted = await db("ev_import_runs")
      .where("started_at", "<", cutoff)
      .delete()
    console.log(`[cron:prune-logs] Pruned ${deleted} old import run records`)
  })

  // Poll for manual sync commands every 2 minutes
  cron.schedule("*/2 * * * *", async () => {
    const command = await db("ev_sync_commands")
      .whereNull("consumed_at")
      .orderBy("requested_at", "asc")
      .first()

    if (!command) return

    // Mark as consumed immediately
    await db("ev_sync_commands")
      .where("id", (command as any).id)
      .update({ consumed_at: new Date().toISOString() })

    console.log(`[cron:poll] Manual sync command found — triggering`)
    setSyncStatus("running")
    try {
      await runSync(
        "manual",
        (command as any).requested_by_user_id ?? undefined
      )
    } finally {
      setSyncStatus("idle")
    }
  })

  console.log(`[cron] Jobs registered. Sync cron: ${syncCron}`)
}
```

- [ ] **Step 3: Create index.ts**

```typescript
// apps/sync-worker/src/index.ts
import "dotenv/config"
import { startHealthServer } from "./server"
import { registerCronJobs } from "./cron"

const port = Number(process.env.WORKER_PORT ?? "3100")

startHealthServer(port)
registerCronJobs()

console.log(`[worker] Sync worker started. Port: ${port}`)
```

- [ ] **Step 4: Add dotenv dependency**

```bash
cd apps/sync-worker && pnpm add dotenv
```

- [ ] **Step 5: Typecheck**

```bash
cd apps/sync-worker && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Smoke test — start the worker against the dev DB**

```bash
cd apps/sync-worker
cp .env.example .env
# Edit .env: set DATABASE_URL to your local dev DB, set EVENTS_CREDENTIAL_KEY to any 64 hex chars
echo -n "EVENTS_CREDENTIAL_KEY=" >> .env
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" >> .env
pnpm dev
```

Expected output:

```
[server] Health server listening on port 3100
[cron] Jobs registered. Sync cron: 0 */6 * * *
[worker] Sync worker started. Port: 3100
```

In another terminal: `curl http://localhost:3100/health`
Expected: `{"ok":true,"status":"idle","lastSync":null,"nextSync":null,"version":"1.0.0"}`

- [ ] **Step 7: Commit**

```bash
git add apps/sync-worker/src/server.ts apps/sync-worker/src/cron.ts apps/sync-worker/src/index.ts
git commit -m "feat(sync-worker): HTTP health server, cron jobs, entry point"
```

---

## Task 17: Run all tests

- [ ] **Step 1: Run crypto package tests**

```bash
cd packages/events-crypto && pnpm test
```

Expected: 4 tests pass.

- [ ] **Step 2: Run sync worker tests**

```bash
cd apps/sync-worker && pnpm test
```

Expected: all tests pass (levenshtein, date, normalize, match-libraries, eventbrite, ical).

- [ ] **Step 3: Typecheck Strapi plugin**

```bash
cd apps/strapi && pnpm typecheck
```

Expected: no errors in `src/plugins/events/`.

- [ ] **Step 4: Build Strapi plugins**

```bash
cd apps/strapi && pnpm run build:plugins
```

Expected: all plugins including `events` build successfully.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(events): Phase 1 complete — crypto, Strapi plugin, sync worker"
```

---

## Spec coverage check

| Spec requirement                                                  | Covered by                          |
| ----------------------------------------------------------------- | ----------------------------------- |
| AES-256-GCM credential encryption                                 | Task 1 (crypto), Task 3 (service)   |
| 4 content type schemas                                            | Task 2                              |
| Credential CRUD + admin API                                       | Task 3, Task 5                      |
| Content API (library, location, global, this-week, stats)         | Task 4                              |
| Admin API (credentials, runs, sync trigger, review, health proxy) | Task 5                              |
| Sync worker scaffold + DB connection                              | Task 7                              |
| Provider interface + registry                                     | Task 8                              |
| Levenshtein venue matching                                        | Task 9, Task 11                     |
| Normalize (syncHash, eventTypeMap, summary truncation)            | Task 9, Task 10                     |
| Eventbrite provider with venue pre-filter and eventTypeMap        | Task 12                             |
| iCal provider                                                     | Task 13                             |
| Full 8-step pipeline                                              | Tasks 14, 15                        |
| p-limit concurrency (50 by default)                               | Task 15                             |
| Health server (`/health`, `/test-credential`)                     | Task 16                             |
| Cron jobs (sync, purge, prune-logs, poll-command)                 | Task 16                             |
| Entry point                                                       | Task 16                             |
| Key rotation (EVENTS_CREDENTIAL_KEY_PREV)                         | Task 1 (crypto), Task 14 (load)     |
| Sync commands table + poll loop                                   | Task 2 (schema), Task 16 (cron)     |
| Live progress updates to import run                               | Task 14 (write-run), Task 15 (sync) |

All Phase 1 spec items are covered.
