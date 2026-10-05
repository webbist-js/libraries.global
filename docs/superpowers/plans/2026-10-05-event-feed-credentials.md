# Event Feeds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Librarians who have claimed a library connect, test and manage its event platform credentials from `/contribute/events`. Every new value is reviewed by a Moderator, and only Strapi admin users with a dedicated permission can read a value back.

**Architecture:** One provider registry in `@repo/shared-data` drives every form, validation and enum. Provider code moves into a new `@repo/event-providers` package, so Strapi can test credentials in-process and the worker syncs with the same code. The events plugin owns the credential lifecycle: feed service, routes, audit log and reveal. Content-moderation gets an `event_feed` Submission type whose apply step calls back into the events plugin. The Next app proxies feed calls with capability, claim and rate checks, and never holds the encryption key.

**Tech Stack:** Strapi v5 plugins (Document Service, `strapi.db.transaction`), `@repo/events-crypto` (AES-256-GCM with AAD), `@repo/access`, Next.js 16 App Router route handlers and RSC, Vitest, Playwright, knex in the sync worker.

**Spec:** `docs/superpowers/specs/2026-10-05-event-feed-credentials-design.md` (cited below as "spec §n").

## Global Constraints

- Strapi v5: use `strapi.documents(uid)` for content reads and writes. `strapi.db.query` is allowed only for the set-based derived writes this plan names (the `hasActiveFeed` flag, the Event `deleteMany`, the erasure rewrites).
- A credential value never appears in a Submission (`fields`, `draftData`, note), a Review Event, an API response (except the admin reveal), a log line, an error message, an email or Sentry.
- `credentialsEncrypted`, `pendingCredentialsEncrypted` and `connectedBy` are `"private": true`.
- AAD: the current value is bound to `documentId`, the pending value to `` `${documentId}:pending` ``.
- Test result codes, exactly: `ok`, `auth_failed`, `not_found`, `unreachable`, `rate_limited`, `unrecognised_format`, `provider_error`, `decrypt_failed`. Blocking at submit: `auth_failed`, `not_found`, `unrecognised_format`.
- Provider keys, exactly: `eventbrite`, `ical`, `ticketsource`, `wegottickets`, `spydus`, `solus`, `aspen`.
- Feed statuses: `draft`, `pending`, `active`, `paused`. Paused reasons: `library`, `admin`, `sync_failures`.
- Limits: per user in Next, feed writes 10 an hour and tests 20 an hour. In Strapi: 3 open `event_feed` Submissions per user, 5 feeds per library, one pending replacement per feed, and one test per feed every 30 seconds.
- Pre-launch: no redirects, no DB migration files, no backfills. Old routes are deleted. Indexes go in the events plugin's `ensure-event-indexes.ts`.
- UI: v2 tokens (`T.*`), DS components, status always as colour plus icon plus text, plain sentence-case copy, primary CTAs as indigo pills.
- Commits: no `Co-Authored-By` lines (the user's global rule). Stage only the files of the task, because another session may have uncommitted work in the tree.
- After editing `@repo/shared-data`, `@repo/access` or `@repo/event-providers`, rebuild them (`pnpm --filter <pkg> build`); both apps consume `dist/`. After changing Strapi plugin code: `pnpm --filter @repo/strapi build:plugins`.

## File map

| File                                                                                                        | Responsibility                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `packages/shared-data/event-providers.ts` (new)                                                             | Registry, test codes and copy, value validation, hint derivation, limits                          |
| `packages/event-providers/` (new package)                                                                   | Provider implementations, safe-fetch, URL redaction, error classes, `classifyFailure`, `testFeed` |
| `apps/sync-worker/src/providers/`, `src/lib/{safe-fetch,redact-url,date}.ts`                                | Moved into the package (deleted here)                                                             |
| `apps/strapi/src/plugins/events/server/content-types/event-credential/schema.json`                          | New fields (spec §6.1)                                                                            |
| `apps/strapi/src/plugins/events/server/content-types/credential-event/schema.json` (new)                    | Append-only audit (spec §6.2)                                                                     |
| `apps/strapi/src/plugins/events/server/content-types/sync-command/schema.json`                              | `credentialDocumentId`                                                                            |
| `apps/strapi/src/plugins/events/server/utils/credential-crypto.ts` (new)                                    | Slot encryption helpers                                                                           |
| `apps/strapi/src/plugins/events/server/utils/credential-events.ts` (new)                                    | `recordCredentialEvent`                                                                           |
| `apps/strapi/src/plugins/events/server/utils/feed-access.ts` (new)                                          | Claimed library ids for a Better Auth user                                                        |
| `apps/strapi/src/plugins/events/server/services/credentials.ts`                                             | Admin CRUD, flags (scale fix), test, reveal                                                       |
| `apps/strapi/src/plugins/events/server/services/feeds.ts` (new)                                             | Librarian lifecycle plus Submission decisions                                                     |
| `apps/strapi/src/plugins/events/server/services/feed-oauth.ts` (new)                                        | Eventbrite code exchange and organisation completion                                              |
| `apps/strapi/src/plugins/events/server/controllers/feeds.ts` (new)                                          | Bridge-gated feed routes                                                                          |
| `apps/strapi/src/plugins/events/server/cron.ts` (new)                                                       | Auto-pause handling and draft purge                                                               |
| `apps/strapi/scripts/events-rekey.ts` (new)                                                                 | Re-encrypt every value under the current key                                                      |
| content-moderation (`schema.json`, `submission.ts`, `moderation.ts`, `controllers/*`, `utils/*`, `admin/*`) | `event_feed` type, apply/reject, review detail, feed-test route, labels, admin panel              |
| `packages/access/src/capabilities.ts`                                                                       | `event_feed` type, queue, `canSubmit`                                                             |
| `apps/ui/src/lib/event-feed-proxy.ts` (new)                                                                 | Next to Strapi feed proxy with checks                                                             |
| `apps/ui/src/app/api/contribute/event-feeds/**` (new)                                                       | Route handlers                                                                                    |
| `apps/ui/src/app/[locale]/contribute/events/**`                                                             | Dashboard, connect, replace and organisation pages                                                |
| `apps/ui/src/components/event-feeds/**` (new)                                                               | Feed UI components                                                                                |
| `apps/ui/src/components/moderation/EventFeedPanel.tsx` (new)                                                | Site review panel                                                                                 |
| `apps/sync-worker/src/**`                                                                                   | Status-driven loading, per-feed sync, failure tracking                                            |

---

## Phase A: Registry and providers package

### Task 1: Provider registry in `@repo/shared-data`

**Files:**

- Create: `packages/shared-data/event-providers.ts`
- Modify: `packages/shared-data/index.ts` (append an export)
- Test: `apps/strapi/tests/event-providers-registry.test.ts` (shared-data has no runner; its tests live in `apps/strapi/tests`, as `gaps-registry.test.ts` does)

**Interfaces:**

- Produces:
  - `EVENT_PROVIDER_KEYS`, `type EventProviderKey`, `isEventProviderKey(v: unknown): v is EventProviderKey`
  - `FEED_TEST_CODES`, `type FeedTestCode`, `FEED_TEST_BLOCKING: ReadonlySet<FeedTestCode>`, `FEED_TEST_COPY: Record<FeedTestCode, string>`, `FEED_TEST_LABEL: Record<FeedTestCode, string>`
  - `type EventProviderField`, `type EventProviderDef`, `EVENT_PROVIDERS: Record<EventProviderKey, EventProviderDef>`
  - `type FeedValuesResult = { ok: true; values: Record<string, string> } | { ok: false; error: string; field?: string }`
  - `validateFeedValues(provider: unknown, values: unknown): FeedValuesResult`
  - `feedHints(provider: EventProviderKey, values: Record<string, string>): Record<string, string>`
  - `FEED_STATUSES`, `type FeedStatus`, `PAUSED_REASONS`, `type PausedReason`
  - `MAX_FEEDS_PER_LIBRARY = 5`, `MAX_OPEN_FEED_SUBMISSIONS = 3`, `FEED_TEST_COOLDOWN_MS = 30_000`

- [ ] **Step 1: Write the failing test**

```ts
// apps/strapi/tests/event-providers-registry.test.ts
import {
  EVENT_PROVIDER_KEYS,
  EVENT_PROVIDERS,
  FEED_TEST_BLOCKING,
  FEED_TEST_CODES,
  FEED_TEST_COPY,
  feedHints,
  isEventProviderKey,
  validateFeedValues,
} from "@repo/shared-data"
import { describe, expect, it } from "vitest"

describe("event provider registry", () => {
  it("lists exactly the seven implemented providers", () => {
    expect([...EVENT_PROVIDER_KEYS].sort()).toEqual([
      "aspen",
      "eventbrite",
      "ical",
      "solus",
      "spydus",
      "ticketsource",
      "wegottickets",
    ])
    expect(Object.keys(EVENT_PROVIDERS).sort()).toEqual(
      [...EVENT_PROVIDER_KEYS].sort()
    )
    expect(isEventProviderKey("meetup")).toBe(false)
  })

  it("names the keys the worker reads", () => {
    const keys = (p: keyof typeof EVENT_PROVIDERS) =>
      EVENT_PROVIDERS[p].fields.map((f) => f.key)
    expect(keys("eventbrite")).toEqual(["organizationId", "accessToken"])
    expect(keys("ical")).toEqual(["feedUrl", "username", "password"])
    expect(keys("ticketsource")).toEqual(["apiKey"])
    expect(keys("wegottickets")).toEqual(["feedUrl"])
    expect(keys("spydus")).toEqual([
      "endpoint",
      "customerKey",
      "username",
      "password",
      "institutionID",
      "locationCode",
    ])
    expect(keys("solus")).toEqual(["endpoint", "secretKey"])
    expect(keys("aspen")).toEqual(["endpoint", "clientId", "clientSecret"])
  })

  it("has copy for every test code and blocks only fixable ones", () => {
    for (const c of FEED_TEST_CODES) expect(FEED_TEST_COPY[c]).toBeTruthy()
    expect([...FEED_TEST_BLOCKING].sort()).toEqual([
      "auth_failed",
      "not_found",
      "unrecognised_format",
    ])
  })
})

describe("validateFeedValues", () => {
  it("accepts a complete Eventbrite value and trims it", () => {
    expect(
      validateFeedValues("eventbrite", {
        organizationId: " 123456789 ",
        accessToken: "ABCDEFGHIJKLMNOP",
      })
    ).toEqual({
      ok: true,
      values: { organizationId: "123456789", accessToken: "ABCDEFGHIJKLMNOP" },
    })
  })

  it("refuses an unknown provider, unknown keys and missing required keys", () => {
    expect(validateFeedValues("meetup", {})).toMatchObject({ ok: false })
    expect(
      validateFeedValues("ticketsource", { apiKey: "k".repeat(20), extra: "x" })
    ).toMatchObject({ ok: false, field: "extra" })
    expect(
      validateFeedValues("solus", { endpoint: "https://x.example" })
    ).toMatchObject({
      ok: false,
      field: "secretKey",
    })
  })

  it("drops empty optional fields", () => {
    expect(
      validateFeedValues("ical", {
        feedUrl: "https://lib.example/cal.ics",
        username: "",
        password: "  ",
      })
    ).toEqual({ ok: true, values: { feedUrl: "https://lib.example/cal.ics" } })
  })

  it("refuses non-http URLs, userinfo and over-long values", () => {
    expect(
      validateFeedValues("ical", { feedUrl: "ftp://x.example/a.ics" })
    ).toMatchObject({ ok: false, field: "feedUrl" })
    expect(
      validateFeedValues("ical", { feedUrl: "https://u:p@x.example/a.ics" })
    ).toMatchObject({ ok: false, field: "feedUrl" })
    expect(
      validateFeedValues("ticketsource", { apiKey: "k".repeat(2049) })
    ).toMatchObject({ ok: false, field: "apiKey" })
  })

  it("refuses a non-object body and non-string values", () => {
    expect(validateFeedValues("ical", null)).toMatchObject({ ok: false })
    expect(validateFeedValues("ical", ["x"])).toMatchObject({ ok: false })
    expect(validateFeedValues("ical", { feedUrl: 5 })).toMatchObject({
      ok: false,
      field: "feedUrl",
    })
  })

  it("checks the Eventbrite organisation id pattern", () => {
    expect(
      validateFeedValues("eventbrite", {
        organizationId: "abc",
        accessToken: "x".repeat(16),
      })
    ).toMatchObject({ ok: false, field: "organizationId" })
  })
})

describe("feedHints", () => {
  it("masks secrets to their last four characters", () => {
    expect(
      feedHints("eventbrite", {
        organizationId: "123456789",
        accessToken: "ABCDEFGHIJKLMNOP",
      })
    ).toEqual({ organizationId: "123456789", accessToken: "••••MNOP" })
  })

  it("hides short secrets entirely and shows only the host of secret URLs", () => {
    expect(
      feedHints("ical", {
        feedUrl: "https://cal.example.org/private/abc123/basic.ics",
        password: "short",
      })
    ).toEqual({
      feedUrl: "https://cal.example.org/…",
      password: "••••",
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/strapi && pnpm vitest run tests/event-providers-registry.test.ts`
Expected: FAIL. The imports are undefined (no such exports).

- [ ] **Step 3: Write the registry**

```ts
// packages/shared-data/event-providers.ts
/**
 * Event Feeds: the Source Providers a library can connect, the fields each
 * needs, and the rules every form, route and schema shares. The worker's
 * provider code reads exactly these keys (a test in `@repo/event-providers`
 * checks it). Spec: docs/superpowers/specs/2026-10-05-event-feed-credentials-design.md
 */

export const EVENT_PROVIDER_KEYS = [
  "eventbrite",
  "ical",
  "ticketsource",
  "wegottickets",
  "spydus",
  "solus",
  "aspen",
] as const
export type EventProviderKey = (typeof EVENT_PROVIDER_KEYS)[number]

export const isEventProviderKey = (v: unknown): v is EventProviderKey =>
  typeof v === "string" &&
  (EVENT_PROVIDER_KEYS as readonly string[]).includes(v)

export const FEED_TEST_CODES = [
  "ok",
  "auth_failed",
  "not_found",
  "unreachable",
  "rate_limited",
  "unrecognised_format",
  "provider_error",
  "decrypt_failed",
] as const
export type FeedTestCode = (typeof FEED_TEST_CODES)[number]

/** Results the librarian must fix before a value can go to review. */
export const FEED_TEST_BLOCKING: ReadonlySet<FeedTestCode> = new Set([
  "auth_failed",
  "not_found",
  "unrecognised_format",
])

/** What a result means, in plain words, for librarians. */
export const FEED_TEST_COPY: Record<FeedTestCode, string> = {
  ok: "Connected: we could read your events.",
  auth_failed:
    "The platform refused these details. Check the token or key and try again.",
  not_found:
    "The platform couldn't find that account or feed. Check the ID or address.",
  unreachable:
    "We couldn't reach the platform. It may be down, or the address may be wrong.",
  rate_limited:
    "The platform asked us to slow down. Try the test again in a few minutes.",
  unrecognised_format:
    "We reached the address, but it didn't return events we can read.",
  provider_error: "The platform returned an error. Try again later.",
  decrypt_failed:
    "We couldn't read the stored details. Replace them to restart the feed.",
}

/** Short labels for moderators and badges. */
export const FEED_TEST_LABEL: Record<FeedTestCode, string> = {
  ok: "Passed",
  auth_failed: "Sign-in refused",
  not_found: "Not found",
  unreachable: "Unreachable",
  rate_limited: "Rate limited",
  unrecognised_format: "Unreadable",
  provider_error: "Platform error",
  decrypt_failed: "Stored value unreadable",
}

export const FEED_STATUSES = ["draft", "pending", "active", "paused"] as const
export type FeedStatus = (typeof FEED_STATUSES)[number]
export const PAUSED_REASONS = ["library", "admin", "sync_failures"] as const
export type PausedReason = (typeof PAUSED_REASONS)[number]

export const MAX_FEEDS_PER_LIBRARY = 5
export const MAX_OPEN_FEED_SUBMISSIONS = 3
export const FEED_TEST_COOLDOWN_MS = 30_000

export type EventProviderField = {
  /** The exact key the provider code reads. */
  key: string
  label: string
  hint?: string
  required: boolean
  kind: "text" | "url" | "id"
  secret: boolean
  /** How the field is shown once stored: in full, masked, or host only. */
  display: "plain" | "secret" | "url-secret"
  /** RegExp source, checked after trimming. */
  pattern?: string
  maxLength: number
}

export type EventProviderDef = {
  key: EventProviderKey
  label: string
  description: string
  fields: EventProviderField[]
  oauth?: "eventbrite"
}

const MAX = 2048
const secret = (
  key: string,
  label: string,
  hint?: string
): EventProviderField => ({
  key,
  label,
  hint,
  required: true,
  kind: "text",
  secret: true,
  display: "secret",
  maxLength: MAX,
})
const endpoint = (hint: string): EventProviderField => ({
  key: "endpoint",
  label: "Service address",
  hint,
  required: true,
  kind: "url",
  secret: false,
  display: "plain",
  maxLength: MAX,
})

export const EVENT_PROVIDERS: Record<EventProviderKey, EventProviderDef> = {
  eventbrite: {
    key: "eventbrite",
    label: "Eventbrite",
    description: "Ticketing and event listings",
    oauth: "eventbrite",
    fields: [
      {
        key: "organizationId",
        label: "Organisation ID",
        hint: "The number in your organiser profile's address.",
        required: true,
        kind: "id",
        secret: false,
        display: "plain",
        pattern: "^\\d{5,20}$",
        maxLength: 20,
      },
      secret(
        "accessToken",
        "Private token",
        "Account settings → Developer links → API keys."
      ),
    ],
  },
  ical: {
    key: "ical",
    label: "Calendar feed (.ics)",
    description: "Any calendar that publishes an iCal address",
    fields: [
      {
        key: "feedUrl",
        label: "Calendar address",
        hint: "Starts with https:// and usually ends in .ics.",
        required: true,
        kind: "url",
        secret: true,
        display: "url-secret",
        maxLength: MAX,
      },
      {
        key: "username",
        label: "Username",
        hint: "Only if the calendar asks for a password.",
        required: false,
        kind: "text",
        secret: false,
        display: "plain",
        maxLength: 256,
      },
      { ...secret("password", "Password"), required: false },
    ],
  },
  ticketsource: {
    key: "ticketsource",
    label: "TicketSource",
    description: "UK event ticketing",
    fields: [
      secret("apiKey", "API key", "TicketSource dashboard → Settings → API."),
    ],
  },
  wegottickets: {
    key: "wegottickets",
    label: "WeGotTickets",
    description: "UK independent ticketing",
    fields: [
      {
        key: "feedUrl",
        label: "Venue feed address",
        required: true,
        kind: "url",
        secret: true,
        display: "url-secret",
        maxLength: MAX,
      },
    ],
  },
  spydus: {
    key: "spydus",
    label: "Spydus",
    description: "Library management system",
    fields: [
      endpoint("Your Spydus API address, from your vendor."),
      secret("customerKey", "Customer key"),
      {
        key: "username",
        label: "API username",
        required: true,
        kind: "text",
        secret: false,
        display: "plain",
        maxLength: 256,
      },
      secret("password", "API password"),
      {
        key: "institutionID",
        label: "Institution ID",
        required: true,
        kind: "id",
        secret: false,
        display: "plain",
        maxLength: 64,
      },
      {
        key: "locationCode",
        label: "Location code",
        required: true,
        kind: "id",
        secret: false,
        display: "plain",
        maxLength: 64,
      },
    ],
  },
  solus: {
    key: "solus",
    label: "Solus",
    description: "Library app and events platform",
    fields: [
      endpoint("Your Solus API address."),
      secret("secretKey", "Secret key"),
    ],
  },
  aspen: {
    key: "aspen",
    label: "Aspen Discovery",
    description: "Library discovery and events",
    fields: [
      endpoint("Your Aspen events API address."),
      {
        key: "clientId",
        label: "Client ID",
        required: true,
        kind: "text",
        secret: false,
        display: "plain",
        maxLength: 256,
      },
      secret("clientSecret", "Client secret"),
    ],
  },
}

export type FeedValuesResult =
  | { ok: true; values: Record<string, string> }
  | { ok: false; error: string; field?: string }

function urlProblem(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return "Enter a full web address, starting with https://."
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    return "The address must start with https:// or http://."
  if (url.username || url.password)
    return "Put the username and password in their own fields, not in the address."

  return null
}

/**
 * Checks a provider's values against the registry: only known keys, every
 * required one present, patterns, lengths and URL rules. Values are trimmed
 * and empty optional fields dropped. The Next route pre-checks with this;
 * Strapi's check is the one that counts.
 */
export function validateFeedValues(
  provider: unknown,
  values: unknown
): FeedValuesResult {
  if (!isEventProviderKey(provider))
    return { ok: false, error: "Unknown platform." }
  if (!values || typeof values !== "object" || Array.isArray(values))
    return { ok: false, error: "Missing details." }
  const def = EVENT_PROVIDERS[provider]
  const known = new Map(def.fields.map((f) => [f.key, f]))
  for (const key of Object.keys(values)) {
    if (!known.has(key))
      return { ok: false, error: "Unexpected field.", field: key }
  }
  const out: Record<string, string> = {}
  for (const f of def.fields) {
    const raw = (values as Record<string, unknown>)[f.key]
    if (raw !== undefined && raw !== null && typeof raw !== "string")
      return { ok: false, error: `${f.label} must be text.`, field: f.key }
    const v = typeof raw === "string" ? raw.trim() : ""
    if (!v) {
      if (f.required)
        return { ok: false, error: `${f.label} is required.`, field: f.key }
      continue
    }
    if (v.length > f.maxLength)
      return { ok: false, error: `${f.label} is too long.`, field: f.key }
    if (f.pattern && !new RegExp(f.pattern).test(v))
      return {
        ok: false,
        error: `${f.label} doesn't look right.`,
        field: f.key,
      }
    if (f.kind === "url") {
      const problem = urlProblem(v)
      if (problem) return { ok: false, error: problem, field: f.key }
    }
    out[f.key] = v
  }

  return { ok: true, values: out }
}

const MASK = "••••"

/** What claimants and moderators see of a stored value (spec §4). */
export function feedHints(
  provider: EventProviderKey,
  values: Record<string, string>
): Record<string, string> {
  const hints: Record<string, string> = {}
  for (const f of EVENT_PROVIDERS[provider].fields) {
    const v = values[f.key]
    if (!v) continue
    if (f.display === "plain") hints[f.key] = v
    else if (f.display === "secret")
      hints[f.key] = v.length >= 12 ? `${MASK}${v.slice(-4)}` : MASK
    else {
      try {
        const u = new URL(v)
        hints[f.key] = `${u.protocol}//${u.host}/…`
      } catch {
        hints[f.key] = MASK
      }
    }
  }

  return hints
}
```

Append to `packages/shared-data/index.ts`, after the `export * from "./verify"` line:

```ts
export * from "./event-providers"
```

- [ ] **Step 4: Build shared-data and run the test**

Run: `pnpm --filter @repo/shared-data build && cd apps/strapi && pnpm vitest run tests/event-providers-registry.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add packages/shared-data/event-providers.ts packages/shared-data/index.ts apps/strapi/tests/event-providers-registry.test.ts
git commit -m "feat(shared-data): add the event provider registry"
```

### Task 2: `@repo/event-providers` package

Move the provider code out of the worker so Strapi and the worker share it. Providers' `test` changes from returning `{ ok, error }` to resolving on success and throwing a classified error on failure.

**Files:**

- Create: `packages/event-providers/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `src/errors.ts`, `src/test-feed.ts`, `src/registry.ts`, `src/types.ts`
- Move (`git mv`): `apps/sync-worker/src/providers/{aspen,eventbrite,ical,solus,spydus,ticketsource,wegottickets}.ts` to `packages/event-providers/src/providers/`; `apps/sync-worker/src/lib/{safe-fetch,redact-url,date}.ts` to `packages/event-providers/src/lib/`; `apps/sync-worker/tests/providers/*`, `tests/lib/{safe-fetch,bounded-fetch,redact-url,date}.test.ts` to `packages/event-providers/tests/...`
- Delete: `apps/sync-worker/src/providers/index.ts`, `apps/sync-worker/src/providers/types.ts`
- Create: `apps/sync-worker/src/types.ts` (holds `NormalizedEvent` and `LoadedCredential`, moved out of the old `providers/types.ts`)
- Modify: every worker import of `../providers`, `../providers/types`, `../lib/safe-fetch`, `../lib/redact-url`, `../lib/date` (pipeline files, `server.ts`, worker tests); `apps/sync-worker/package.json`
- Test: `packages/event-providers/tests/errors.test.ts`, `tests/registry-parity.test.ts`

**Interfaces:**

- Consumes: `EventProviderKey`, `FeedTestCode`, `EVENT_PROVIDERS` from `@repo/shared-data` (Task 1).
- Produces (`@repo/event-providers`):
  - `type EventProvider = { name: EventProviderKey; eventTypeMap: Record<string, EventType>; test(c: ProviderCredentials): Promise<void>; fetch(c: ProviderCredentials, hints: LibraryHint[]): Promise<RawEvent[]> }`
  - `ProviderCredentials`, `RawEvent`, `LibraryHint`, `EventType` (same shapes as today)
  - `getProvider(key: string): EventProvider | undefined`, `providerRegistry: ReadonlyMap<EventProviderKey, EventProvider>`
  - `class ProviderStatusError extends Error { status: number }`, `class FeedFormatError extends Error`
  - `classifyFailure(err: unknown): FeedTestCode`
  - `testFeed(provider: string, values: Record<string, string>): Promise<{ result: FeedTestCode; detail?: string }>`; `detail` is redacted and only for admin storage
  - re-exports `safeFetch`, `safeFetchText`, `parseJsonBody`, `UnsafeUrlError`, `FetchTimeoutError`, `ResponseTooLargeError`, `redactUrl`, `redactUrlsInText`, and everything `lib/date.ts` exports

- [ ] **Step 1: Scaffold the package**

```json
// packages/event-providers/package.json
{
  "name": "@repo/event-providers",
  "version": "0.1.0",
  "private": true,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js"
    }
  },
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/shared-data": "workspace:*",
    "fast-xml-parser": "^5.11.1",
    "ical.js": "^2.0.1",
    "ipaddr.js": "^2.5.0",
    "undici": "^8.11.2"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

```json
// packages/event-providers/tsconfig.json — same module settings as the worker, plus declarations
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

```ts
// packages/event-providers/vitest.config.ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
})
```

Then move the files and install:

```bash
mkdir -p packages/event-providers/src/providers packages/event-providers/src/lib packages/event-providers/tests/providers packages/event-providers/tests/lib
for p in aspen eventbrite ical solus spydus ticketsource wegottickets; do git mv apps/sync-worker/src/providers/$p.ts packages/event-providers/src/providers/$p.ts; done
for l in safe-fetch redact-url date; do git mv apps/sync-worker/src/lib/$l.ts packages/event-providers/src/lib/$l.ts; done
git mv apps/sync-worker/tests/providers/ical.test.ts packages/event-providers/tests/providers/ical.test.ts
git mv apps/sync-worker/tests/providers/eventbrite.test.ts packages/event-providers/tests/providers/eventbrite.test.ts
for t in safe-fetch bounded-fetch redact-url date; do git mv apps/sync-worker/tests/lib/$t.test.ts packages/event-providers/tests/lib/$t.test.ts; done
pnpm install
```

- [ ] **Step 2: Write the failing tests for errors and parity**

```ts
// packages/event-providers/tests/errors.test.ts
import { describe, expect, it } from "vitest"

import {
  classifyFailure,
  FeedFormatError,
  FetchTimeoutError,
  ProviderStatusError,
  ResponseTooLargeError,
  UnsafeUrlError,
} from "../src"

describe("classifyFailure", () => {
  it.each([
    [new ProviderStatusError("eventbrite", 401), "auth_failed"],
    [new ProviderStatusError("eventbrite", 403), "auth_failed"],
    [new ProviderStatusError("ical", 404), "not_found"],
    [new ProviderStatusError("ical", 410), "not_found"],
    [new ProviderStatusError("ical", 429), "rate_limited"],
    [new ProviderStatusError("ical", 500), "provider_error"],
    [new FeedFormatError("not ical"), "unrecognised_format"],
    [new ResponseTooLargeError(5), "unrecognised_format"],
    [new UnsafeUrlError("blocked"), "unreachable"],
    [new FetchTimeoutError(15000), "unreachable"],
    [
      Object.assign(new TypeError("fetch failed"), {
        cause: { code: "ENOTFOUND" },
      }),
      "unreachable",
    ],
    [new Error("something odd"), "provider_error"],
  ] as const)("%s → %s", (err, code) => {
    expect(classifyFailure(err)).toBe(code)
  })
})
```

```ts
// packages/event-providers/tests/registry-parity.test.ts
import { EVENT_PROVIDER_KEYS } from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import { getProvider, providerRegistry } from "../src"

describe("provider registry", () => {
  it("registers every provider the shared registry lists, and no others", () => {
    expect([...providerRegistry.keys()].sort()).toEqual(
      [...EVENT_PROVIDER_KEYS].sort()
    )
    for (const k of EVENT_PROVIDER_KEYS) expect(getProvider(k)?.name).toBe(k)
    expect(getProvider("meetup")).toBeUndefined()
  })
})
```

Add a `testFeed` test that stubs the registry. Export a `__setProviderForTest` only from `src/registry.ts`; it is not re-exported from `src/index.ts`.

```ts
// packages/event-providers/tests/test-feed.test.ts
import { afterEach, describe, expect, it } from "vitest"

import { ProviderStatusError, testFeed } from "../src"
import { __setProviderForTest, __resetProvidersForTest } from "../src/registry"

afterEach(() => __resetProvidersForTest())

const stub = (test: () => Promise<void>) =>
  __setProviderForTest({
    name: "ical",
    eventTypeMap: {},
    test,
    fetch: async () => [],
  })

describe("testFeed", () => {
  it("reports ok when the provider resolves", async () => {
    stub(async () => {})
    expect(
      await testFeed("ical", { feedUrl: "https://x.example/a.ics" })
    ).toEqual({ result: "ok" })
  })

  it("classifies a thrown error and redacts URLs in the detail", async () => {
    stub(async () => {
      throw new ProviderStatusError(
        "ical",
        401,
        "https://x.example/a.ics?token=s3cret"
      )
    })
    const r = await testFeed("ical", {
      feedUrl: "https://x.example/a.ics?token=s3cret",
    })
    expect(r.result).toBe("auth_failed")
    expect(r.detail).not.toContain("s3cret")
  })

  it("answers provider_error for an unknown provider", async () => {
    expect(await testFeed("meetup", {})).toMatchObject({
      result: "provider_error",
    })
  })
})
```

Run: `cd packages/event-providers && pnpm vitest run`
Expected: FAIL. `../src` has no `index.ts` yet.

- [ ] **Step 3: Write `types.ts`, `errors.ts`, `registry.ts`, `test-feed.ts`, `index.ts`**

```ts
// packages/event-providers/src/types.ts
import type { EventProviderKey } from "@repo/shared-data"

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

// Copy `RawEvent` verbatim from the old apps/sync-worker/src/providers/types.ts.
export interface RawEvent {
  externalId: string
  title: string
  description: string
  url: string
  imageUrl?: string
  startTime: string
  endTime?: string
  allDay: boolean
  timezone: string
  providerCategory?: string
  tags: string[]
  isFree: boolean
  priceMin?: number
  priceMax?: number
  registrationUrl?: string
  capacity?: number
  venueName?: string
  venueAddress?: string
}

export interface EventProvider {
  readonly name: EventProviderKey
  readonly eventTypeMap: Record<string, EventType>
  /** Resolves when the values work; throws (see errors.ts) when they don't. */
  test: (credentials: ProviderCredentials) => Promise<void>
  fetch: (
    credentials: ProviderCredentials,
    hints: LibraryHint[]
  ) => Promise<RawEvent[]>
}
```

```ts
// packages/event-providers/src/errors.ts
import type { FeedTestCode } from "@repo/shared-data"

import {
  FetchTimeoutError,
  ResponseTooLargeError,
  UnsafeUrlError,
} from "./lib/safe-fetch"

/** A provider answered with a non-2xx status. */
export class ProviderStatusError extends Error {
  readonly status: number
  constructor(provider: string, status: number, url?: string) {
    super(`${provider} returned ${status}${url ? ` for ${url}` : ""}`)
    this.name = "ProviderStatusError"
    this.status = status
  }
}

/** The response arrived but isn't the format the provider expects. */
export class FeedFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FeedFormatError"
  }
}

const NETWORK_CODES = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
])

/** One test code for any failure a provider's test or fetch throws. */
export function classifyFailure(err: unknown): FeedTestCode {
  if (err instanceof ProviderStatusError) {
    if (err.status === 401 || err.status === 403) return "auth_failed"
    if (err.status === 404 || err.status === 410) return "not_found"
    if (err.status === 429) return "rate_limited"

    return "provider_error"
  }
  if (err instanceof FeedFormatError || err instanceof ResponseTooLargeError)
    return "unrecognised_format"
  if (err instanceof UnsafeUrlError || err instanceof FetchTimeoutError)
    return "unreachable"
  const code =
    (err as { cause?: { code?: unknown }; code?: unknown } | null)?.cause
      ?.code ?? (err as { code?: unknown } | null)?.code
  if (typeof code === "string" && NETWORK_CODES.has(code)) return "unreachable"
  if (err instanceof TypeError && /fetch failed/i.test(err.message))
    return "unreachable"

  return "provider_error"
}
```

```ts
// packages/event-providers/src/registry.ts
import type { EventProviderKey } from "@repo/shared-data"

import { aspenProvider } from "./providers/aspen"
import { eventbriteProvider } from "./providers/eventbrite"
import { icalProvider } from "./providers/ical"
import { solusProvider } from "./providers/solus"
import { spydusProvider } from "./providers/spydus"
import { ticketsourceProvider } from "./providers/ticketsource"
import { wegotticketsProvider } from "./providers/wegottickets"
import type { EventProvider } from "./types"

const ALL: EventProvider[] = [
  aspenProvider,
  eventbriteProvider,
  icalProvider,
  solusProvider,
  spydusProvider,
  ticketsourceProvider,
  wegotticketsProvider,
]

const registry = new Map<EventProviderKey, EventProvider>(
  ALL.map((p) => [p.name, p])
)

export const providerRegistry: ReadonlyMap<EventProviderKey, EventProvider> =
  registry

export function getProvider(key: string): EventProvider | undefined {
  return registry.get(key as EventProviderKey)
}

/** Tests only: replace one provider. */
export function __setProviderForTest(p: EventProvider): void {
  registry.set(p.name, p)
}
/** Tests only: restore the real providers. */
export function __resetProvidersForTest(): void {
  registry.clear()
  for (const p of ALL) registry.set(p.name, p)
}
```

Check each provider file's exported const name with `grep -n "export const .*Provider" packages/event-providers/src/providers/*.ts` and use those names in the imports above.

```ts
// packages/event-providers/src/test-feed.ts
import type { FeedTestCode } from "@repo/shared-data"

import { classifyFailure } from "./errors"
import { redactUrlsInText } from "./lib/redact-url"
import { getProvider } from "./registry"

/**
 * Runs a provider's test on values held in memory. `detail` is the
 * redacted error text, for Strapi admin only; everyone else gets `result`.
 */
export async function testFeed(
  provider: string,
  values: Record<string, string>
): Promise<{ result: FeedTestCode; detail?: string }> {
  const p = getProvider(provider)
  if (!p)
    return { result: "provider_error", detail: `No provider "${provider}"` }
  try {
    await p.test(values)

    return { result: "ok" }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    return {
      result: classifyFailure(err),
      detail: redactUrlsInText(message).slice(0, 500),
    }
  }
}
```

```ts
// packages/event-providers/src/index.ts
export * from "./types"
export * from "./errors"
export * from "./lib/safe-fetch"
export * from "./lib/redact-url"
export * from "./lib/date"
export { getProvider, providerRegistry } from "./registry"
export { testFeed } from "./test-feed"
```

- [ ] **Step 4: Convert each provider's `test` to throw**

In each of the seven provider files:

- Change the import paths: `../lib/safe-fetch` stays the same relative path (the lib moved with them); `./types` becomes `../types`.
- Rewrite `test` so it resolves on success and throws on failure:
  - a non-ok HTTP response throws `new ProviderStatusError("<name>", res.status)`;
  - a parse or format failure throws `new FeedFormatError("<what was wrong>")`;
  - delete every `try { … } catch (err) { return { ok: false, error } }` wrapper and every `return { ok: true }`;
  - the "Missing …" guards throw `new FeedFormatError("Missing …")` (validation in Task 1 normally prevents this).

Also make each provider's `fetch` throw `ProviderStatusError` for non-ok responses, so the worker can classify sync failures in Task 17.

Eventbrite's `test` becomes:

```ts
async test(credentials: ProviderCredentials) {
  const { organizationId, accessToken } = credentials
  const res = await safeFetchText(`${BASE}/organizations/${organizationId}/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new ProviderStatusError("eventbrite", res.status)
},
```

In iCal's `fetchFeed`: throw `new ProviderStatusError("ical", res.status)` for a non-ok status. Throw `new FeedFormatError("The address didn't return an iCal calendar")` when the body lacks `BEGIN:VCALENDAR` or `ICAL.parse` throws. Its `test` becomes `async test(c) { await fetchFeed(c.feedUrl!, c.username, c.password) }`.

Update the moved provider tests that asserted `{ ok: false, error }` to assert `await expect(provider.test(...)).rejects.toBeInstanceOf(ProviderStatusError)` (or `FeedFormatError`), and `{ ok: true }` to `resolves.toBeUndefined()`.

- [ ] **Step 5: Re-point the worker at the package**

`apps/sync-worker/package.json`: add `"@repo/event-providers": "workspace:*"` and `"@repo/shared-data": "workspace:*"`; remove `fast-xml-parser`, `ical.js`, `ipaddr.js` and `undici` if nothing else in the worker imports them (`grep -rn "from \"undici\"\|ical.js\|fast-xml-parser\|ipaddr" apps/sync-worker/src`).

Create `apps/sync-worker/src/types.ts` holding `NormalizedEvent` and `LoadedCredential` (copied verbatim from the deleted `providers/types.ts`), with `provider: EventProviderKey` imported from `@repo/shared-data`. Then replace the imports:

- `from "../providers"` and `from "../providers/types"` become `from "@repo/event-providers"` for `getProvider`, `RawEvent`, `LibraryHint` and `EventType`, and `from "../types"` for `NormalizedEvent` and `LoadedCredential`;
- `from "../lib/redact-url"` and `from "../lib/date"` become `from "@repo/event-providers"`.

In `pipeline/validate.ts`, a test now throws, so adapt it:

```ts
// apps/sync-worker/src/pipeline/validate.ts (body of the per-credential check)
const provider = getProvider(cred.provider)
if (!provider) {
  failed.push({
    credential: cred,
    code: "provider_error",
    error: `No provider registered for "${cred.provider}"`,
  })
  return
}
try {
  await provider.test(cred.credentials)
  valid.push(cred)
} catch (err) {
  failed.push({
    credential: cred,
    code: classifyFailure(err),
    error: redactUrlsInText(err instanceof Error ? err.message : String(err)),
  })
}
```

Add `code: FeedTestCode` to the failed-entry type and keep `error`. Callers in `sync.ts` keep reading `error`; Task 17 uses `code`.

In `server.ts`, delete the whole `POST /test-credential` branch and `hasWorkerSecret`, so the server answers `/health` and 404 only. Remove the now-unused `decrypt` and `getProvider` imports. Delete `WORKER_SECRET` from `apps/sync-worker/.env.example`.

- [ ] **Step 6: Build and run every test**

Run: `pnpm --filter @repo/shared-data build && pnpm --filter @repo/event-providers build && pnpm --filter @repo/event-providers test && pnpm --filter @repo/sync-worker typecheck && pnpm --filter @repo/sync-worker test`
Expected: all PASS. No worker test imports a moved file.

- [ ] **Step 7: Commit**

```bash
git add packages/event-providers apps/sync-worker pnpm-lock.yaml
git commit -m "refactor(events): move providers into @repo/event-providers and register all seven"
```

---

## Phase B: Credential model

### Task 3: Schemas, admin permission and indexes

**Files:**

- Modify: `apps/strapi/src/plugins/events/server/content-types/event-credential/schema.json`
- Create: `apps/strapi/src/plugins/events/server/content-types/credential-event/schema.json`
- Modify: `apps/strapi/src/plugins/events/server/content-types/index.ts`
- Modify: `apps/strapi/src/plugins/events/server/content-types/sync-command/schema.json`
- Modify: `apps/strapi/src/plugins/events/strapi-server.ts` (register `reveal-credentials`)
- Modify: `apps/strapi/src/plugins/events/server/utils/ensure-event-indexes.ts` (two indexes)
- Modify: `apps/sync-worker/src/pipeline/load-credentials.ts` (status instead of `is_active`)
- Test: `apps/strapi/tests/events/credential-schema.test.ts` (new), `apps/strapi/tests/events/ensure-event-indexes.test.ts` (extend), `apps/sync-worker/tests/pipeline/load-credentials.test.ts` (adjust)

**Interfaces:**

- Produces: the credential attributes from spec §6.1 (exact names below); UID `plugin::events.credential-event` with table `ev_credential_events`; `sync-command.credentialDocumentId`; admin action `plugin::events.reveal-credentials`.

- [ ] **Step 1: Write the failing schema test**

```ts
// apps/strapi/tests/events/credential-schema.test.ts
import {
  EVENT_PROVIDER_KEYS,
  FEED_STATUSES,
  FEED_TEST_CODES,
  PAUSED_REASONS,
} from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import credentialEvent from "../../src/plugins/events/server/content-types/credential-event/schema.json"
import credential from "../../src/plugins/events/server/content-types/event-credential/schema.json"
import syncCommand from "../../src/plugins/events/server/content-types/sync-command/schema.json"

const a = credential.attributes as Record<string, any>

describe("event-credential schema", () => {
  it("takes its enums from the shared registry", () => {
    expect([...a.provider.enum].sort()).toEqual([...EVENT_PROVIDER_KEYS].sort())
    expect(a.status.enum).toEqual([...FEED_STATUSES])
    expect(a.pausedReason.enum).toEqual([...PAUSED_REASONS])
    expect(a.lastTestResult.enum).toEqual([...FEED_TEST_CODES])
    expect(a.pendingTestResult.enum).toEqual([...FEED_TEST_CODES])
    expect(a.lastErrorCode.enum).toEqual([...FEED_TEST_CODES])
  })

  it("keeps values and the connector private", () => {
    for (const k of [
      "credentialsEncrypted",
      "pendingCredentialsEncrypted",
      "connectedBy",
    ])
      expect(a[k].private).toBe(true)
  })

  it("has no isActive flag any more", () => {
    expect(a.isActive).toBeUndefined()
  })

  it("is hidden from the Content Manager, and so is the audit log", () => {
    expect(credential.pluginOptions["content-manager"].visible).toBe(false)
    expect(credentialEvent.pluginOptions["content-manager"].visible).toBe(false)
    expect(credentialEvent.collectionName).toBe("ev_credential_events")
  })

  it("lets a sync command name one feed", () => {
    expect((syncCommand.attributes as any).credentialDocumentId.type).toBe(
      "string"
    )
  })
})
```

Run: `cd apps/strapi && pnpm vitest run tests/events/credential-schema.test.ts`
Expected: FAIL (the credential-event schema doesn't exist; the attributes are missing).

- [ ] **Step 2: Write the schemas**

Replace the `attributes` of `event-credential/schema.json` with:

```json
{
  "provider": {
    "type": "enumeration",
    "required": true,
    "enum": [
      "eventbrite",
      "ical",
      "ticketsource",
      "wegottickets",
      "spydus",
      "solus",
      "aspen"
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
  "status": {
    "type": "enumeration",
    "required": true,
    "enum": ["draft", "pending", "active", "paused"],
    "default": "pending"
  },
  "pausedReason": {
    "type": "enumeration",
    "enum": ["library", "admin", "sync_failures"]
  },
  "source": {
    "type": "enumeration",
    "required": true,
    "enum": ["admin", "library"],
    "default": "admin"
  },
  "connectedBy": { "type": "string", "private": true },
  "credentialsEncrypted": { "type": "text", "required": true, "private": true },
  "hints": { "type": "json" },
  "pendingCredentialsEncrypted": { "type": "text", "private": true },
  "pendingHints": { "type": "json" },
  "pendingSubmissionDocumentId": { "type": "string" },
  "submissionDocumentId": { "type": "string" },
  "lastTestedAt": { "type": "datetime" },
  "lastTestResult": {
    "type": "enumeration",
    "enum": [
      "ok",
      "auth_failed",
      "not_found",
      "unreachable",
      "rate_limited",
      "unrecognised_format",
      "provider_error",
      "decrypt_failed"
    ]
  },
  "pendingTestedAt": { "type": "datetime" },
  "pendingTestResult": {
    "type": "enumeration",
    "enum": [
      "ok",
      "auth_failed",
      "not_found",
      "unreachable",
      "rate_limited",
      "unrecognised_format",
      "provider_error",
      "decrypt_failed"
    ]
  },
  "lastVerifiedAt": { "type": "datetime" },
  "lastSyncAt": { "type": "datetime" },
  "lastSyncStatus": {
    "type": "enumeration",
    "enum": ["ok", "partial", "error"]
  },
  "lastErrorCode": {
    "type": "enumeration",
    "enum": [
      "ok",
      "auth_failed",
      "not_found",
      "unreachable",
      "rate_limited",
      "unrecognised_format",
      "provider_error",
      "decrypt_failed"
    ]
  },
  "lastErrorMessage": { "type": "text" },
  "consecutiveFailures": { "type": "integer", "default": 0 },
  "autoPauseNotifiedAt": { "type": "datetime" }
}
```

Create `credential-event/schema.json`:

```json
{
  "kind": "collectionType",
  "collectionName": "ev_credential_events",
  "info": {
    "singularName": "credential-event",
    "pluralName": "credential-events",
    "displayName": "Credential Event",
    "description": "Append-only log of Event Feed actions. Never holds a value."
  },
  "options": { "draftAndPublish": false },
  "pluginOptions": {
    "content-manager": { "visible": false },
    "content-type-builder": { "visible": false }
  },
  "attributes": {
    "credentialDocumentId": { "type": "string", "required": true },
    "provider": { "type": "string" },
    "libraryDocumentIds": { "type": "json" },
    "action": {
      "type": "enumeration",
      "required": true,
      "enum": [
        "connect_submitted",
        "replace_submitted",
        "approved",
        "rejected",
        "withdrawn",
        "tested",
        "paused",
        "resumed",
        "auto_paused",
        "disconnected",
        "revealed",
        "admin_created",
        "admin_updated",
        "admin_deleted"
      ]
    },
    "actor": { "type": "string", "required": true },
    "submissionDocumentId": { "type": "string" },
    "resultCode": { "type": "string" },
    "note": { "type": "string" }
  }
}
```

Register it in `content-types/index.ts`:

```ts
import credentialEventSchema from "./credential-event/schema.json"
// …
export default {
  "event-credential": { schema: eventCredentialSchema },
  "credential-event": { schema: credentialEventSchema },
  event: { schema: eventSchema },
  "import-run": { schema: importRunSchema },
  "sync-command": { schema: syncCommandSchema },
}
```

Add to `sync-command/schema.json` attributes: `"credentialDocumentId": { "type": "string" }`.

In `strapi-server.ts`, add a fourth action to `registerMany`:

```ts
{
  section: "plugins",
  displayName: "Reveal event credentials (logged)",
  uid: "reveal-credentials",
  pluginName: "events",
},
```

- [ ] **Step 3: Add the indexes**

In `ensure-event-indexes.ts`, add the constants and run them in the same function that applies the existing indexes, after them:

```ts
export const EV_CREDENTIALS_STATUS_INDEX_SQL =
  "CREATE INDEX IF NOT EXISTS ev_event_credentials_status_idx ON ev_event_credentials (status)"
export const EV_CREDENTIAL_EVENTS_INDEX_SQL =
  "CREATE INDEX IF NOT EXISTS ev_credential_events_credential_idx " +
  "ON ev_credential_events (credential_document_id, created_at)"
```

Extend `tests/events/ensure-event-indexes.test.ts` with one assertion that both statements are executed (follow the file's existing pattern for the entity-ref index).

- [ ] **Step 4: Point the worker at `status`**

In `apps/sync-worker/src/pipeline/load-credentials.ts`, replace `.where("ec.is_active", true)` with `.where("ec.status", "active")`, remove `"ec.is_active as isActive"` from the select, and drop `isActive` from `CredentialRow`. Update `tests/pipeline/load-credentials.test.ts` fixtures from `is_active: true` to `status: "active"`.

- [ ] **Step 5: Regenerate types and run the tests**

Run: `cd apps/strapi && pnpm vitest run tests/events && pnpm strapi ts:generate-types && cd ../.. && pnpm --filter @repo/sync-worker test`
Expected: the schema tests PASS. `tests/events/credentials.test.ts` FAILS where it still uses `isActive`; Task 4 rewrites it. Worker tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/strapi/src/plugins/events apps/strapi/tests/events/credential-schema.test.ts apps/strapi/tests/events/ensure-event-indexes.test.ts apps/strapi/types/generated apps/sync-worker/src/pipeline/load-credentials.ts apps/sync-worker/tests/pipeline/load-credentials.test.ts
git commit -m "feat(events): credential status, pending slot, audit log schema and reveal permission"
```

### Task 4: Slot crypto, audit helper and credentials service

**Files:**

- Create: `apps/strapi/src/plugins/events/server/utils/credential-crypto.ts`
- Create: `apps/strapi/src/plugins/events/server/utils/credential-events.ts`
- Modify: `apps/strapi/src/plugins/events/server/services/credentials.ts` (full rewrite below)
- Modify: `apps/strapi/package.json` (add `"@repo/event-providers": "workspace:*"`)
- Test: `apps/strapi/tests/events/credentials.test.ts` (rewrite), `apps/strapi/tests/events/credential-crypto.test.ts` (new)

**Interfaces:**

- Consumes: `validateFeedValues`, `feedHints`, `EventProviderKey`, `FeedTestCode` (Task 1); `testFeed` (Task 2).
- Produces:
  - `credential-crypto.ts`: `type Slot = "current" | "pending"`; `aadFor(documentId: string, slot: Slot): string`; `sealValues(values: Record<string,string>, documentId: string, slot: Slot): string`; `openValues(blob: string, documentId: string, slot: Slot): Record<string,string>`
  - `credential-events.ts`: `type CredentialAction` (the 14 actions); `recordCredentialEvent(strapi, e: { credentialDocumentId: string; provider?: string; libraryDocumentIds?: string[]; action: CredentialAction; actor: string; submissionDocumentId?: string; resultCode?: string; note?: string }): Promise<void>`
  - credentials service (`strapi.plugin("events").service("credentials")`):
    - `findAll()`, `findOne(documentId)`; both return `PublicCredential` (no encrypted fields)
    - `create(data: { provider; label; scope; status?: "active" | "paused"; libraryDocumentIds?; credentials }, actor: string)`
    - `update(documentId, data: { label?; status?: "active" | "paused"; libraryDocumentIds?; credentials? }, actor: string)`
    - `delete(documentId, actor: string)`
    - `test(documentId, slot: Slot, actor: string): Promise<{ result: FeedTestCode }>`
    - `reveal(documentId, slot: Slot, actor: string): Promise<Record<string,string> | null>`
    - `syncLibraryFeedFlags(libraryDocumentIds: Iterable<string>): Promise<void>`
    - `queueSync(credentialDocumentId?: string, requestedByUserId?: string): Promise<void>`
  - `CREDENTIAL_PUBLIC_FIELDS` (exported const array)

- [ ] **Step 1: Write the failing crypto test**

```ts
// apps/strapi/tests/events/credential-crypto.test.ts
import { beforeEach, describe, expect, it } from "vitest"

import {
  aadFor,
  openValues,
  sealValues,
} from "../../src/plugins/events/server/utils/credential-crypto"

beforeEach(() => {
  process.env.EVENTS_CREDENTIAL_KEY = "b".repeat(64)
  delete process.env.EVENTS_CREDENTIAL_KEY_PREV
})

describe("credential slots", () => {
  it("binds the current slot to the documentId and the pending slot apart", () => {
    expect(aadFor("doc1", "current")).toBe("doc1")
    expect(aadFor("doc1", "pending")).toBe("doc1:pending")
  })

  it("round-trips a value in each slot", () => {
    const v = { apiKey: "secret-value-123" }
    expect(
      openValues(sealValues(v, "doc1", "current"), "doc1", "current")
    ).toEqual(v)
    expect(
      openValues(sealValues(v, "doc1", "pending"), "doc1", "pending")
    ).toEqual(v)
  })

  it("refuses a value moved between slots or rows", () => {
    const blob = sealValues({ apiKey: "x" }, "doc1", "pending")
    expect(() => openValues(blob, "doc1", "current")).toThrow()
    expect(() => openValues(blob, "doc2", "pending")).toThrow()
  })
})
```

Run: `cd apps/strapi && pnpm vitest run tests/events/credential-crypto.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 2: Write `credential-crypto.ts` and `credential-events.ts`**

```ts
// apps/strapi/src/plugins/events/server/utils/credential-crypto.ts
import { decrypt, encrypt } from "@repo/events-crypto"

/**
 * Event Credential values, sealed with AES-256-GCM. The current value is
 * bound (additional authenticated data) to the row's documentId and a
 * pending replacement to `${documentId}:pending`, so a blob copied between
 * rows or slots fails to open. Only Strapi and the sync worker hold the key.
 */
export type Slot = "current" | "pending"

const KEY_ENV = "EVENTS_CREDENTIAL_KEY"
const PREV_KEY_ENV = "EVENTS_CREDENTIAL_KEY_PREV"

function key(): string {
  const k = process.env[KEY_ENV]
  if (!k || k.length !== 64)
    throw new Error(`${KEY_ENV} must be a 64-character hex string`)

  return k
}
function prevKey(): string | undefined {
  const k = process.env[PREV_KEY_ENV]

  return k && k.length === 64 ? k : undefined
}

export const aadFor = (documentId: string, slot: Slot): string =>
  slot === "current" ? documentId : `${documentId}:pending`

export function sealValues(
  values: Record<string, string>,
  documentId: string,
  slot: Slot
): string {
  return encrypt(JSON.stringify(values), key(), {
    aad: aadFor(documentId, slot),
  })
}

export function openValues(
  blob: string,
  documentId: string,
  slot: Slot
): Record<string, string> {
  return JSON.parse(
    decrypt(blob, key(), prevKey(), { aad: aadFor(documentId, slot) })
  ) as Record<string, string>
}
```

```ts
// apps/strapi/src/plugins/events/server/utils/credential-events.ts
/**
 * The Event Feed audit log (`plugin::events.credential-event`): append-only,
 * no REST routes, never a value. Written inside the caller's transaction
 * when there is one, so a rolled-back action leaves no entry.
 */
export const CREDENTIAL_EVENT_UID = "plugin::events.credential-event"

export type CredentialAction =
  | "connect_submitted"
  | "replace_submitted"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "tested"
  | "paused"
  | "resumed"
  | "auto_paused"
  | "disconnected"
  | "revealed"
  | "admin_created"
  | "admin_updated"
  | "admin_deleted"

export async function recordCredentialEvent(
  strapi: any,
  e: {
    credentialDocumentId: string
    provider?: string
    libraryDocumentIds?: string[]
    action: CredentialAction
    actor: string
    submissionDocumentId?: string
    resultCode?: string
    note?: string
  }
): Promise<void> {
  await strapi.documents(CREDENTIAL_EVENT_UID).create({
    data: { ...e, note: e.note?.slice(0, 255) },
  })
}
```

Run the crypto test again. Expected: PASS.

- [ ] **Step 3: Rewrite the credentials service tests**

Rewrite `apps/strapi/tests/events/credentials.test.ts`. Keep its `seed()` helper but give credentials `status: "active"` instead of `isActive: true`, and add `[CREDENTIAL_EVENT_UID]: []` to the seed. Replace its tests with these:

```ts
import { describe, expect, it, vi } from "vitest"
// … existing imports and seed(), plus:
import { sealValues } from "../../src/plugins/events/server/utils/credential-crypto"

const EVENTS = "plugin::events.credential-event"

describe("credentials service: hasActiveFeed", () => {
  it("pausing the only credential clears the flag", async () => {
    const { strapi } = seed()
    const service = credentialsFactory({ strapi })
    await service.update(
      "credA0000000000000000001",
      { status: "paused" },
      "admin:1"
    )
    expect(await publishedFlag(strapi, "lib00000000000000000001")).toBe(false)
    expect(await publishedFlag(strapi, "lib00000000000000000002")).toBe(true)
  })

  it("keeps the flag while another active credential feeds the library", async () => {
    const { strapi, store } = seed()
    store[CRED]![1]!.libraries = [{ documentId: "lib00000000000000000001" }]
    const service = credentialsFactory({ strapi })
    await service.update(
      "credA0000000000000000001",
      { status: "paused" },
      "admin:1"
    )
    expect(await publishedFlag(strapi, "lib00000000000000000001")).toBe(true)
  })

  it("a pending credential never sets the flag", async () => {
    const { strapi, store } = seed()
    store[CRED]![0]!.status = "pending"
    const service = credentialsFactory({ strapi })
    await service.syncLibraryFeedFlags(["lib00000000000000000001"])
    expect(await publishedFlag(strapi, "lib00000000000000000001")).toBe(false)
  })

  it("only asks about the libraries it was given", async () => {
    const { strapi } = seed()
    const service = credentialsFactory({ strapi })
    const spy = vi.spyOn(strapi, "documents")
    await service.syncLibraryFeedFlags(["lib00000000000000000001"])
    const credReads = spy.mock.calls.filter((c) => c[0] === CRED)
    expect(credReads.length).toBe(1)
  })
})

describe("credentials service: admin writes", () => {
  it("creates a validated, encrypted, active credential and logs it", async () => {
    const { strapi, store } = seed()
    const service = credentialsFactory({ strapi })
    const created = await service.create(
      {
        provider: "ticketsource",
        label: "Central",
        scope: "library",
        status: "active",
        libraryDocumentIds: ["lib00000000000000000002"],
        credentials: { apiKey: "ts_live_ABCDEFGHIJ" },
      },
      "admin:7"
    )
    const row = store[CRED]!.find((c) => c.documentId === created.documentId)!
    expect(row.source).toBe("admin")
    expect(row.connectedBy).toBe("admin:7")
    expect(row.hints).toEqual({ apiKey: "••••GHIJ" })
    expect(row.credentialsEncrypted).not.toContain("ts_live")
    expect(created).not.toHaveProperty("credentialsEncrypted")
    expect(store[EVENTS]!.map((e) => e.action)).toContain("admin_created")
  })

  it("refuses values the registry rejects", async () => {
    const { strapi } = seed()
    const service = credentialsFactory({ strapi })
    await expect(
      service.create(
        {
          provider: "eventbrite",
          label: "x",
          scope: "library",
          credentials: { apiKey: "x" },
        },
        "admin:7"
      )
    ).rejects.toThrow(/Unexpected field|required/)
  })
})

describe("credentials service: reveal", () => {
  it("returns the value of a slot and logs who asked", async () => {
    const { strapi, store } = seed()
    store[CRED]![0]!.credentialsEncrypted = sealValues(
      { feedUrl: "https://x.example/a.ics" },
      "credA0000000000000000001",
      "current"
    )
    const service = credentialsFactory({ strapi })
    expect(
      await service.reveal("credA0000000000000000001", "current", "admin:3")
    ).toEqual({
      feedUrl: "https://x.example/a.ics",
    })
    expect(store[EVENTS]!.at(-1)).toMatchObject({
      action: "revealed",
      actor: "admin:3",
    })
  })

  it("answers null for an empty pending slot", async () => {
    const { strapi } = seed()
    const service = credentialsFactory({ strapi })
    expect(
      await service.reveal("credA0000000000000000001", "pending", "admin:3")
    ).toBeNull()
  })
})

describe("credentials service: test", () => {
  it("stores the result code, not the provider's message", async () => {
    const { strapi, store } = seed()
    store[CRED]![0]!.credentialsEncrypted = sealValues(
      { feedUrl: "https://x.example/a.ics" },
      "credA0000000000000000001",
      "current"
    )
    const service = credentialsFactory({
      strapi,
      testFeed: async () => ({
        result: "auth_failed",
        detail: "401 for https://x.example",
      }),
    })
    expect(
      await service.test("credA0000000000000000001", "current", "admin:1")
    ).toEqual({ result: "auth_failed" })
    expect(store[CRED]![0]!.lastTestResult).toBe("auth_failed")
  })
})
```

The service factory takes an optional injected `testFeed` (defaulting to the package's), so tests never touch the network.

Run: `cd apps/strapi && pnpm vitest run tests/events/credentials.test.ts`
Expected: FAIL (the old service has no `status`, `reveal`, `test` or actor arguments).

- [ ] **Step 4: Rewrite the credentials service**

```ts
// apps/strapi/src/plugins/events/server/services/credentials.ts
import { testFeed as realTestFeed } from "@repo/event-providers"
import {
  type EventProviderKey,
  feedHints,
  type FeedTestCode,
  validateFeedValues,
} from "@repo/shared-data"

import { openValues, sealValues, type Slot } from "../utils/credential-crypto"
import { recordCredentialEvent } from "../utils/credential-events"

export const CREDENTIAL_UID = "plugin::events.event-credential"
const LIBRARY_UID = "api::library.library"
const SYNC_COMMAND_UID = "plugin::events.sync-command"

/** Every field a client of this plugin may see. Never the encrypted ones. */
export const CREDENTIAL_PUBLIC_FIELDS = [
  "documentId",
  "provider",
  "label",
  "scope",
  "status",
  "pausedReason",
  "source",
  "hints",
  "pendingHints",
  "pendingSubmissionDocumentId",
  "submissionDocumentId",
  "lastTestedAt",
  "lastTestResult",
  "pendingTestedAt",
  "pendingTestResult",
  "lastVerifiedAt",
  "lastSyncAt",
  "lastSyncStatus",
  "lastErrorCode",
  "lastErrorMessage",
  "consecutiveFailures",
  "createdAt",
  "updatedAt",
] as const

const LIBRARIES_POPULATE = {
  libraries: { fields: ["name", "entityRef", "documentId", "slug"] },
}

const libraryIdsOf = (credential: any): string[] =>
  ((credential?.libraries as any[] | undefined) ?? [])
    .map((l: any) => l?.documentId as string | undefined)
    .filter((id): id is string => typeof id === "string" && id.length > 0)

function checkValues(
  provider: unknown,
  values: unknown
): Record<string, string> {
  const r = validateFeedValues(provider, values)
  if (!r.ok)
    throw Object.assign(new Error(r.error), { status: 400, field: r.field })

  return r.values
}

type Deps = {
  strapi: any
  testFeed?: (
    provider: string,
    values: Record<string, string>
  ) => Promise<{ result: FeedTestCode; detail?: string }>
}

export default ({ strapi, testFeed = realTestFeed }: Deps) => {
  const documents = () => strapi.documents(CREDENTIAL_UID)

  async function readOne(documentId: string, extra: string[] = []) {
    return documents().findOne({
      documentId,
      fields: [...CREDENTIAL_PUBLIC_FIELDS, ...extra],
      populate: LIBRARIES_POPULATE,
    })
  }

  /**
   * Recompute `library.hasActiveFeed` for the given libraries only: one
   * query for the active credentials linked to them, in chunks of 500 ids,
   * then a scalar write on every version of each library (draft and
   * published) without publishing anything else.
   */
  async function syncLibraryFeedFlags(
    libraryDocumentIds: Iterable<string>
  ): Promise<void> {
    const ids = [...new Set(libraryDocumentIds)]
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500)
      const active = (await documents().findMany({
        filters: {
          status: "active",
          libraries: { documentId: { $in: chunk } },
        },
        fields: ["documentId"],
        populate: { libraries: { fields: ["documentId"] } },
        limit: 500 * 5,
      })) as any[]
      const fed = new Set(active.flatMap(libraryIdsOf))
      const on = chunk.filter((id) => fed.has(id))
      const off = chunk.filter((id) => !fed.has(id))
      for (const [value, subset] of [
        [true, on],
        [false, off],
      ] as const) {
        if (subset.length === 0) continue
        await strapi.db.query(LIBRARY_UID).updateMany({
          where: { documentId: { $in: subset } },
          data: { hasActiveFeed: value },
        })
      }
    }
  }

  async function queueSync(
    credentialDocumentId?: string,
    requestedByUserId?: string
  ) {
    await strapi.documents(SYNC_COMMAND_UID).create({
      data: {
        requestedAt: new Date().toISOString(),
        requestedByUserId,
        credentialDocumentId,
      },
    })
  }

  return {
    syncLibraryFeedFlags,
    queueSync,

    /** Strapi admin only: adds who connected each feed (a private field). */
    async findAll() {
      return documents().findMany({
        fields: [...CREDENTIAL_PUBLIC_FIELDS, "connectedBy"],
        populate: LIBRARIES_POPULATE,
        sort: ["id:asc"],
        limit: 500,
      })
    },

    findOne: (documentId: string) => readOne(documentId),

    async create(
      data: {
        provider: string
        label: string
        scope: "library" | "group"
        status?: "active" | "paused"
        libraryDocumentIds?: string[]
        credentials: unknown
      },
      actor: string
    ) {
      const values = checkValues(data.provider, data.credentials)
      const provider = data.provider as EventProviderKey
      const libraryDocumentIds = data.libraryDocumentIds ?? []

      return strapi.db.transaction(async () => {
        // The blob is bound to the documentId, which Strapi assigns on
        // create: write a placeholder, then seal under the real id.
        const created = await documents().create({
          data: {
            provider,
            label: data.label.trim().slice(0, 200),
            scope: data.scope,
            status: data.status ?? "active",
            ...(data.status === "paused" ? { pausedReason: "admin" } : {}),
            source: "admin",
            connectedBy: actor,
            credentialsEncrypted: "{}",
            hints: feedHints(provider, values),
            ...(libraryDocumentIds.length
              ? {
                  libraries: libraryDocumentIds.map((documentId) => ({
                    documentId,
                  })),
                }
              : {}),
          },
        })
        await documents().update({
          documentId: created.documentId,
          data: {
            credentialsEncrypted: sealValues(
              values,
              created.documentId,
              "current"
            ),
          },
        })
        await recordCredentialEvent(strapi, {
          credentialDocumentId: created.documentId,
          provider,
          libraryDocumentIds,
          action: "admin_created",
          actor,
        })
        await syncLibraryFeedFlags(libraryDocumentIds)

        return readOne(created.documentId)
      })
    },

    async update(
      documentId: string,
      data: {
        label?: string
        status?: "active" | "paused"
        libraryDocumentIds?: string[]
        credentials?: unknown
      },
      actor: string
    ) {
      const before = await readOne(documentId)
      if (!before) return null
      const patch: Record<string, unknown> = {}
      if (data.label != null) patch.label = data.label.trim().slice(0, 200)
      if (data.status === "active")
        Object.assign(patch, { status: "active", pausedReason: null })
      if (data.status === "paused")
        Object.assign(patch, { status: "paused", pausedReason: "admin" })
      if (data.credentials != null) {
        const values = checkValues(before.provider, data.credentials)
        patch.credentialsEncrypted = sealValues(values, documentId, "current")
        patch.hints = feedHints(before.provider, values)
        patch.consecutiveFailures = 0
      }
      if (data.libraryDocumentIds != null)
        patch.libraries = data.libraryDocumentIds.map((id) => ({
          documentId: id,
        }))

      return strapi.db.transaction(async () => {
        await documents().update({ documentId, data: patch })
        const after = await readOne(documentId)
        await recordCredentialEvent(strapi, {
          credentialDocumentId: documentId,
          provider: before.provider,
          libraryDocumentIds: libraryIdsOf(after),
          action: "admin_updated",
          actor,
          note:
            Object.keys(patch)
              .filter((k) => k !== "credentialsEncrypted")
              .join(", ") +
            (patch.credentialsEncrypted
              ? (Object.keys(patch).length > 1 ? ", " : "") + "values"
              : ""),
        })
        await syncLibraryFeedFlags([
          ...libraryIdsOf(before),
          ...libraryIdsOf(after),
        ])

        return after
      })
    },

    async delete(documentId: string, actor: string) {
      const before = await readOne(documentId)
      if (!before) return null

      return strapi.db.transaction(async () => {
        await strapi.db
          .query("plugin::events.event")
          .deleteMany({ where: { credentialId: before.id } })
        await documents().delete({ documentId })
        await recordCredentialEvent(strapi, {
          credentialDocumentId: documentId,
          provider: before.provider,
          libraryDocumentIds: libraryIdsOf(before),
          action: "admin_deleted",
          actor,
        })
        await syncLibraryFeedFlags(libraryIdsOf(before))

        return before
      })
    },

    /** Tests a stored slot in-process and records the result code. */
    async test(
      documentId: string,
      slot: Slot,
      actor: string
    ): Promise<{ result: FeedTestCode } | null> {
      const row = await documents().findOne({
        documentId,
        fields: [
          "documentId",
          "provider",
          "credentialsEncrypted",
          "pendingCredentialsEncrypted",
        ],
      })
      if (!row) return null
      const blob =
        slot === "current"
          ? row.credentialsEncrypted
          : row.pendingCredentialsEncrypted
      if (!blob) return null
      let outcome: { result: FeedTestCode; detail?: string }
      try {
        outcome = await testFeed(
          row.provider,
          openValues(blob, documentId, slot)
        )
      } catch {
        outcome = { result: "decrypt_failed" }
      }
      const at = new Date().toISOString()
      await documents().update({
        documentId,
        data:
          slot === "current"
            ? { lastTestedAt: at, lastTestResult: outcome.result }
            : { pendingTestedAt: at, pendingTestResult: outcome.result },
      })
      await recordCredentialEvent(strapi, {
        credentialDocumentId: documentId,
        provider: row.provider,
        action: "tested",
        actor,
        resultCode: outcome.result,
        note: slot,
      })

      return { result: outcome.result }
    },

    /** Strapi admin only (`reveal-credentials`); every call is logged. */
    async reveal(
      documentId: string,
      slot: Slot,
      actor: string
    ): Promise<Record<string, string> | null> {
      const row = await documents().findOne({
        documentId,
        fields: [
          "documentId",
          "provider",
          "credentialsEncrypted",
          "pendingCredentialsEncrypted",
        ],
      })
      const blob =
        slot === "current"
          ? row?.credentialsEncrypted
          : row?.pendingCredentialsEncrypted
      if (!row || !blob) return null
      const values = openValues(blob, documentId, slot)
      await recordCredentialEvent(strapi, {
        credentialDocumentId: documentId,
        provider: row.provider,
        action: "revealed",
        actor,
        note: slot,
      })

      return values
    },
  }
}
```

The `deleteMany` on `plugin::events.event` is sanctioned (Global Constraints): Events are worker-written derived rows. The plugin `services/index.ts` keeps `credentials` as the key. The factory signature `({ strapi })` still works with Strapi's service loader, because `testFeed` defaults.

- [ ] **Step 5: Add the Strapi dependency and run the tests**

Add `"@repo/event-providers": "workspace:*"` to `apps/strapi/package.json` dependencies, then:

Run: `pnpm install && pnpm --filter @repo/event-providers build && cd apps/strapi && pnpm vitest run tests/events`
Expected: PASS. If the fake Strapi doesn't match the relation filter `libraries: { documentId: { $in } }`, extend `tests/helpers/fake-strapi.ts`'s `match` so that a filter on an array-valued relation matches when any element matches the nested filter. Add a two-line test of that to `tests/content-moderation/helpers.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add apps/strapi/src/plugins/events apps/strapi/tests/events apps/strapi/tests/helpers/fake-strapi.ts apps/strapi/tests/content-moderation/helpers.test.ts apps/strapi/package.json pnpm-lock.yaml
git commit -m "feat(events): slot encryption, audit log, reveal and an index-bounded feed flag"
```

### Task 5: Admin routes and admin UI

**Files:**

- Modify: `apps/strapi/src/plugins/events/server/routes/admin.ts`
- Modify: `apps/strapi/src/plugins/events/server/controllers/admin.ts`
- Modify: `apps/strapi/src/plugins/events/admin/src/components/CredentialForm.tsx`, `CredentialList.tsx`
- Create: `apps/strapi/src/plugins/events/admin/src/components/RevealCredentialButton.tsx`
- Test: `apps/strapi/tests/events/admin-routes.test.ts` (extend), `apps/strapi/tests/events/admin-controller.test.ts` (new)

**Interfaces:**

- Consumes: the credentials service (Task 4).
- Produces: `POST /events/admin/credentials/:documentId/reveal` with body `{ slot: "current" | "pending" }` and response `{ data: Record<string,string> }` (no-store), gated by `plugin::events.reveal-credentials`. `RevealCredentialButton` with props `{ documentId: string; slot: "current" | "pending" }`, which Task 11 reuses.

- [ ] **Step 1: Write the failing tests**

Extend `tests/events/admin-routes.test.ts` (it already asserts the policies per route):

```ts
it("gates reveal behind its own permission", () => {
  const route = routes.find(
    (r: any) => r.path === "/admin/credentials/:documentId/reveal"
  )
  expect(route.method).toBe("POST")
  expect(route.config.policies[1].config.actions).toEqual([
    "plugin::events.reveal-credentials",
  ])
})
```

```ts
// apps/strapi/tests/events/admin-controller.test.ts
import { describe, expect, it, vi } from "vitest"

import adminController from "../../src/plugins/events/server/controllers/admin"

const ctxOf = (over: any = {}) => ({
  params: { documentId: "cred00000000000000000001" },
  request: { body: {} },
  state: { user: { id: 9 } },
  set: vi.fn(),
  ...over,
})

function strapiWith(service: any) {
  return { plugin: () => ({ service: () => service }) } as any
}

describe("events admin controller", () => {
  it("reveals one slot with no-store and the admin as actor", async () => {
    const service = { reveal: vi.fn(async () => ({ apiKey: "v" })) }
    const ctx: any = ctxOf({ request: { body: { slot: "pending" } } })
    await adminController({ strapi: strapiWith(service) }).revealCredential(ctx)
    expect(service.reveal).toHaveBeenCalledWith(
      "cred00000000000000000001",
      "pending",
      "admin:9"
    )
    expect(ctx.set).toHaveBeenCalledWith("Cache-Control", "no-store")
    expect(ctx.body).toEqual({ data: { apiKey: "v" } })
  })

  it("refuses an unknown slot", async () => {
    const ctx: any = ctxOf({ request: { body: { slot: "other" } } })
    await adminController({ strapi: strapiWith({}) }).revealCredential(ctx)
    expect(ctx.status).toBe(400)
  })

  it("tests in-process and never calls a worker", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const service = { test: vi.fn(async () => ({ result: "ok" })) }
    const ctx: any = ctxOf()
    await adminController({ strapi: strapiWith(service) }).testCredential(ctx)
    expect(ctx.body).toEqual({ result: "ok" })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
```

Run: `cd apps/strapi && pnpm vitest run tests/events/admin-routes.test.ts tests/events/admin-controller.test.ts`
Expected: FAIL.

- [ ] **Step 2: Add the route and rewrite the controller's credential actions**

In `routes/admin.ts`, widen the type to `"read" | "manage-credentials" | "review" | "reveal-credentials"` and add:

```ts
{
  method: "POST",
  path: "/admin/credentials/:documentId/reveal",
  handler: "admin.revealCredential",
  config: { policies: can("reveal-credentials") },
},
```

In `controllers/admin.ts`, replace `listCredentials`, `createCredential`, `updateCredential`, `deleteCredential` and `testCredential`:

```ts
const adminActor = (ctx: any) => `admin:${ctx.state?.user?.id ?? "unknown"}`
const SLOTS = new Set(["current", "pending"])
const credentials = (strapi: any) => strapi.plugin("events").service("credentials")

function badRequest(ctx: any, err: any) {
  ctx.status = err?.status === 400 ? 400 : 500
  ctx.body = { error: err?.status === 400 ? err.message : "Couldn't save the credential", field: err?.field }
}

// inside the returned object:
async listCredentials(ctx: any) {
  ctx.body = await credentials(strapi).findAll()
},

async createCredential(ctx: any) {
  const { provider, label, scope, status, libraryDocumentIds, credentials: values } =
    (ctx.request.body ?? {}) as Record<string, any>
  try {
    ctx.body = await credentials(strapi).create(
      { provider, label: String(label ?? ""), scope: scope === "group" ? "group" : "library", status, libraryDocumentIds, credentials: values },
      adminActor(ctx)
    )
  } catch (err) {
    badRequest(ctx, err)
  }
},

async updateCredential(ctx: any) {
  const { label, status, libraryDocumentIds, credentials: values } = (ctx.request.body ?? {}) as Record<string, any>
  try {
    const result = await credentials(strapi).update(
      ctx.params.documentId,
      { label, status: status === "active" || status === "paused" ? status : undefined, libraryDocumentIds, credentials: values },
      adminActor(ctx)
    )
    if (!result) { ctx.status = 404; return }
    ctx.body = result
  } catch (err) {
    badRequest(ctx, err)
  }
},

async deleteCredential(ctx: any) {
  await credentials(strapi).delete(ctx.params.documentId, adminActor(ctx))
  ctx.status = 204
},

async testCredential(ctx: any) {
  const slot = ctx.request?.body?.slot === "pending" ? "pending" : "current"
  const r = await credentials(strapi).test(ctx.params.documentId, slot, adminActor(ctx))
  if (!r) { ctx.status = 404; ctx.body = { error: "Nothing to test" }; return }
  ctx.body = r
},

async revealCredential(ctx: any) {
  const slot = ctx.request?.body?.slot
  if (!SLOTS.has(slot)) { ctx.status = 400; ctx.body = { error: "slot must be current or pending" }; return }
  ctx.set("Cache-Control", "no-store")
  const data = await credentials(strapi).reveal(ctx.params.documentId, slot, adminActor(ctx))
  if (!data) { ctx.status = 404; ctx.body = { error: "No value in that slot" }; return }
  ctx.body = { data }
},
```

Delete every remaining use of `WORKER_SECRET` from Strapi: `grep -rn WORKER_SECRET apps/strapi` (the controller and `.env.example`). `WORKER_URL` stays for `/health`.

Run the two tests. Expected: PASS.

- [ ] **Step 3: Rebuild the admin form from the registry**

In `CredentialForm.tsx`:

- Delete the local `PROVIDER_FIELDS` and `PROVIDERS`.
- Import `EVENT_PROVIDERS` and `EVENT_PROVIDER_KEYS` from `@repo/shared-data`.
- Build the provider select from `EVENT_PROVIDER_KEYS.map((k) => ({ value: k, label: EVENT_PROVIDERS[k].label }))` and the fields from `EVENT_PROVIDERS[provider].fields`. Secret fields render a `type="password"` TextInput with `autoComplete="new-password"`.
- When editing, show each field's stored hint as its placeholder and send `credentials` only when at least one field was typed.
- Replace the Active toggle with a SingleSelect of `active` and `paused`.

In `CredentialList.tsx`, add columns:

- Status: Badge text `Active`, `Paused (reason)`, `Waiting for review` or `Draft`;
- Source: `Library` or `Admin`;
- Pending replacement: "Yes" when `pendingSubmissionDocumentId` is set;
- Last test: `FEED_TEST_LABEL[lastTestResult]` and the date.

Each row's actions gain a `RevealCredentialButton` for the current slot, plus one for the pending slot when `pendingHints` is set.

```tsx
// apps/strapi/src/plugins/events/admin/src/components/RevealCredentialButton.tsx
import { Box, Button, Dialog, Typography } from "@strapi/design-system"
import { useFetchClient, useRBAC } from "@strapi/strapi/admin"
import { useState } from "react"

const PERMISSIONS = [
  { action: "plugin::events.reveal-credentials", subject: null },
]

/**
 * Reveals one stored value for an admin with "Reveal event credentials".
 * The values live in component state only while the dialog is open, and
 * every reveal is logged server-side.
 */
export function RevealCredentialButton({
  documentId,
  slot,
}: {
  documentId: string
  slot: "current" | "pending"
}) {
  const { allowedActions } = useRBAC({ reveal: PERMISSIONS } as any)
  const { post } = useFetchClient()
  const [values, setValues] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!(allowedActions as any).canReveal) return null

  const reveal = async () => {
    setError(null)
    try {
      const { data } = await post(
        `/events/admin/credentials/${documentId}/reveal`,
        { slot }
      )
      setValues((data as any).data)
    } catch {
      setError("Couldn't reveal the value.")
    }
  }

  return (
    <Dialog.Root
      onOpenChange={(open: boolean) => {
        if (!open) setValues(null)
      }}
    >
      <Dialog.Trigger>
        <Button variant="tertiary" size="S" onClick={reveal}>
          {slot === "current" ? "Reveal value" : "Reveal new value"}
        </Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>Credential value</Dialog.Header>
        <Dialog.Body>
          <Box>
            {error ? (
              <Typography textColor="danger600">{error}</Typography>
            ) : null}
            {values
              ? Object.entries(values).map(([k, v]) => (
                  <Box key={k} paddingBottom={2}>
                    <Typography variant="sigma">{k}</Typography>
                    <Typography
                      tag="p"
                      style={{
                        wordBreak: "break-all",
                        fontFamily: "monospace",
                      }}
                    >
                      {v}
                    </Typography>
                  </Box>
                ))
              : !error && <Typography>Loading…</Typography>}
            <Typography variant="pi" textColor="neutral600">
              This reveal was logged with your name.
            </Typography>
          </Box>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Cancel>
            <Button variant="tertiary">Close</Button>
          </Dialog.Cancel>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  )
}
```

Before relying on it, check the `useRBAC` signature against an existing admin usage (`grep -rn useRBAC apps/strapi/src/plugins`) and match it. The permission key in the returned `allowedActions` is `canReveal`.

- [ ] **Step 4: Build the plugins and run the events tests**

Run: `pnpm --filter @repo/strapi build:plugins && cd apps/strapi && pnpm vitest run tests/events`
Expected: the build succeeds and the tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/plugins/events apps/strapi/tests/events apps/strapi/.env.example
git commit -m "feat(events): admin reveal, in-process tests and registry-driven credential form"
```

---

## Phase C and D: Submission type, feed API and moderation

### Task 6: `event_feed` in `@repo/access` and the submission schema

**Files:**

- Modify: `packages/access/src/capabilities.ts` (`SUBMISSION_TYPES`, `QUEUE_OF_SUBMISSION_TYPE`, `canSubmit`)
- Modify: `packages/access/tests/capabilities.test.ts`, `packages/access/tests/moderation.test.ts:112-121`
- Modify: `apps/strapi/src/plugins/content-moderation/server/content-types/submission/schema.json` (`submissionType` enum)
- Modify: `apps/strapi/src/plugins/content-moderation/server/controllers/submission.ts` (`create` refuses `event_feed`)
- Test: `apps/strapi/tests/content-moderation/policy.test.ts` (extend)

**Interfaces:**

- Produces: `SubmissionType` includes `"event_feed"`; `QUEUE_OF_SUBMISSION_TYPE.event_feed === "index"`; `canSubmit(c, "event_feed", { libraryDocumentId })` is true only with `events.feed` and the library claimed.

- [ ] **Step 1: Write the failing tests**

In `packages/access/tests/capabilities.test.ts`, next to the `library_edit` claim test:

```ts
it("allows event_feed only for a claimed library", () => {
  const c = resolveCapabilities({
    signedIn: true,
    grants: [],
    claims: [{ libraryDocumentId: "lib1" }],
  })
  expect(canSubmit(c, "event_feed", { libraryDocumentId: "lib1" })).toBe(true)
  expect(canSubmit(c, "event_feed", { libraryDocumentId: "lib2" })).toBe(false)
  expect(canSubmit(c, "event_feed")).toBe(false)
  const reader = resolveCapabilities({ signedIn: true, grants: [], claims: [] })
  expect(canSubmit(reader, "event_feed", { libraryDocumentId: "lib1" })).toBe(
    false
  )
})
```

In `packages/access/tests/moderation.test.ts`, change the `index` queue's expected list to include `"event_feed"` (six types; rename the test "lists the six index types").

In `apps/strapi/tests/content-moderation/policy.test.ts`, add a controller-level test that `POST /submissions` with `submissionType: "event_feed"` answers 400 with `name: "use_event_feed_endpoint"`. Use the same controller harness the file already uses for `create`.

Run: `cd packages/access && pnpm test`
Expected: FAIL.

- [ ] **Step 2: Implement**

In `capabilities.ts`: add `"event_feed"` to `SUBMISSION_TYPES` (after `"library_edit"`), add `event_feed: "index"` to `QUEUE_OF_SUBMISSION_TYPE`, and add to `canSubmit`:

```ts
case "event_feed":
  return (
    c.set.has("events.feed") &&
    !!opts.libraryDocumentId &&
    c.claimedLibraryIds.has(opts.libraryDocumentId)
  )
```

In the submission `schema.json`, add `"event_feed"` to the `submissionType` enum.

In `controllers/submission.ts` `create`, right after the `if (!submissionType)` guard:

```ts
// Event Feed submissions carry a reference to an encrypted credential and
// are created only by the events plugin (POST /api/events/feeds), never
// from a client body.
if (submissionType === "event_feed") {
  ctx.status = 400
  ctx.body = {
    error: {
      status: 400,
      name: "use_event_feed_endpoint",
      message: "Connect an event feed from the event feeds page.",
    },
  }

  return
}
```

- [ ] **Step 3: Rebuild and run the tests**

Run: `pnpm --filter @repo/access build && (cd packages/access && pnpm test) && cd apps/strapi && pnpm strapi ts:generate-types && pnpm vitest run tests/content-moderation/policy.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/access apps/strapi/src/plugins/content-moderation/server/content-types/submission/schema.json apps/strapi/src/plugins/content-moderation/server/controllers/submission.ts apps/strapi/tests/content-moderation/policy.test.ts apps/strapi/types/generated
git commit -m "feat(access): add the event_feed submission type to the index queue"
```

### Task 7: Feed service: access, list, test, connect, replace

**Files:**

- Create: `apps/strapi/src/plugins/events/server/utils/feed-access.ts`
- Create: `apps/strapi/src/plugins/events/server/services/feeds.ts`
- Modify: `apps/strapi/src/plugins/events/server/services/index.ts`
- Test: `apps/strapi/tests/events/feeds.test.ts` (new)

**Interfaces:**

- Consumes: `loadCapabilities(baUserId)` from the content-moderation `submission-policy` service; `check(...)` from the same service; the submission service's `create(...)`; credentials helpers (Task 4); the registry (Task 1).
- Produces (`strapi.plugin("events").service("feeds")`):
  - `type FeedUser = { id: string; email: string | null; name: string | null }`
  - `type FeedError = { error: { status: number; name: string; message: string; field?: string; result?: FeedTestCode } }`
  - `list(user: FeedUser): Promise<{ libraries: LibraryFeeds[] }>`
  - `testValues(user, input: { libraryDocumentId: string; provider: string; values: unknown }): Promise<{ result: FeedTestCode } | FeedError>`
  - `connect(user, input: { libraryDocumentId: string; provider: string; values: unknown }): Promise<{ credentialDocumentId: string; submissionDocumentId: string; result: FeedTestCode } | FeedError>`
  - `replace(user, documentId: string, input: { values: unknown }): Promise<{ submissionDocumentId: string; result: FeedTestCode } | FeedError>`
  - Task 8 adds `testCurrent`, `pause`, `resume`, `withdrawPending`, `disconnect`; Task 9 adds `approveSubmission` and `rejectSubmission`.
  - `type LibraryFeeds = { library: { documentId: string; name: string; slug: string | null }; feeds: FeedView[] }`
  - `type FeedView = { documentId; provider; label; scope; status; pausedReason; managedBy: "library" | "admin_group"; hints; pendingHints; review: { submissionDocumentId: string; kind: "connect" | "replace"; status: string; note: string | null } | null; lastTestedAt; lastTestResult; lastSyncAt; lastSyncStatus; lastErrorCode; upcomingEvents: number }`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/strapi/tests/events/feeds.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

import feedsFactory from "../../src/plugins/events/server/services/feeds"
import credentialsFactory from "../../src/plugins/events/server/services/credentials"
import { openValues } from "../../src/plugins/events/server/utils/credential-crypto"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const CRED = "plugin::events.event-credential"
const EVENTS = "plugin::events.credential-event"
const SUB = "plugin::content-moderation.submission"
const LIB = "api::library.library"
const L1 = "lib00000000000000000001"
const L2 = "lib00000000000000000002"
const USER = { id: "ba-owner", email: "o@lib.example", name: "Owner" }

beforeEach(() => {
  process.env.EVENTS_CREDENTIAL_KEY = "c".repeat(64)
})

function setup(opts: { claims?: string[]; test?: string; policy?: any } = {}) {
  const fake = makeFakeStrapi({
    [LIB]: [
      {
        documentId: L1,
        name: "Central Library",
        slug: "central",
        hasActiveFeed: false,
      },
      {
        documentId: L2,
        name: "Other Library",
        slug: "other",
        hasActiveFeed: false,
      },
    ],
    [CRED]: [],
    [EVENTS]: [],
    [SUB]: [],
    "plugin::events.sync-command": [],
    "plugin::events.event": [],
  })
  const { strapi } = fake
  const testFeed = vi.fn(async () => ({ result: (opts.test ?? "ok") as any }))
  const credentials = credentialsFactory({ strapi, testFeed })
  const claims = new Set(opts.claims ?? [L1])
  const policy = {
    loadCapabilities: vi.fn(async () => ({
      caps: {
        claimedLibraryIds: claims,
        set: new Set(claims.size ? ["events.feed"] : []),
      },
    })),
    check: vi.fn(async () => opts.policy ?? { ok: true }),
  }
  const submissions = {
    create: vi.fn(async (data: any) => {
      const doc = await strapi
        .documents(SUB)
        .create({ data: { ...data, status: "pending" } })
      return doc
    }),
  }
  strapi.plugin = vi.fn((name: string) => ({
    service: (s: string) =>
      name === "events" && s === "credentials"
        ? credentials
        : s === "submission-policy"
          ? policy
          : s === "submission"
            ? submissions
            : undefined,
  }))
  const feeds = feedsFactory({ strapi, testFeed })

  return { ...fake, feeds, policy, submissions, testFeed }
}

const ICAL = { feedUrl: "https://cal.example.org/private/tok123456/basic.ics" }

describe("feeds.connect", () => {
  it("stores the value encrypted on a pending row and opens a Submission without it", async () => {
    const { feeds, store } = setup()
    const r: any = await feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    expect(r.result).toBe("ok")
    const row = store[CRED]![0]!
    expect(row).toMatchObject({
      status: "pending",
      source: "library",
      connectedBy: "ba:ba-owner",
      scope: "library",
    })
    expect(
      openValues(row.credentialsEncrypted, row.documentId, "current")
    ).toEqual(ICAL)
    expect(row.pendingSubmissionDocumentId).toBe(r.submissionDocumentId)
    const sub = store[SUB]![0]!
    expect(sub.submissionType).toBe("event_feed")
    expect(sub.targetDocumentId).toBe(L1)
    expect(JSON.stringify(sub)).not.toContain("tok123456")
    expect(sub.fields).toMatchObject({
      kind: "connect",
      credentialDocumentId: row.documentId,
      provider: "ical",
      hints: { feedUrl: "https://cal.example.org/…" },
      test: { result: "ok" },
    })
    expect(store[EVENTS]!.map((e) => e.action)).toEqual(["connect_submitted"])
  })

  it("refuses a library the user hasn't claimed, with 404", async () => {
    const { feeds, store } = setup()
    const r: any = await feeds.connect(USER, {
      libraryDocumentId: L2,
      provider: "ical",
      values: ICAL,
    })
    expect(r.error.status).toBe(404)
    expect(store[CRED]).toHaveLength(0)
  })

  it("refuses a blocking test result and stores nothing", async () => {
    const { feeds, store } = setup({ test: "auth_failed" })
    const r: any = await feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    expect(r.error).toMatchObject({
      status: 422,
      name: "test_failed",
      result: "auth_failed",
    })
    expect(store[CRED]).toHaveLength(0)
    expect(store[SUB]).toHaveLength(0)
  })

  it("lets a transient failure through and records it", async () => {
    const { feeds, store } = setup({ test: "unreachable" })
    const r: any = await feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    expect(r.result).toBe("unreachable")
    expect(store[SUB]![0]!.fields.test.result).toBe("unreachable")
  })

  it("refuses invalid values before testing", async () => {
    const { feeds, testFeed } = setup()
    const r: any = await feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: { feedUrl: "nope" },
    })
    expect(r.error).toMatchObject({ status: 400, field: "feedUrl" })
    expect(testFeed).not.toHaveBeenCalled()
  })

  it("passes the policy's refusal through (quota, tier)", async () => {
    const { feeds } = setup({
      policy: { ok: false, status: 429, message: "Too many pending" },
    })
    const r: any = await feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    expect(r.error.status).toBe(429)
  })

  it("refuses a sixth feed on one library and a fourth open feed submission", async () => {
    const { feeds, store } = setup()
    for (let i = 0; i < 5; i++)
      store[CRED]!.push({
        documentId: `credX00000000000000000${i}`,
        provider: "ical",
        status: "active",
        scope: "library",
        libraries: [{ documentId: L1 }],
      } as any)
    const r: any = await feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    expect(r.error).toMatchObject({ status: 409, name: "too_many_feeds" })
  })
})

describe("feeds.replace", () => {
  async function connected() {
    const s = setup()
    const r: any = await s.feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    const row = s.store[CRED]![0]!
    Object.assign(row, {
      status: "active",
      pendingSubmissionDocumentId: null,
      submissionDocumentId: r.submissionDocumentId,
    })

    return { ...s, row }
  }

  it("writes the pending slot and keeps the current value", async () => {
    const { feeds, row, store } = await connected()
    const current = row.credentialsEncrypted
    const next = {
      feedUrl: "https://cal.example.org/private/new999999/basic.ics",
    }
    const r: any = await feeds.replace(USER, row.documentId, { values: next })
    expect(row.credentialsEncrypted).toBe(current)
    expect(
      openValues(row.pendingCredentialsEncrypted, row.documentId, "pending")
    ).toEqual(next)
    expect(row.pendingSubmissionDocumentId).toBe(r.submissionDocumentId)
    expect(store[SUB]!.at(-1)!.fields).toMatchObject({
      kind: "replace",
      previousHints: row.hints,
    })
  })

  it("refuses a second pending replacement", async () => {
    const { feeds, row } = await connected()
    await feeds.replace(USER, row.documentId, { values: ICAL })
    const r: any = await feeds.replace(USER, row.documentId, { values: ICAL })
    expect(r.error).toMatchObject({ status: 409, name: "replacement_pending" })
  })

  it("answers 404 to someone without a claim on the feed's library", async () => {
    const { feeds, row, policy } = await connected()
    policy.loadCapabilities.mockResolvedValueOnce({
      caps: { claimedLibraryIds: new Set([L2]), set: new Set(["events.feed"]) },
    })
    const r: any = await feeds.replace(USER, row.documentId, { values: ICAL })
    expect(r.error.status).toBe(404)
  })

  it("refuses group feeds", async () => {
    const { feeds, row } = await connected()
    row.scope = "group"
    const r: any = await feeds.replace(USER, row.documentId, { values: ICAL })
    expect(r.error).toMatchObject({ status: 403, name: "group_feed" })
  })
})

describe("feeds.list", () => {
  it("lists each claimed library with its feeds, without encrypted fields", async () => {
    const { feeds } = setup()
    await feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    const r = await feeds.list(USER)
    expect(r.libraries).toHaveLength(1)
    expect(r.libraries[0]!.library.name).toBe("Central Library")
    const feed: any = r.libraries[0]!.feeds[0]
    expect(feed.status).toBe("pending")
    expect(feed.review).toMatchObject({ kind: "connect", status: "pending" })
    expect(JSON.stringify(r)).not.toMatch(/credentialsEncrypted|connectedBy/)
  })
})
```

Run: `cd apps/strapi && pnpm vitest run tests/events/feeds.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 2: Write `feed-access.ts`**

```ts
// apps/strapi/src/plugins/events/server/utils/feed-access.ts
/**
 * The libraries a Better Auth user holds a Library Claim on, re-read on
 * every feed request from their affiliations (the same rule the submission
 * policy uses: proposer affiliations don't count).
 */
export async function claimedLibraryIds(
  strapi: any,
  baUserId: string
): Promise<Set<string>> {
  const { caps } = await strapi
    .plugin("content-moderation")
    .service("submission-policy")
    .loadCapabilities(baUserId)
  if (!caps?.set?.has?.("events.feed")) return new Set()

  return new Set(caps.claimedLibraryIds as Iterable<string>)
}
```

- [ ] **Step 3: Write `services/feeds.ts` (list, testValues, connect, replace)**

```ts
// apps/strapi/src/plugins/events/server/services/feeds.ts
import { testFeed as realTestFeed } from "@repo/event-providers"
import {
  EVENT_PROVIDERS,
  type EventProviderKey,
  FEED_TEST_BLOCKING,
  FEED_TEST_COOLDOWN_MS,
  feedHints,
  type FeedTestCode,
  MAX_FEEDS_PER_LIBRARY,
  MAX_OPEN_FEED_SUBMISSIONS,
  validateFeedValues,
} from "@repo/shared-data"

import { CREDENTIAL_PUBLIC_FIELDS, CREDENTIAL_UID } from "./credentials"
import { sealValues } from "../utils/credential-crypto"
import { recordCredentialEvent } from "../utils/credential-events"
import { claimedLibraryIds } from "../utils/feed-access"

const SUBMISSION_UID = "plugin::content-moderation.submission"
const LIBRARY_UID = "api::library.library"
const EVENT_UID = "plugin::events.event"
const OPEN = ["pending", "needs_info"]

export type FeedUser = { id: string; email: string | null; name: string | null }
export type FeedError = {
  error: {
    status: number
    name: string
    message: string
    field?: string
    result?: FeedTestCode
  }
}
const fail = (
  status: number,
  name: string,
  message: string,
  extra: Record<string, unknown> = {}
): FeedError => ({
  error: { status, name, message, ...extra },
})
const NOT_FOUND = fail(404, "not_found", "Feed not found.")
const actorOf = (user: FeedUser) => `ba:${user.id}`
const libraryIdsOf = (c: any): string[] =>
  ((c?.libraries as any[]) ?? []).map((l) => l?.documentId).filter(Boolean)

type Deps = {
  strapi: any
  testFeed?: (
    provider: string,
    values: Record<string, string>
  ) => Promise<{ result: FeedTestCode; detail?: string }>
}

export default ({ strapi, testFeed = realTestFeed }: Deps) => {
  const creds = () => strapi.documents(CREDENTIAL_UID)
  const credentialsService = () =>
    strapi.plugin("events").service("credentials")
  const policy = () =>
    strapi.plugin("content-moderation").service("submission-policy")
  const submissions = () =>
    strapi.plugin("content-moderation").service("submission")

  /** A feed the user may manage, or a FeedError (404 hides others' feeds). */
  async function manageable(
    user: FeedUser,
    documentId: string
  ): Promise<{ feed: any; claims: Set<string> } | FeedError> {
    const feed = await creds().findOne({
      documentId,
      fields: [...CREDENTIAL_PUBLIC_FIELDS, "id"],
      populate: { libraries: { fields: ["documentId", "name"] } },
    })
    if (!feed) return NOT_FOUND
    const claims = await claimedLibraryIds(strapi, user.id)
    if (!libraryIdsOf(feed).some((id) => claims.has(id))) return NOT_FOUND
    if (feed.scope === "group")
      return fail(403, "group_feed", "Libraries Global manages this feed.")

    return { feed, claims }
  }

  async function checkValues(provider: unknown, values: unknown) {
    const r = validateFeedValues(provider, values)

    return r.ok ? r : fail(400, "invalid_values", r.error, { field: r.field })
  }

  async function runTest(
    provider: string,
    values: Record<string, string>
  ): Promise<FeedTestCode> {
    try {
      return (await testFeed(provider, values)).result
    } catch {
      return "provider_error"
    }
  }

  async function openFeedSubmissions(baUserId: string): Promise<number> {
    return strapi.documents(SUBMISSION_UID).count({
      filters: {
        submittedByUserId: baUserId,
        submissionType: "event_feed",
        status: { $in: OPEN },
      },
    })
  }

  async function createSubmission(
    user: FeedUser,
    libraryDocumentId: string,
    fields: Record<string, unknown>
  ) {
    return submissions().create({
      submissionType: "event_feed",
      targetEntityType: "library",
      targetDocumentId: libraryDocumentId,
      fields,
      submittedByUserId: user.id,
      submittedByEmail: user.email ?? "",
      submittedByName: user.name ?? undefined,
    })
  }

  return {
    async list(user: FeedUser) {
      const claims = [...(await claimedLibraryIds(strapi, user.id))]
      if (claims.length === 0) return { libraries: [] }
      const libraries = (await strapi.documents(LIBRARY_UID).findMany({
        filters: { documentId: { $in: claims } },
        fields: ["documentId", "name", "slug"],
        limit: claims.length,
      })) as any[]
      const feeds = (await creds().findMany({
        filters: { libraries: { documentId: { $in: claims } } },
        fields: [...CREDENTIAL_PUBLIC_FIELDS, "id"],
        populate: { libraries: { fields: ["documentId"] } },
        limit: claims.length * MAX_FEEDS_PER_LIBRARY + 50,
      })) as any[]
      const reviewIds = feeds
        .map((f) => f.pendingSubmissionDocumentId)
        .filter(Boolean)
      const reviews = reviewIds.length
        ? ((await strapi.documents(SUBMISSION_UID).findMany({
            filters: { documentId: { $in: reviewIds } },
            fields: ["documentId", "status", "reviewNote", "fields"],
            limit: reviewIds.length,
          })) as any[])
        : []
      const reviewOf = new Map(reviews.map((r) => [r.documentId, r]))
      const now = new Date().toISOString()
      const upcoming = async (id: number) =>
        strapi
          .documents(EVENT_UID)
          .count({ filters: { credentialId: id, startTime: { $gte: now } } })

      return {
        libraries: await Promise.all(
          libraries.map(async (library) => ({
            library: {
              documentId: library.documentId,
              name: library.name,
              slug: library.slug ?? null,
            },
            feeds: await Promise.all(
              feeds
                .filter((f) => libraryIdsOf(f).includes(library.documentId))
                .map(async (f) => {
                  const r = f.pendingSubmissionDocumentId
                    ? reviewOf.get(f.pendingSubmissionDocumentId)
                    : null

                  return {
                    documentId: f.documentId,
                    provider: f.provider,
                    label: f.label,
                    scope: f.scope,
                    status: f.status,
                    pausedReason: f.pausedReason ?? null,
                    managedBy: f.scope === "group" ? "admin_group" : "library",
                    hints: f.hints ?? {},
                    pendingHints: f.pendingHints ?? null,
                    review: r
                      ? {
                          submissionDocumentId: r.documentId,
                          kind: r.fields?.kind ?? "connect",
                          status: r.status,
                          note: r.reviewNote ?? null,
                        }
                      : null,
                    lastTestedAt: f.lastTestedAt ?? null,
                    lastTestResult: f.lastTestResult ?? null,
                    lastSyncAt: f.lastSyncAt ?? null,
                    lastSyncStatus: f.lastSyncStatus ?? null,
                    lastErrorCode: f.lastErrorCode ?? null,
                    upcomingEvents: await upcoming(f.id),
                  }
                })
            ),
          }))
        ),
      }
    },

    async testValues(
      user: FeedUser,
      input: { libraryDocumentId: string; provider: string; values: unknown }
    ) {
      const claims = await claimedLibraryIds(strapi, user.id)
      if (!claims.has(input.libraryDocumentId)) return NOT_FOUND
      const checked = await checkValues(input.provider, input.values)
      if ("error" in checked) return checked

      return { result: await runTest(input.provider, checked.values) }
    },

    async connect(
      user: FeedUser,
      input: { libraryDocumentId: string; provider: string; values: unknown }
    ) {
      const claims = await claimedLibraryIds(strapi, user.id)
      if (!claims.has(input.libraryDocumentId)) return NOT_FOUND
      const checked = await checkValues(input.provider, input.values)
      if ("error" in checked) return checked
      const provider = input.provider as EventProviderKey

      const verdict = await policy().check({
        baUserId: user.id,
        submissionType: "event_feed",
        targetEntityType: "library",
        targetDocumentId: input.libraryDocumentId,
      })
      if (!verdict.ok)
        return fail(
          verdict.status ?? 403,
          "refused",
          verdict.message ?? "You can't connect a feed here."
        )
      if ((await openFeedSubmissions(user.id)) >= MAX_OPEN_FEED_SUBMISSIONS)
        return fail(
          429,
          "too_many_open",
          "You have feeds waiting for review. Wait for a decision before sending another."
        )
      const onLibrary = await creds().count({
        filters: {
          libraries: { documentId: { $in: [input.libraryDocumentId] } },
        },
      })
      if (onLibrary >= MAX_FEEDS_PER_LIBRARY)
        return fail(
          409,
          "too_many_feeds",
          `A library can have at most ${MAX_FEEDS_PER_LIBRARY} feeds.`
        )

      // Outside the transaction: a provider can take 15 seconds to answer.
      const result = await runTest(provider, checked.values)
      if (FEED_TEST_BLOCKING.has(result))
        return fail(422, "test_failed", "The connection test failed.", {
          result,
        })
      const testedAt = new Date().toISOString()
      const hints = feedHints(provider, checked.values)
      const library = await strapi
        .documents(LIBRARY_UID)
        .findOne({ documentId: input.libraryDocumentId, fields: ["name"] })

      return strapi.db.transaction(async () => {
        const created = await creds().create({
          data: {
            provider,
            label: `${String(library?.name ?? "Library").slice(0, 150)} · ${EVENT_PROVIDERS[provider].label}`,
            scope: "library",
            status: "pending",
            source: "library",
            connectedBy: actorOf(user),
            credentialsEncrypted: "{}",
            hints,
            lastTestedAt: testedAt,
            lastTestResult: result,
            libraries: [{ documentId: input.libraryDocumentId }],
          },
        })
        const documentId = created.documentId as string
        const submission = await createSubmission(
          user,
          input.libraryDocumentId,
          {
            kind: "connect",
            credentialDocumentId: documentId,
            provider,
            hints,
            test: { result, testedAt },
          }
        )
        await creds().update({
          documentId,
          data: {
            credentialsEncrypted: sealValues(
              checked.values,
              documentId,
              "current"
            ),
            pendingSubmissionDocumentId: submission.documentId,
          },
        })
        await recordCredentialEvent(strapi, {
          credentialDocumentId: documentId,
          provider,
          libraryDocumentIds: [input.libraryDocumentId],
          action: "connect_submitted",
          actor: actorOf(user),
          submissionDocumentId: submission.documentId,
          resultCode: result,
        })

        return {
          credentialDocumentId: documentId,
          submissionDocumentId: submission.documentId as string,
          result,
        }
      })
    },

    async replace(
      user: FeedUser,
      documentId: string,
      input: { values: unknown }
    ) {
      const access = await manageable(user, documentId)
      if ("error" in access) return access
      const { feed } = access
      if (feed.status === "pending" || feed.status === "draft")
        return fail(
          409,
          "review_pending",
          "This feed is still waiting for review. Withdraw it and connect again."
        )
      if (feed.pendingSubmissionDocumentId)
        return fail(
          409,
          "replacement_pending",
          "New details are already waiting for review."
        )
      const checked = await checkValues(feed.provider, input.values)
      if ("error" in checked) return checked
      const libraryDocumentId = libraryIdsOf(feed).find((id) =>
        access.claims.has(id)
      )!
      const verdict = await policy().check({
        baUserId: user.id,
        submissionType: "event_feed",
        targetEntityType: "library",
        targetDocumentId: libraryDocumentId,
      })
      if (!verdict.ok)
        return fail(
          verdict.status ?? 403,
          "refused",
          verdict.message ?? "You can't replace this feed."
        )
      if ((await openFeedSubmissions(user.id)) >= MAX_OPEN_FEED_SUBMISSIONS)
        return fail(
          429,
          "too_many_open",
          "You have feeds waiting for review. Wait for a decision before sending another."
        )

      const result = await runTest(feed.provider, checked.values)
      if (FEED_TEST_BLOCKING.has(result))
        return fail(422, "test_failed", "The connection test failed.", {
          result,
        })
      const testedAt = new Date().toISOString()
      const hints = feedHints(feed.provider, checked.values)

      return strapi.db.transaction(async () => {
        const submission = await createSubmission(user, libraryDocumentId, {
          kind: "replace",
          credentialDocumentId: documentId,
          provider: feed.provider,
          hints,
          previousHints: feed.hints ?? {},
          test: { result, testedAt },
        })
        await creds().update({
          documentId,
          data: {
            pendingCredentialsEncrypted: sealValues(
              checked.values,
              documentId,
              "pending"
            ),
            pendingHints: hints,
            pendingTestedAt: testedAt,
            pendingTestResult: result,
            pendingSubmissionDocumentId: submission.documentId,
          },
        })
        await recordCredentialEvent(strapi, {
          credentialDocumentId: documentId,
          provider: feed.provider,
          libraryDocumentIds: libraryIdsOf(feed),
          action: "replace_submitted",
          actor: actorOf(user),
          submissionDocumentId: submission.documentId,
          resultCode: result,
        })

        return { submissionDocumentId: submission.documentId as string, result }
      })
    },
  }
}

export { FEED_TEST_COOLDOWN_MS }
```

The submission row is created first, so its documentId exists before the credential update. If anything in the transaction throws, all of it rolls back. `submissionPending`'s notification is scheduled by `create`; it reads the row later and finds nothing if the transaction rolled back. Confirm `scheduleNotification` defers past the commit (`grep -n "function scheduleNotification" -A 15 apps/strapi/src/plugins/content-moderation/server/services/submission.ts`). If it runs synchronously, pass a new `notify: false` option to `create` and call `notifications(strapi).submissionPending(created)` after the transaction from the feeds service.

Register the service in `services/index.ts`:

```ts
import credentials from "./credentials"
import feeds from "./feeds"
import { computeEventStats } from "./stats"

export default { credentials, feeds, computeEventStats }
```

- [ ] **Step 4: Run the tests**

Run: `cd apps/strapi && pnpm vitest run tests/events/feeds.test.ts`
Expected: PASS. If `count` or relation filters are missing from the fake Strapi, add them there (`count` should apply `match` and return the length).

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/plugins/events apps/strapi/tests/events/feeds.test.ts apps/strapi/tests/helpers/fake-strapi.ts
git commit -m "feat(events): connect and replace event feeds as reviewed submissions"
```

### Task 8: Direct actions and the feed routes

**Files:**

- Modify: `apps/strapi/src/plugins/events/server/services/feeds.ts` (add `testCurrent`, `pause`, `resume`, `withdrawPending`, `disconnect`)
- Create: `apps/strapi/src/plugins/events/server/controllers/feeds.ts`
- Modify: `apps/strapi/src/plugins/events/server/controllers/index.ts`, `routes/content-api.ts` (add routes, delete `credential-submit`)
- Modify: `apps/strapi/src/plugins/events/server/controllers/events.ts` (delete `submitCredential`)
- Test: extend `apps/strapi/tests/events/feeds.test.ts`; create `apps/strapi/tests/events/feeds-controller.test.ts`

**Interfaces:**

- Produces:
  - `testCurrent(user, documentId) → { result } | FeedError`; 429 `too_soon` within `FEED_TEST_COOLDOWN_MS` of `lastTestedAt`
  - `pause(user, documentId) → { status: "paused" } | FeedError`
  - `resume(user, documentId) → { status: "active" } | FeedError`
  - `withdrawPending(user, documentId) → { ok: true } | FeedError`
  - `disconnect(user, documentId) → { ok: true } | FeedError`
  - Content API routes, all `auth: false` with the bridge secret checked in the controller:
    - `GET /feeds`, `GET /feeds/providers`, `POST /feeds/test`, `POST /feeds`
    - `PUT /feeds/:documentId/values`, `POST /feeds/:documentId/test`
    - `POST /feeds/:documentId/pause`, `POST /feeds/:documentId/resume`
    - `DELETE /feeds/:documentId/pending`, `DELETE /feeds/:documentId`

- [ ] **Step 1: Write the failing service tests**

Append to `tests/events/feeds.test.ts`:

```ts
describe("direct actions", () => {
  async function active() {
    const s = setup()
    const r: any = await s.feeds.connect(USER, {
      libraryDocumentId: L1,
      provider: "ical",
      values: ICAL,
    })
    const row = s.store[CRED]![0]!
    Object.assign(row, {
      status: "active",
      pendingSubmissionDocumentId: null,
      id: 42,
    })
    s.store[SUB]![0]!.status = "approved"

    return { ...s, row, sub: r.submissionDocumentId }
  }

  it("pauses and resumes, recomputing the flag and queueing a sync", async () => {
    const { feeds, row, store } = await active()
    expect(await feeds.pause(USER, row.documentId)).toEqual({
      status: "paused",
    })
    expect(row).toMatchObject({ status: "paused", pausedReason: "library" })
    expect(await feeds.resume(USER, row.documentId)).toEqual({
      status: "active",
    })
    expect(
      store["plugin::events.sync-command"]!.at(-1)!.credentialDocumentId
    ).toBe(row.documentId)
    expect(store[EVENTS]!.map((e) => e.action)).toEqual(
      expect.arrayContaining(["paused", "resumed"])
    )
  })

  it("won't resume a feed that is waiting for review", async () => {
    const { feeds, row } = await active()
    Object.assign(row, { status: "pending" })
    expect(await feeds.resume(USER, row.documentId)).toMatchObject({
      error: { status: 409 },
    })
  })

  it("rate-limits tests per feed", async () => {
    const { feeds, row } = await active()
    row.lastTestedAt = new Date().toISOString()
    expect(await feeds.testCurrent(USER, row.documentId)).toMatchObject({
      error: { status: 429, name: "too_soon" },
    })
  })

  it("disconnect deletes the row, its events and rejects an open review", async () => {
    const { feeds, row, store, strapi } = await active()
    await feeds.replace(USER, row.documentId, { values: ICAL })
    store["plugin::events.event"]!.push({
      documentId: "ev1",
      credentialId: 42,
    } as any)
    const updateStatus = vi.fn(async () => ({ data: {} }))
    ;(strapi.plugin as any).mockImplementation((name: string) => ({
      service: (s: string) =>
        s === "credentials"
          ? credentialsFactory({ strapi })
          : s === "submission"
            ? { updateStatus, create: vi.fn() }
            : s === "submission-policy"
              ? {
                  loadCapabilities: async () => ({
                    caps: {
                      claimedLibraryIds: new Set([L1]),
                      set: new Set(["events.feed"]),
                    },
                  }),
                  check: async () => ({ ok: true }),
                }
              : undefined,
    }))
    expect(await feeds.disconnect(USER, row.documentId)).toEqual({ ok: true })
    expect(store[CRED]).toHaveLength(0)
    expect(store["plugin::events.event"]).toHaveLength(0)
    expect(updateStatus).toHaveBeenCalledWith(
      expect.any(String),
      "rejected",
      expect.objectContaining({ kind: "system" }),
      "Withdrawn by the library"
    )
    expect(store[EVENTS]!.at(-1)!.action).toBe("disconnected")
  })

  it("withdrawing a pending replacement clears the slot", async () => {
    const { feeds, row } = await active()
    await feeds.replace(USER, row.documentId, { values: ICAL })
    expect(await feeds.withdrawPending(USER, row.documentId)).toEqual({
      ok: true,
    })
    expect(row.pendingCredentialsEncrypted).toBeNull()
    expect(row.pendingSubmissionDocumentId).toBeNull()
  })
})
```

Run: `cd apps/strapi && pnpm vitest run tests/events/feeds.test.ts`
Expected: FAIL (methods missing).

- [ ] **Step 2: Implement the direct actions**

`withdrawOpenReview` closes a feed's open Submission as the system. Add a `systemReviewer()` beside `adminReviewer` and `contributorReviewer` in `content-moderation/server/utils/reviewer.ts`:

```ts
/** The platform itself, for automatic decisions (a library withdrawing a feed). */
export const systemReviewer = (): Reviewer =>
  ({ id: "system", kind: "system" }) as Reviewer
```

Extend the `Reviewer` type's `kind` union with `"system"`, and the Review Event `reviewerKind` enum with `"system"` if it is an enum (check `review-event/schema.json`). `isSelfReview` must return false for `system`; add a test of that to `tests/content-moderation/review-events.test.ts`.

Add to the object `feeds.ts` returns (and import `systemReviewer` from `../../../content-moderation/server/utils/reviewer`):

```ts
async testCurrent(user: FeedUser, documentId: string) {
  const access = await manageable(user, documentId)
  if ("error" in access) return access
  const last = access.feed.lastTestedAt ? Date.parse(access.feed.lastTestedAt) : 0
  if (Date.now() - last < FEED_TEST_COOLDOWN_MS)
    return fail(429, "too_soon", "Wait half a minute between tests.")
  const r = await credentialsService().test(documentId, "current", actorOf(user))

  return r ?? NOT_FOUND
},

async pause(user: FeedUser, documentId: string) {
  const access = await manageable(user, documentId)
  if ("error" in access) return access
  if (access.feed.status !== "active") return fail(409, "not_active", "Only an active feed can be paused.")
  await strapi.db.transaction(async () => {
    await creds().update({ documentId, data: { status: "paused", pausedReason: "library" } })
    await recordCredentialEvent(strapi, {
      credentialDocumentId: documentId, provider: access.feed.provider,
      libraryDocumentIds: libraryIdsOf(access.feed), action: "paused", actor: actorOf(user),
    })
  })
  await credentialsService().syncLibraryFeedFlags(libraryIdsOf(access.feed))

  return { status: "paused" as const }
},

async resume(user: FeedUser, documentId: string) {
  const access = await manageable(user, documentId)
  if ("error" in access) return access
  if (access.feed.status !== "paused") return fail(409, "not_paused", "Only a paused feed can be resumed.")
  await strapi.db.transaction(async () => {
    await creds().update({ documentId, data: { status: "active", pausedReason: null, consecutiveFailures: 0, autoPauseNotifiedAt: null } })
    await recordCredentialEvent(strapi, {
      credentialDocumentId: documentId, provider: access.feed.provider,
      libraryDocumentIds: libraryIdsOf(access.feed), action: "resumed", actor: actorOf(user),
    })
  })
  await credentialsService().syncLibraryFeedFlags(libraryIdsOf(access.feed))
  await credentialsService().queueSync(documentId, actorOf(user))

  return { status: "active" as const }
},

async withdrawPending(user: FeedUser, documentId: string) {
  const access = await manageable(user, documentId)
  if ("error" in access) return access
  const { feed } = access
  if (!feed.pendingSubmissionDocumentId || feed.status === "pending")
    return fail(409, "nothing_pending", "There are no new details waiting for review.")
  await submissions().updateStatus(feed.pendingSubmissionDocumentId, "rejected", systemReviewer(), "Withdrawn by the library")
  // The rejection's apply (Task 9) clears the slot; clear it here too in
  // case the submission had already been decided elsewhere.
  await creds().update({
    documentId,
    data: { pendingCredentialsEncrypted: null, pendingHints: null, pendingTestedAt: null, pendingTestResult: null, pendingSubmissionDocumentId: null },
  })
  await recordCredentialEvent(strapi, {
    credentialDocumentId: documentId, provider: feed.provider, libraryDocumentIds: libraryIdsOf(feed),
    action: "withdrawn", actor: actorOf(user), submissionDocumentId: feed.pendingSubmissionDocumentId,
  })

  return { ok: true as const }
},

async disconnect(user: FeedUser, documentId: string) {
  const access = await manageable(user, documentId)
  if ("error" in access) return access
  const { feed } = access
  if (feed.pendingSubmissionDocumentId)
    await submissions().updateStatus(feed.pendingSubmissionDocumentId, "rejected", systemReviewer(), "Withdrawn by the library")
  await strapi.db.transaction(async () => {
    await strapi.db.query(EVENT_UID).deleteMany({ where: { credentialId: feed.id } })
    await creds().delete({ documentId })
    await recordCredentialEvent(strapi, {
      credentialDocumentId: documentId, provider: feed.provider, libraryDocumentIds: libraryIdsOf(feed),
      action: feed.status === "pending" ? "withdrawn" : "disconnected", actor: actorOf(user),
    })
  })
  await credentialsService().syncLibraryFeedFlags(libraryIdsOf(feed))
  if (feed.status !== "pending")
    void notifyOtherClaimants(strapi, libraryIdsOf(feed), user.id, {
      subject: `An event feed was disconnected`,
      text: `The ${EVENT_PROVIDERS[feed.provider as EventProviderKey].label} feed for ${feed.libraries?.[0]?.name ?? "your library"} was disconnected by another librarian. Its events have been removed. Reconnect it from ${process.env.APP_PUBLIC_URL ?? ""}/contribute/events.`,
    })

  return { ok: true as const }
},
```

`updateStatus` runs its own transaction; it's called before the disconnect transaction rather than nested in it. A connect submission's rejection deletes the row (Task 9), so `disconnect` then finds no row to delete: `creds().delete` on a missing documentId is a no-op in Strapi v5. Make the fake match that.

Add `notifyOtherClaimants` to `utils/feed-access.ts`:

```ts
/** Emails every other claimant of these libraries; best effort, never throws. */
export async function notifyOtherClaimants(
  strapi: any,
  libraryDocumentIds: string[],
  exceptBaUserId: string | null,
  message: { subject: string; text: string }
): Promise<void> {
  try {
    const affiliations = (await strapi
      .documents("api::library-affiliation.library-affiliation")
      .findMany({
        filters: {
          library: { documentId: { $in: libraryDocumentIds } },
          role: { $ne: "proposer" },
        },
        fields: ["baUserId"],
        limit: 100,
      })) as { baUserId: string }[]
    const ids = [...new Set(affiliations.map((a) => a.baUserId))].filter(
      (id) => id !== exceptBaUserId
    )
    if (ids.length === 0) return
    const emails = await strapi
      .plugin("content-moderation")
      .service("notifications")
      .emailsOf?.(ids)
    for (const to of emails ?? []) {
      await strapi
        .plugin("email")
        .service("email")
        .send({ to, subject: message.subject, text: message.text })
    }
  } catch (err) {
    strapi.log.warn("[events] claimant notification failed", err)
  }
}
```

Check how `notifications.ts` resolves a Better Auth user's email (`grep -n "email" apps/strapi/src/plugins/content-moderation/server/services/notifications.ts | head -30`). Reuse that lookup (exported as `emailsOf(baUserIds: string[]): Promise<string[]>` if it isn't already) and the plugin's email config guard (`email-config.ts`), so no email goes out without provider credentials.

- [ ] **Step 3: Write the controller and routes**

```ts
// apps/strapi/src/plugins/events/server/controllers/feeds.ts
import { EVENT_PROVIDERS } from "@repo/shared-data"

import { decodeHeaderName } from "../../../../utils/header-name"
import { isValidServiceSecret } from "../utils/service-secret"

const DOC_ID = /^[a-z0-9]{20,32}$/

/**
 * Event Feeds for the site (`/api/events/feeds*`). Every route is
 * `auth: false` and needs the bridge secret plus `X-Ba-User-Id`; the
 * user's claims are re-read by the service on every call. Values are never
 * echoed back.
 */
export default ({ strapi }: { strapi: any }) => {
  const feeds = () => strapi.plugin("events").service("feeds")

  function userOf(ctx: any) {
    const h = ctx.request?.headers ?? {}
    if (!isValidServiceSecret(h["x-service-secret"])) return null
    const id =
      typeof h["x-ba-user-id"] === "string" ? h["x-ba-user-id"].trim() : ""
    if (!id) return null

    return {
      id,
      email:
        typeof h["x-ba-user-email"] === "string" ? h["x-ba-user-email"] : null,
      name: decodeHeaderName(
        typeof h["x-ba-user-name"] === "string" ? h["x-ba-user-name"] : null
      ),
    }
  }

  async function run(
    ctx: any,
    fn: (user: any) => Promise<any>,
    opts: { docId?: boolean } = {}
  ) {
    ctx.set?.("Cache-Control", "no-store")
    const user = userOf(ctx)
    if (!user) {
      ctx.status = 401
      ctx.body = {
        error: {
          status: 401,
          name: "unauthorised",
          message: "Service secret and user required.",
        },
      }
      return
    }
    if (opts.docId && !DOC_ID.test(String(ctx.params?.documentId ?? ""))) {
      ctx.status = 400
      ctx.body = {
        error: { status: 400, name: "invalid_id", message: "Invalid feed id." },
      }
      return
    }
    const out = await fn(user)
    if (out && typeof out === "object" && "error" in out) {
      ctx.status = out.error.status
      ctx.body = out
      return
    }
    ctx.body = { data: out }
  }

  const body = (ctx: any) =>
    (ctx.request?.body ?? {}) as Record<string, unknown>

  return {
    list: (ctx: any) => run(ctx, (u) => feeds().list(u)),
    providers: (ctx: any) =>
      run(ctx, async () => ({
        providers: Object.values(EVENT_PROVIDERS),
        oauth: {
          eventbrite: !!(
            process.env.EVENTBRITE_CLIENT_ID &&
            process.env.EVENTBRITE_CLIENT_SECRET
          ),
        },
      })),
    testValues: (ctx: any) =>
      run(ctx, (u) =>
        feeds().testValues(u, {
          libraryDocumentId: String(body(ctx).libraryDocumentId ?? ""),
          provider: String(body(ctx).provider ?? ""),
          values: body(ctx).values,
        })
      ),
    connect: (ctx: any) =>
      run(ctx, (u) =>
        feeds().connect(u, {
          libraryDocumentId: String(body(ctx).libraryDocumentId ?? ""),
          provider: String(body(ctx).provider ?? ""),
          values: body(ctx).values,
        })
      ),
    replace: (ctx: any) =>
      run(
        ctx,
        (u) =>
          feeds().replace(u, ctx.params.documentId, {
            values: body(ctx).values,
          }),
        { docId: true }
      ),
    testCurrent: (ctx: any) =>
      run(ctx, (u) => feeds().testCurrent(u, ctx.params.documentId), {
        docId: true,
      }),
    pause: (ctx: any) =>
      run(ctx, (u) => feeds().pause(u, ctx.params.documentId), { docId: true }),
    resume: (ctx: any) =>
      run(ctx, (u) => feeds().resume(u, ctx.params.documentId), {
        docId: true,
      }),
    withdrawPending: (ctx: any) =>
      run(ctx, (u) => feeds().withdrawPending(u, ctx.params.documentId), {
        docId: true,
      }),
    disconnect: (ctx: any) =>
      run(ctx, (u) => feeds().disconnect(u, ctx.params.documentId), {
        docId: true,
      }),
  }
}
```

`controllers/index.ts`: `import feeds from "./feeds"` and `export default { events, admin, feeds }`.

In `routes/content-api.ts`, delete the `/credential-submit` route and append:

```ts
...([
  ["GET", "/feeds", "feeds.list"],
  ["GET", "/feeds/providers", "feeds.providers"],
  ["POST", "/feeds/test", "feeds.testValues"],
  ["POST", "/feeds", "feeds.connect"],
  ["PUT", "/feeds/:documentId/values", "feeds.replace"],
  ["POST", "/feeds/:documentId/test", "feeds.testCurrent"],
  ["POST", "/feeds/:documentId/pause", "feeds.pause"],
  ["POST", "/feeds/:documentId/resume", "feeds.resume"],
  ["DELETE", "/feeds/:documentId/pending", "feeds.withdrawPending"],
  ["DELETE", "/feeds/:documentId", "feeds.disconnect"],
] as const).map(([method, path, handler]) => ({ method, path, handler, config: { auth: false, policies: [] } })),
```

Delete `submitCredential` from `controllers/events.ts`.

- [ ] **Step 4: Controller test**

```ts
// apps/strapi/tests/events/feeds-controller.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

import feedsController from "../../src/plugins/events/server/controllers/feeds"
import routes from "../../src/plugins/events/server/routes/content-api"

beforeEach(() => {
  process.env.STRAPI_BRIDGE_SECRET = "bridge"
})

const ctxOf = (headers: Record<string, string>, extra: any = {}) => ({
  request: { headers, body: {} },
  params: {},
  set: vi.fn(),
  ...extra,
})

describe("feeds controller", () => {
  it("answers 401 without the bridge secret", async () => {
    const ctx: any = ctxOf({ "x-ba-user-id": "u1" })
    await feedsController({
      strapi: { plugin: () => ({ service: () => ({}) }) },
    }).list(ctx)
    expect(ctx.status).toBe(401)
  })

  it("passes the bridge user to the service and wraps the result", async () => {
    const list = vi.fn(async () => ({ libraries: [] }))
    const ctx: any = ctxOf({
      "x-service-secret": "bridge",
      "x-ba-user-id": "u1",
    })
    await feedsController({
      strapi: { plugin: () => ({ service: () => ({ list }) }) },
    }).list(ctx)
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }))
    expect(ctx.body).toEqual({ data: { libraries: [] } })
    expect(ctx.set).toHaveBeenCalledWith("Cache-Control", "no-store")
  })

  it("maps a service error to its status", async () => {
    const pause = vi.fn(async () => ({
      error: { status: 404, name: "not_found", message: "Feed not found." },
    }))
    const ctx: any = ctxOf(
      { "x-service-secret": "bridge", "x-ba-user-id": "u1" },
      { params: { documentId: "a".repeat(24) } }
    )
    await feedsController({
      strapi: { plugin: () => ({ service: () => ({ pause }) }) },
    }).pause(ctx)
    expect(ctx.status).toBe(404)
  })

  it("no longer exposes credential-submit", () => {
    expect((routes as any[]).some((r) => r.path === "/credential-submit")).toBe(
      false
    )
  })
})
```

Run: `cd apps/strapi && pnpm vitest run tests/events`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/plugins/events apps/strapi/src/plugins/content-moderation/server/utils/reviewer.ts apps/strapi/src/plugins/content-moderation/server/content-types apps/strapi/tests/events apps/strapi/tests/content-moderation/review-events.test.ts
git commit -m "feat(events): feed routes for test, pause, resume, withdraw and disconnect"
```

### Task 9: Approve and reject `event_feed` in content-moderation

**Files:**

- Modify: `apps/strapi/src/plugins/events/server/services/feeds.ts` (add `approveSubmission`, `rejectSubmission`)
- Modify: `apps/strapi/src/plugins/content-moderation/server/utils/publish-guard.ts` (`ApplyRefusedReason` gains `claim_lost`, `feed_mismatch`)
- Modify: `apps/strapi/src/plugins/content-moderation/server/services/submission.ts` (markers; the apply branch in `updateStatus`)
- Modify: `apps/strapi/src/plugins/content-moderation/server/controllers/moderation.ts` (409 message for the new reasons)
- Test: `apps/strapi/tests/content-moderation/event-feed-apply.test.ts` (new)

**Interfaces:**

- Consumes: `ApplyRefusedError` (existing).
- Produces:
  - `feeds.approveSubmission(submission: any): Promise<{ credentialDocumentId: string }>`. It throws `ApplyRefusedError("claim_lost" | "feed_mismatch", CREDENTIAL_UID, credentialDocumentId)`.
  - `feeds.rejectSubmission(submission: any): Promise<void>`
  - Both run inside the caller's transaction.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/strapi/tests/content-moderation/event-feed-apply.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

import createService from "../../src/plugins/content-moderation/server/services/submission"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { adminReviewer } from "../../src/plugins/content-moderation/server/utils/reviewer"
import credentialsFactory from "../../src/plugins/events/server/services/credentials"
import feedsFactory from "../../src/plugins/events/server/services/feeds"
import {
  openValues,
  sealValues,
} from "../../src/plugins/events/server/utils/credential-crypto"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const SUB = "plugin::content-moderation.submission"
const CRED = "plugin::events.event-credential"
const L1 = "lib00000000000000000001"
const CID = "cred00000000000000000001"
const REVIEWER = adminReviewer({ id: 1, email: "m@example.org" })

beforeEach(() => {
  process.env.EVENTS_CREDENTIAL_KEY = "d".repeat(64)
})

function setup(
  kind: "connect" | "replace",
  opts: { claims?: string[]; bound?: boolean } = {}
) {
  const sub: any = {
    documentId: "sub00000000000000000001",
    submissionType: "event_feed",
    status: "pending",
    submittedByUserId: "ba-owner",
    targetEntityType: "library",
    targetDocumentId: L1,
    fields: {
      kind,
      credentialDocumentId: CID,
      provider: "ical",
      hints: {},
      test: { result: "ok" },
    },
  }
  sub.payloadHash = payloadHash(sub)
  const cred: any = {
    documentId: CID,
    id: 5,
    provider: "ical",
    scope: "library",
    status: kind === "connect" ? "pending" : "active",
    libraries: [{ documentId: L1 }],
    credentialsEncrypted: sealValues(
      { feedUrl: "https://a.example/old.ics" },
      CID,
      "current"
    ),
    hints: { feedUrl: "https://a.example/…" },
    pendingSubmissionDocumentId:
      opts.bound === false ? "other" : sub.documentId,
    ...(kind === "replace"
      ? {
          pendingCredentialsEncrypted: sealValues(
            { feedUrl: "https://a.example/new.ics" },
            CID,
            "pending"
          ),
          pendingHints: { feedUrl: "https://a.example/…" },
          pendingTestResult: "ok",
          consecutiveFailures: 3,
        }
      : {}),
  }
  const fake = makeFakeStrapi({
    [SUB]: [sub],
    [CRED]: [cred],
    "plugin::events.credential-event": [],
    "plugin::events.sync-command": [],
    "plugin::content-moderation.review-event": [],
    "api::library.library": [{ documentId: L1, hasActiveFeed: false }],
  })
  const { strapi } = fake
  const credentials = credentialsFactory({ strapi })
  const claims = new Set(opts.claims ?? [L1])
  const policy = {
    loadCapabilities: vi.fn(async () => ({
      caps: { claimedLibraryIds: claims, set: new Set(["events.feed"]) },
    })),
  }
  const feeds = feedsFactory({ strapi })
  strapi.plugin = vi.fn((name: string) => ({
    service: (s: string) =>
      name === "events"
        ? s === "feeds"
          ? feeds
          : credentials
        : s === "submission-policy"
          ? policy
          : undefined,
  }))

  return { ...fake, service: createService({ strapi }), cred, sub }
}

describe("event_feed decisions", () => {
  it("approving a connection activates the credential and records the result", async () => {
    const { service, cred, store } = setup("connect")
    const r: any = await service.updateStatus(
      "sub00000000000000000001",
      "approved",
      REVIEWER
    )
    expect(r.data).toBeDefined()
    expect(cred).toMatchObject({
      status: "active",
      submissionDocumentId: "sub00000000000000000001",
      pendingSubmissionDocumentId: null,
    })
    expect(store[SUB]![0]!.resultDocumentId).toBe(CID)
    expect(
      store["plugin::events.sync-command"]!.at(-1)!.credentialDocumentId
    ).toBe(CID)
    expect(store["plugin::events.credential-event"]!.at(-1)!.action).toBe(
      "approved"
    )
  })

  it("approving a replacement swaps the value into the current slot", async () => {
    const { service, cred } = setup("replace")
    await service.updateStatus("sub00000000000000000001", "approved", REVIEWER)
    expect(openValues(cred.credentialsEncrypted, CID, "current")).toEqual({
      feedUrl: "https://a.example/new.ics",
    })
    expect(cred.pendingCredentialsEncrypted).toBeNull()
    expect(cred.consecutiveFailures).toBe(0)
    expect(cred.lastTestResult).toBe("ok")
  })

  it("refuses approval when the submitter lost their claim, and stays pending", async () => {
    const { service, store } = setup("connect", { claims: [] })
    const r: any = await service.updateStatus(
      "sub00000000000000000001",
      "approved",
      REVIEWER
    )
    expect(r).toEqual({ error: "apply_refused", reason: "claim_lost" })
    expect(store[SUB]![0]!.status).toBe("pending")
  })

  it("refuses approval when the credential isn't bound to this submission", async () => {
    const { service } = setup("connect", { bound: false })
    const r: any = await service.updateStatus(
      "sub00000000000000000001",
      "approved",
      REVIEWER
    )
    expect(r).toEqual({ error: "apply_refused", reason: "feed_mismatch" })
  })

  it("rejecting a connection deletes the credential", async () => {
    const { service, store } = setup("connect")
    await service.updateStatus(
      "sub00000000000000000001",
      "rejected",
      REVIEWER,
      "Wrong calendar"
    )
    expect(store[CRED]).toHaveLength(0)
  })

  it("rejecting a replacement clears the pending slot and keeps the feed", async () => {
    const { service, cred } = setup("replace")
    await service.updateStatus(
      "sub00000000000000000001",
      "rejected",
      REVIEWER,
      "Not your account"
    )
    expect(cred.status).toBe("active")
    expect(cred.pendingCredentialsEncrypted).toBeNull()
  })

  it("needs_info changes nothing on the credential", async () => {
    const { service, cred } = setup("connect")
    const before = { ...cred }
    await service.updateStatus(
      "sub00000000000000000001",
      "needs_info",
      REVIEWER,
      "Which branch?"
    )
    expect(cred).toEqual(before)
  })
})
```

Run: `cd apps/strapi && pnpm vitest run tests/content-moderation/event-feed-apply.test.ts`
Expected: FAIL.

- [ ] **Step 2: Add the refusal reasons**

In `publish-guard.ts`:

```ts
/**
 * `not_published`: the record has no published version. `no_hierarchy`: a
 * `new_library` approved with `publish` lacks its continent, country or
 * region. `claim_lost`: an `event_feed` submitter no longer holds a claim
 * on the library. `feed_mismatch`: the credential isn't waiting on this
 * submission (withdrawn, replaced or already decided).
 */
export type ApplyRefusedReason =
  | "not_published"
  | "no_hierarchy"
  | "claim_lost"
  | "feed_mismatch"
```

In `submission.ts`, next to the other markers:

```ts
// An event_feed approval found the submitter without a claim on the library.
export const CLAIM_LOST_MARKER =
  " [Not applied: the submitter no longer holds a claim on this library. Reject it instead]"
// An event_feed approval found its credential no longer waiting on it.
export const FEED_MISMATCH_MARKER =
  " [Not applied: this feed is no longer waiting on this submission. Reject it instead]"

const REFUSED_MARKERS: Record<ApplyRefusedReason, string> = {
  not_published: NOT_PUBLISHED_MARKER,
  no_hierarchy: NO_HIERARCHY_MARKER,
  claim_lost: CLAIM_LOST_MARKER,
  feed_mismatch: FEED_MISMATCH_MARKER,
}
```

In `controllers/moderation.ts`'s `apply_refused` case, extend the message selection so `claim_lost` answers "The submitter no longer holds a claim on this library. Reject it instead." and `feed_mismatch` answers "This feed is no longer waiting on this submission. Reject it instead." Keep `name: "apply_refused"` and `reason`.

- [ ] **Step 3: Add the apply branch**

In `updateStatus`, inside `runWithChangeContext(...)`, before `return "ok" as const`:

```ts
// ── event_feed ───────────────────────────────────────────────────────────
// The events plugin owns the credential: approval activates the value
// under review, rejection destroys it. Both run in this transaction.
if (submission?.submissionType === "event_feed") {
  const feeds = strapi.plugin("events").service("feeds")
  if (status === "approved") {
    const { credentialDocumentId } = await feeds.approveSubmission(submission)
    await strapi
      .documents("plugin::content-moderation.submission")
      .update({ documentId, data: { resultDocumentId: credentialDocumentId } })
    updated.resultDocumentId = credentialDocumentId
  } else if (status === "rejected") {
    await feeds.rejectSubmission(submission)
  }
}
```

No points block is added: `event_feed` awards nothing (spec decision 9).

- [ ] **Step 4: Implement `approveSubmission` and `rejectSubmission` in `feeds.ts`**

```ts
// at the top of feeds.ts
import { ApplyRefusedError } from "../../../content-moderation/server/utils/publish-guard"
import { openValues } from "../utils/credential-crypto"

// in the returned object:
async approveSubmission(submission: any): Promise<{ credentialDocumentId: string }> {
  const f = (submission.fields ?? {}) as Record<string, any>
  const documentId = String(f.credentialDocumentId ?? "")
  const feed = await creds().findOne({
    documentId,
    fields: [...CREDENTIAL_PUBLIC_FIELDS, "pendingCredentialsEncrypted"],
    populate: { libraries: { fields: ["documentId"] } },
  })
  if (!feed || feed.pendingSubmissionDocumentId !== submission.documentId)
    throw new ApplyRefusedError("feed_mismatch", CREDENTIAL_UID, documentId)
  const claims = await claimedLibraryIds(strapi, submission.submittedByUserId)
  if (!libraryIdsOf(feed).some((id) => claims.has(id)))
    throw new ApplyRefusedError("claim_lost", CREDENTIAL_UID, documentId)

  if (f.kind === "replace") {
    if (!feed.pendingCredentialsEncrypted) throw new ApplyRefusedError("feed_mismatch", CREDENTIAL_UID, documentId)
    const values = openValues(feed.pendingCredentialsEncrypted, documentId, "pending")
    await creds().update({
      documentId,
      data: {
        credentialsEncrypted: sealValues(values, documentId, "current"),
        hints: feed.pendingHints ?? feed.hints,
        lastTestedAt: feed.pendingTestedAt ?? null,
        lastTestResult: feed.pendingTestResult ?? null,
        pendingCredentialsEncrypted: null,
        pendingHints: null,
        pendingTestedAt: null,
        pendingTestResult: null,
        pendingSubmissionDocumentId: null,
        submissionDocumentId: submission.documentId,
        consecutiveFailures: 0,
        lastErrorCode: null,
        ...(feed.status === "paused" && feed.pausedReason === "sync_failures"
          ? { status: "active", pausedReason: null, autoPauseNotifiedAt: null }
          : {}),
      },
    })
  } else {
    await creds().update({
      documentId,
      data: { status: "active", pendingSubmissionDocumentId: null, submissionDocumentId: submission.documentId },
    })
  }
  await recordCredentialEvent(strapi, {
    credentialDocumentId: documentId,
    provider: feed.provider,
    libraryDocumentIds: libraryIdsOf(feed),
    action: "approved",
    actor: `ba:${submission.submittedByUserId}`,
    submissionDocumentId: submission.documentId,
    note: f.kind === "replace" ? "replace" : "connect",
  })
  await credentialsService().syncLibraryFeedFlags(libraryIdsOf(feed))
  await credentialsService().queueSync(documentId)

  return { credentialDocumentId: documentId }
},

async rejectSubmission(submission: any): Promise<void> {
  const f = (submission.fields ?? {}) as Record<string, any>
  const documentId = String(f.credentialDocumentId ?? "")
  const feed = await creds().findOne({ documentId, fields: ["documentId", "provider", "pendingSubmissionDocumentId", "status"] })
  // Already withdrawn or bound to a newer review: nothing to undo.
  if (!feed || feed.pendingSubmissionDocumentId !== submission.documentId) return
  if (f.kind === "replace") {
    await creds().update({
      documentId,
      data: { pendingCredentialsEncrypted: null, pendingHints: null, pendingTestedAt: null, pendingTestResult: null, pendingSubmissionDocumentId: null },
    })
  } else {
    await creds().delete({ documentId })
  }
  await recordCredentialEvent(strapi, {
    credentialDocumentId: documentId,
    provider: feed.provider,
    action: "rejected",
    actor: `ba:${submission.submittedByUserId}`,
    submissionDocumentId: submission.documentId,
  })
},
```

The audit actor of a decision is the submitter; the reviewer is on the Review Event.

- [ ] **Step 5: Run the tests**

Run: `cd apps/strapi && pnpm vitest run tests/content-moderation tests/events`
Expected: PASS, including the existing `approve-once` and `apply-failures` suites.

- [ ] **Step 6: Commit**

```bash
git add apps/strapi/src/plugins/content-moderation apps/strapi/src/plugins/events apps/strapi/tests/content-moderation/event-feed-apply.test.ts
git commit -m "feat(moderation): approve and reject event feed submissions"
```

### Task 10: Moderation detail, feed-test route, labels and alerts

**Files:**

- Modify: `apps/strapi/src/plugins/content-moderation/server/services/moderation.ts` (`reviewFields` allowlist, `review()` branch)
- Modify: `apps/strapi/src/plugins/content-moderation/server/controllers/moderation.ts` (new `feedTest` action)
- Modify: `apps/strapi/src/plugins/content-moderation/server/routes/content-api.ts` (route)
- Modify: `apps/strapi/src/plugins/content-moderation/server/utils/submission-summary.ts`, `utils/target-labels.ts`, `utils/email-templates.ts`, `services/notifications.ts`
- Test: extend `apps/strapi/tests/content-moderation/moderation-api.test.ts`, `target-labels.test.ts`, `notifications.test.ts`

**Interfaces:**

- Produces:
  - `review()` for `event_feed` returns `EventFeedReview = { credentialDocumentId: string; exists: boolean; status: FeedStatus | null; kind: "connect" | "replace"; provider: string; library: { documentId: string; name: string; slug: string | null } | null; currentHints: Record<string,string>; newHints: Record<string,string>; submittedTest: { result: FeedTestCode; testedAt: string } | null; latestTest: { result: FeedTestCode; testedAt: string } | null; submitterHoldsClaim: boolean }`
  - `PUT /moderation/submissions/:documentId/feed-test` → `{ data: { result: FeedTestCode } }`

- [ ] **Step 1: Write the failing tests**

In `moderation-api.test.ts`, add an `event_feed` fixture: a pending submission whose `fields` carry, for the test, a stray `accessToken: "SHOULD-NOT-LEAK"`, plus a pending credential row. Assert that:

1. `GET /moderation/submissions/:id` for a global Moderator returns `data.fields` without `accessToken`, and `JSON.stringify(response)` doesn't contain `SHOULD-NOT-LEAK` or `credentialsEncrypted`;
2. `data.review` matches `{ kind: "connect", provider: "ical", submitterHoldsClaim: true, submittedTest: { result: "ok" } }`;
3. `PUT …/feed-test` as a Moderator calls the credentials service's `test(credentialDocumentId, "current", "ba:<moderator>")` and returns `{ data: { result } }`. A replacement tests the `"pending"` slot;
4. `PUT …/feed-test` on a `library_edit` submission answers 400.

In `target-labels.test.ts`, add that `event_feed` resolves to the library's name (same as `library_edit`). In `notifications.test.ts`, add that a pending `event_feed` alerts `MODERATORS_EMAIL` with a summary containing the provider label and library name.

Run: `cd apps/strapi && pnpm vitest run tests/content-moderation/moderation-api.test.ts tests/content-moderation/target-labels.test.ts tests/content-moderation/notifications.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement the detail**

In `moderation.ts`:

```ts
/** What an event_feed review may show from `fields`: never a value. */
const FEED_REVIEW_FIELDS = new Set([
  "kind",
  "credentialDocumentId",
  "provider",
  "hints",
  "previousHints",
  "test",
])

function reviewFields(s: { submissionType?: string; fields?: unknown }) {
  const f = s.fields
  if (!f || typeof f !== "object") return f ?? null
  const allow =
    s.submissionType === "library_claim"
      ? CLAIM_REVIEW_FIELDS
      : s.submissionType === "event_feed"
        ? FEED_REVIEW_FIELDS
        : null
  if (!allow) return f

  return Object.fromEntries(
    Object.entries(f as Record<string, unknown>).filter(([k]) => allow.has(k))
  )
}
```

In `review(s)`, before `return null`:

```ts
if (s.submissionType === "event_feed")
  return feedReview(strapi, s).catch(() => null)
```

Add `feedReview` to `utils/record-review.ts`'s neighbour, a new `utils/feed-review.ts`:

```ts
// apps/strapi/src/plugins/content-moderation/server/utils/feed-review.ts
/** The live feed behind an event_feed submission, for the review panel. */
export async function feedReview(strapi: any, s: any) {
  const f = (s.fields ?? {}) as Record<string, any>
  const credentialDocumentId = String(f.credentialDocumentId ?? "")
  const feed = credentialDocumentId
    ? await strapi.documents("plugin::events.event-credential").findOne({
        documentId: credentialDocumentId,
        fields: [
          "status",
          "hints",
          "pendingHints",
          "lastTestedAt",
          "lastTestResult",
          "pendingTestedAt",
          "pendingTestResult",
        ],
      })
    : null
  const library = s.targetDocumentId
    ? await strapi
        .documents("api::library.library")
        .findOne({
          documentId: s.targetDocumentId,
          fields: ["documentId", "name", "slug"],
        })
    : null
  const { caps } = await strapi
    .plugin("content-moderation")
    .service("submission-policy")
    .loadCapabilities(s.submittedByUserId)
  const replace = f.kind === "replace"
  const latest = replace
    ? feed?.pendingTestResult && {
        result: feed.pendingTestResult,
        testedAt: feed.pendingTestedAt,
      }
    : feed?.lastTestResult && {
        result: feed.lastTestResult,
        testedAt: feed.lastTestedAt,
      }

  return {
    credentialDocumentId,
    exists: !!feed,
    status: feed?.status ?? null,
    kind: replace ? "replace" : "connect",
    provider: String(f.provider ?? ""),
    library: library
      ? {
          documentId: library.documentId,
          name: library.name,
          slug: library.slug ?? null,
        }
      : null,
    currentHints: replace ? (feed?.hints ?? f.previousHints ?? {}) : {},
    newHints: replace
      ? (feed?.pendingHints ?? f.hints ?? {})
      : (feed?.hints ?? f.hints ?? {}),
    submittedTest: f.test?.result
      ? { result: f.test.result, testedAt: f.test.testedAt }
      : null,
    latestTest: latest || null,
    submitterHoldsClaim:
      !!s.targetDocumentId && caps.claimedLibraryIds.has(s.targetDocumentId),
  }
}
```

- [ ] **Step 3: Add the feed-test action and route**

In the moderation controller's returned object:

```ts
// PUT /moderation/submissions/:documentId/feed-test — re-run the connection
// test on the value under review. In scope and not your own, like a decision.
async feedTest(ctx: any) {
  const auth = await authorise(ctx)
  if (!auth) return
  const s = await decidable(ctx, auth)
  if (!s) return
  if (s.submissionType !== "event_feed" || !["pending", "needs_info"].includes(s.status))
    return fail(ctx, 400, "Only an open event feed submission can be tested.")
  const f = (s.fields ?? {}) as Record<string, any>
  const r = await strapi
    .plugin("events")
    .service("credentials")
    .test(String(f.credentialDocumentId ?? ""), f.kind === "replace" ? "pending" : "current", `ba:${auth.viewer.id}`)
  if (!r) return fail(ctx, 404, "This feed no longer has a value to test.")
  ctx.body = { data: r }
},
```

`decidable` loads only `documentId`, `status` and `submittedByUserId` first and then the in-scope row; confirm that `loadInScope` returns `fields` and `submissionType` (it does for `detail`).

Route in `routes/content-api.ts`, next to the other `/moderation/submissions/:documentId/*` routes, with the same `config` they use:

```ts
{
  method: "PUT",
  path: "/moderation/submissions/:documentId/feed-test",
  handler: "moderation.feedTest",
  config: { auth: false, policies: [] },
},
```

- [ ] **Step 4: Labels, summary and alert**

- `utils/submission-summary.ts` `summaryOf`: `case "event_feed": return \`${EVENT_PROVIDERS[f.provider]?.label ?? "Event"} feed${f.kind === "replace" ? " (new details)" : ""}\``(import`EVENT_PROVIDERS`from`@repo/shared-data`).
- `utils/target-labels.ts`: add `"event_feed"` wherever `library_edit` is listed in `targetLabelOf` and in `LOOKUPS`, so it resolves to the library name.
- `utils/email-templates.ts` `TYPE_LABELS`: `event_feed: "event feed"`.
- `services/notifications.ts`: add `"event_feed"` to `ALERT_TYPES`. In `alertSummary`, add a branch before the fallback:

```ts
if (s.submissionType === "event_feed") {
  const f = (s.fields ?? {}) as Record<string, any>
  const label =
    EVENT_PROVIDERS[f.provider as EventProviderKey]?.label ??
    "An event platform"

  return `${label} feed ${f.kind === "replace" ? "details replaced" : "connected"} for a library; the connection test said "${FEED_TEST_LABEL[f.test?.result as FeedTestCode] ?? "not run"}".`
}
```

- [ ] **Step 5: Run the tests and commit**

Run: `pnpm --filter @repo/strapi build:plugins && cd apps/strapi && pnpm vitest run tests/content-moderation`
Expected: PASS.

```bash
git add apps/strapi/src/plugins/content-moderation apps/strapi/tests/content-moderation
git commit -m "feat(moderation): review detail, re-test route, labels and alerts for event feeds"
```

### Task 11: Strapi admin moderation panel

**Files:**

- Modify: `apps/strapi/src/plugins/content-moderation/admin/src/components/submissionMeta.ts` (`TYPE_LABELS`, `TYPE_COLORS`, `summaryOf`, `detailOf`)
- Modify: `apps/strapi/src/plugins/content-moderation/admin/src/components/SubmissionPanels.tsx` (new `EventFeedPanel`)
- Modify: `apps/strapi/src/plugins/content-moderation/admin/src/components/ReviewModal.tsx` (`Panel` switch; "Approve and activate" label)
- Test: `apps/ui/src/components/moderation/__tests__/submissionMeta.test.ts` keeps the admin and UI copies in step; Task 16 extends it.

**Interfaces:**

- Consumes: `RevealCredentialButton` from the events plugin admin (Task 5), imported by relative path `../../../../events/admin/src/components/RevealCredentialButton`; `FEED_TEST_LABEL` and `EVENT_PROVIDERS` from `@repo/shared-data`.

- [ ] **Step 1: Labels**

In the admin `submissionMeta.ts`: `TYPE_LABELS.event_feed = "Event feed"`, `TYPE_COLORS.event_feed` set to the same colour as `library_claim`, a `summaryOf` case identical in output to the shared `utils/submission-summary.ts` case (Task 10), and a `detailOf` case returning `` `${library} · ${kind === "replace" ? "new details" : "new connection"}` ``.

- [ ] **Step 2: Panel**

```tsx
// in SubmissionPanels.tsx
export function EventFeedPanel({ sub }: { sub: any }) {
  const f = (sub.fields ?? {}) as Record<string, any>
  const replace = f.kind === "replace"
  const test = f.test?.result as keyof typeof FEED_TEST_LABEL | undefined
  const hints = (f.hints ?? {}) as Record<string, string>
  const previous = (f.previousHints ?? {}) as Record<string, string>

  return (
    <Flex direction="column" alignItems="stretch" gap={4}>
      <Alert
        variant={test === "ok" ? "success" : "warning"}
        title={`Connection test: ${test ? FEED_TEST_LABEL[test] : "not run"}`}
      >
        {test && test !== "ok"
          ? FEED_TEST_COPY[test]
          : "The test read events with these details when they were sent."}
      </Alert>
      <KeyValueGrid
        rows={[
          [
            "Platform",
            EVENT_PROVIDERS[f.provider as keyof typeof EVENT_PROVIDERS]
              ?.label ?? f.provider,
          ],
          [
            "Kind",
            replace ? "New details for an active feed" : "New connection",
          ],
          ...Object.entries(hints).map(
            ([k, v]) => [replace ? `${k} (new)` : k, v] as [string, string]
          ),
          ...(replace
            ? Object.entries(previous).map(
                ([k, v]) => [`${k} (current)`, v] as [string, string]
              )
            : []),
        ]}
      />
      <Flex gap={2}>
        <RevealCredentialButton
          documentId={f.credentialDocumentId}
          slot={replace ? "pending" : "current"}
        />
      </Flex>
      <Alert variant="default" title="On approval">
        {replace
          ? "The new details replace the current ones and the feed syncs again."
          : "The feed becomes active and the worker syncs it within a few minutes."}
      </Alert>
    </Flex>
  )
}
```

Check the existing helper names in `SubmissionPanels.tsx` (`KeyValueGrid`, the Alert import) and match them. In `ReviewModal.tsx`'s `Panel` switch, add `case "event_feed": return <EventFeedPanel sub={sub} />`. Where the approve label special-cases `library_claim`, add `sub.submissionType === "event_feed" ? "Approve and activate"`.

- [ ] **Step 3: Build and commit**

Run: `pnpm --filter @repo/strapi build:plugins`
Expected: the build succeeds.

```bash
git add apps/strapi/src/plugins/content-moderation/admin
git commit -m "feat(moderation-admin): event feed review panel with reveal"
```

### Task 12: Cron, account erasure and the rekey script

**Files:**

- Create: `apps/strapi/src/plugins/events/server/cron.ts`
- Modify: `apps/strapi/config/cron-tasks.ts`
- Modify: `apps/strapi/src/utils/erase-account.ts`
- Create: `apps/strapi/scripts/events-rekey.ts`; modify `apps/strapi/package.json` (script `events:rekey`)
- Test: `apps/strapi/tests/events/cron.test.ts` (new), extend `apps/strapi/tests/erase-account.test.ts`

**Interfaces:**

- Produces: `handleAutoPaused(strapi): Promise<{ handled: number }>`, `purgeOAuthDrafts(strapi, now?: Date): Promise<{ deleted: number }>`.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/strapi/tests/events/cron.test.ts
import { describe, expect, it, vi } from "vitest"

import {
  handleAutoPaused,
  purgeOAuthDrafts,
} from "../../src/plugins/events/server/cron"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const CRED = "plugin::events.event-credential"

describe("events cron", () => {
  it("handles each auto-paused feed once: flag, audit, email", async () => {
    const { strapi, store } = makeFakeStrapi({
      [CRED]: [
        {
          documentId: "c1",
          provider: "ical",
          status: "paused",
          pausedReason: "sync_failures",
          autoPauseNotifiedAt: null,
          lastErrorCode: "auth_failed",
          libraries: [{ documentId: "L1", name: "Central" }],
        },
        {
          documentId: "c2",
          provider: "ical",
          status: "paused",
          pausedReason: "library",
          autoPauseNotifiedAt: null,
          libraries: [],
        },
      ],
      "plugin::events.credential-event": [],
      "api::library.library": [{ documentId: "L1", hasActiveFeed: true }],
    })
    const syncLibraryFeedFlags = vi.fn()
    strapi.plugin = vi.fn(() => ({ service: () => ({ syncLibraryFeedFlags }) }))
    const notify = vi.fn()
    expect(await handleAutoPaused(strapi, { notify })).toEqual({ handled: 1 })
    expect(store[CRED]![0]!.autoPauseNotifiedAt).toBeTruthy()
    expect(syncLibraryFeedFlags).toHaveBeenCalledWith(["L1"])
    expect(notify).toHaveBeenCalledTimes(1)
    expect(store["plugin::events.credential-event"]![0]).toMatchObject({
      action: "auto_paused",
      actor: "system",
      resultCode: "auth_failed",
    })
    expect(await handleAutoPaused(strapi, { notify })).toEqual({ handled: 0 })
  })

  it("purges OAuth drafts older than an hour", async () => {
    const now = new Date("2026-10-06T12:00:00Z")
    const { strapi, store } = makeFakeStrapi({
      [CRED]: [
        {
          documentId: "old",
          status: "draft",
          createdAt: "2026-10-06T10:00:00Z",
        },
        {
          documentId: "new",
          status: "draft",
          createdAt: "2026-10-06T11:30:00Z",
        },
        {
          documentId: "act",
          status: "active",
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
    })
    expect(await purgeOAuthDrafts(strapi, now)).toEqual({ deleted: 1 })
    expect(store[CRED]!.map((c) => c.documentId)).toEqual(["new", "act"])
  })
})
```

In `erase-account.test.ts`, add a case seeding a `pending` credential with `connectedBy: "ba:u1"`, an active one with `connectedBy: "ba:u1"` and `pendingSubmissionDocumentId` pointing at a u1 submission, and a `credential-event` with `actor: "ba:u1"`. Assert that after erasure:

- the pending credential is gone;
- the active credential has `connectedBy: null` and an empty pending slot;
- the event's actor is `"ba:erased"`.

Run: `cd apps/strapi && pnpm vitest run tests/events/cron.test.ts tests/erase-account.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement the cron helpers**

```ts
// apps/strapi/src/plugins/events/server/cron.ts
import {
  EVENT_PROVIDERS,
  type EventProviderKey,
  FEED_TEST_COPY,
  type FeedTestCode,
} from "@repo/shared-data"

import { recordCredentialEvent } from "./utils/credential-events"
import { notifyOtherClaimants } from "./utils/feed-access"

const CRED = "plugin::events.event-credential"

/** Feeds the worker auto-paused and nobody has been told about yet. */
export async function handleAutoPaused(
  strapi: any,
  deps: { notify?: typeof notifyOtherClaimants } = {}
): Promise<{ handled: number }> {
  const notify = deps.notify ?? notifyOtherClaimants
  const rows = (await strapi.documents(CRED).findMany({
    filters: {
      status: "paused",
      pausedReason: "sync_failures",
      autoPauseNotifiedAt: { $null: true },
    },
    fields: ["documentId", "provider", "lastErrorCode"],
    populate: { libraries: { fields: ["documentId", "name"] } },
    limit: 200,
  })) as any[]
  for (const row of rows) {
    const libraryIds = (row.libraries ?? []).map((l: any) => l.documentId)
    await strapi
      .documents(CRED)
      .update({
        documentId: row.documentId,
        data: { autoPauseNotifiedAt: new Date().toISOString() },
      })
    await recordCredentialEvent(strapi, {
      credentialDocumentId: row.documentId,
      provider: row.provider,
      libraryDocumentIds: libraryIds,
      action: "auto_paused",
      actor: "system",
      resultCode: row.lastErrorCode ?? undefined,
    })
    await strapi
      .plugin("events")
      .service("credentials")
      .syncLibraryFeedFlags(libraryIds)
    const label =
      EVENT_PROVIDERS[row.provider as EventProviderKey]?.label ?? "event"
    const why =
      FEED_TEST_COPY[(row.lastErrorCode ?? "provider_error") as FeedTestCode]
    await notify(strapi, libraryIds, null, {
      subject: `Your library's ${label} feed stopped working`,
      text: `The ${label} feed for ${row.libraries?.[0]?.name ?? "your library"} stopped working and has been paused. ${why} Replace its details to restart it: ${process.env.APP_PUBLIC_URL ?? ""}/contribute/events`,
    })
  }

  return { handled: rows.length }
}

/** OAuth connections never finished: drop them after an hour. */
export async function purgeOAuthDrafts(
  strapi: any,
  now = new Date()
): Promise<{ deleted: number }> {
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const rows = (await strapi.documents(CRED).findMany({
    filters: { status: "draft", createdAt: { $lt: cutoff } },
    fields: ["documentId"],
    limit: 500,
  })) as any[]
  for (const r of rows)
    await strapi.documents(CRED).delete({ documentId: r.documentId })

  return { deleted: rows.length }
}
```

In `config/cron-tasks.ts`, add:

```ts
import {
  handleAutoPaused,
  purgeOAuthDrafts,
} from "../src/plugins/events/server/cron"

const eventFeedsJob = {
  task: async ({ strapi }: { strapi: any }) => {
    try {
      const { handled } = await handleAutoPaused(strapi)
      const { deleted } = await purgeOAuthDrafts(strapi)
      if (handled || deleted)
        strapi.log.info(
          `[events] auto-paused handled ${handled}, OAuth drafts purged ${deleted}`
        )
    } catch (err) {
      strapi.log.warn("[events] feed housekeeping failed:", err)
    }
  },
  options: { rule: "*/15 * * * *" },
}

export default {
  resyncExpiredRoleGrants: resyncExpiredRoleGrantsJob,
  eventFeeds: eventFeedsJob,
}
```

- [ ] **Step 3: Erasure**

In `erase-account.ts`, inside the existing transaction, after the affiliations are deleted:

```ts
// Event Feeds belong to the library: keep approved ones, forget who
// connected them, and drop anything still waiting on this person.
const actor = `ba:${baUserId}`
await strapi.db.query("plugin::events.event-credential").deleteMany({
  where: { connectedBy: actor, status: { $in: ["pending", "draft"] } },
})
const theirOpen = (unfinished as any[])
  .filter((s) => s.submissionType === "event_feed")
  .map((s) => s.documentId)
if (theirOpen.length)
  await strapi.db.query("plugin::events.event-credential").updateMany({
    where: { pendingSubmissionDocumentId: { $in: theirOpen } },
    data: {
      pendingCredentialsEncrypted: null,
      pendingHints: null,
      pendingTestedAt: null,
      pendingTestResult: null,
      pendingSubmissionDocumentId: null,
    },
  })
await strapi.db.query("plugin::events.event-credential").updateMany({
  where: { connectedBy: actor },
  data: { connectedBy: null },
})
await strapi.db.query("plugin::events.credential-event").updateMany({
  where: { actor },
  data: { actor: "ba:erased" },
})
```

Check that the `unfinished` query selects `submissionType` and `documentId`, and add them to its `select` if it doesn't. These are `db.query` writes, sanctioned for erasure (Global Constraints), like the rest of that file.

- [ ] **Step 4: Rekey script**

```ts
// apps/strapi/scripts/events-rekey.ts
/**
 * Re-encrypts every Event Credential value (current and pending) under
 * EVENTS_CREDENTIAL_KEY, reading with EVENTS_CREDENTIAL_KEY_PREV as the
 * fallback. Rotation: set _PREV to the old key and the main var to the new
 * one, run this, then remove _PREV from Strapi and the worker.
 * Run: pnpm --filter @repo/strapi events:rekey
 */
import { compileStrapi, createStrapi } from "@strapi/strapi"

import {
  openValues,
  sealValues,
} from "../src/plugins/events/server/utils/credential-crypto"

async function main() {
  const app = await createStrapi(await compileStrapi()).load()
  const CRED = "plugin::events.event-credential"
  let after = 0
  let done = 0
  for (;;) {
    const rows = (await app.db.query(CRED).findMany({
      where: { id: { $gt: after } },
      orderBy: { id: "asc" },
      limit: 200,
      select: [
        "id",
        "documentId",
        "credentialsEncrypted",
        "pendingCredentialsEncrypted",
      ],
    })) as any[]
    if (rows.length === 0) break
    for (const r of rows) {
      const data: Record<string, string> = {}
      if (r.credentialsEncrypted && r.credentialsEncrypted !== "{}")
        data.credentialsEncrypted = sealValues(
          openValues(r.credentialsEncrypted, r.documentId, "current"),
          r.documentId,
          "current"
        )
      if (r.pendingCredentialsEncrypted)
        data.pendingCredentialsEncrypted = sealValues(
          openValues(r.pendingCredentialsEncrypted, r.documentId, "pending"),
          r.documentId,
          "pending"
        )
      if (Object.keys(data).length)
        await app.db.query(CRED).update({ where: { id: r.id }, data })
      done++
      after = r.id
    }
  }
  console.log(`[events:rekey] re-encrypted ${done} credentials`)
  await app.destroy()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

Copy the boot lines from an existing script under `apps/strapi/scripts/` (`grep -ln createStrapi apps/strapi/scripts/*.ts | head -1`) so the boot sequence matches. Add `"events:rekey": "tsx scripts/events-rekey.ts"` to `apps/strapi/package.json` scripts, using the runner the other scripts use.

- [ ] **Step 5: Run the tests and commit**

Run: `cd apps/strapi && pnpm vitest run tests/events tests/erase-account.test.ts`
Expected: PASS.

```bash
git add apps/strapi/src/plugins/events/server/cron.ts apps/strapi/config/cron-tasks.ts apps/strapi/src/utils/erase-account.ts apps/strapi/scripts/events-rekey.ts apps/strapi/package.json apps/strapi/tests/events/cron.test.ts apps/strapi/tests/erase-account.test.ts
git commit -m "feat(events): auto-pause notices, OAuth draft purge, erasure and key rotation"
```

---

## Phase E: Next app

### Task 13: Feed proxy and route handlers

**Files:**

- Create: `apps/ui/src/lib/event-feed-proxy.ts`
- Create: the route handlers:
  - `apps/ui/src/app/api/contribute/event-feeds/route.ts` (GET list, POST connect)
  - `apps/ui/src/app/api/contribute/event-feeds/providers/route.ts` (GET)
  - `apps/ui/src/app/api/contribute/event-feeds/test/route.ts` (POST)
  - `apps/ui/src/app/api/contribute/event-feeds/[documentId]/route.ts` (DELETE)
  - `apps/ui/src/app/api/contribute/event-feeds/[documentId]/values/route.ts` (PUT)
  - `apps/ui/src/app/api/contribute/event-feeds/[documentId]/test/route.ts` (POST)
  - `apps/ui/src/app/api/contribute/event-feeds/[documentId]/pause/route.ts`, `resume/route.ts` (POST)
  - `apps/ui/src/app/api/contribute/event-feeds/[documentId]/pending/route.ts` (DELETE)
- Delete: `apps/ui/src/app/api/contribute/event-feed/route.ts`
- Modify: `apps/ui/sentry.server.config.ts`, `apps/ui/sentry.edge.config.ts` (`beforeSend` scrub)
- Modify: `apps/ui/src/lib/moderation-proxy.ts` is unchanged; the `feed-test` route handler is in Task 16
- Test: `apps/ui/src/lib/__tests__/event-feed-proxy.test.ts`

**Interfaces:**

- Produces:
  - `proxyEventFeed(req: Request, opts: { method: "GET" | "POST" | "PUT" | "DELETE"; path: string; kind: "read" | "write" | "test"; libraryFromBody?: boolean; validateValues?: "body" | "none" }): Promise<Response>`
  - `fetchEventFeeds(user): Promise<{ status: number; body: { data: { libraries: LibraryFeeds[] } } | null }>` for RSC
  - `fetchEventFeedProviders(user)` for RSC

- [ ] **Step 1: Write the failing test**

```ts
// apps/ui/src/lib/__tests__/event-feed-proxy.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const session = vi.hoisted(() => ({ user: null as any }))
vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("../auth", () => ({
  auth: {
    api: {
      getSession: async () => (session.user ? { user: session.user } : null),
    },
  },
}))

import { proxyEventFeed } from "../event-feed-proxy"

const LIB = "lib00000000000000000001"
const librarian = {
  id: "u1",
  email: "u@x.org",
  name: "U",
  capabilities: ["events.feed"],
  claimedLibraryIds: [LIB],
}
const req = (body?: unknown) =>
  new Request("http://localhost/api/contribute/event-feeds", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  })

beforeEach(() => {
  process.env.STRAPI_BRIDGE_SECRET = "bridge"
  session.user = librarian
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { ok: true } }), { status: 200 })
    )
  )
})

describe("proxyEventFeed", () => {
  it("401 without a session, 403 without events.feed", async () => {
    session.user = null
    expect(
      (
        await proxyEventFeed(req({}), {
          method: "POST",
          path: "feeds",
          kind: "write",
        })
      ).status
    ).toBe(401)
    session.user = { ...librarian, capabilities: [] }
    expect(
      (
        await proxyEventFeed(req({}), {
          method: "POST",
          path: "feeds",
          kind: "write",
        })
      ).status
    ).toBe(403)
  })

  it("403 for a library outside the session's claims", async () => {
    const r = await proxyEventFeed(
      req({
        libraryDocumentId: "lib00000000000000000099",
        provider: "ical",
        values: { feedUrl: "https://x.example/a.ics" },
      }),
      {
        method: "POST",
        path: "feeds",
        kind: "write",
        libraryFromBody: true,
        validateValues: "body",
      }
    )
    expect(r.status).toBe(403)
  })

  it("400 for values the registry rejects, before calling Strapi", async () => {
    const r = await proxyEventFeed(
      req({
        libraryDocumentId: LIB,
        provider: "ical",
        values: { feedUrl: "nope" },
      }),
      {
        method: "POST",
        path: "feeds",
        kind: "write",
        libraryFromBody: true,
        validateValues: "body",
      }
    )
    expect(r.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("forwards only allowed keys with bridge headers and no-store", async () => {
    const r = await proxyEventFeed(
      req({
        libraryDocumentId: LIB,
        provider: "ical",
        values: { feedUrl: "https://x.example/a.ics" },
        sneaky: 1,
      }),
      {
        method: "POST",
        path: "feeds",
        kind: "write",
        libraryFromBody: true,
        validateValues: "body",
      }
    )
    expect(r.status).toBe(200)
    expect(r.headers.get("Cache-Control")).toBe("no-store")
    const [url, init] = (fetch as any).mock.calls[0]
    expect(url).toMatch(/\/api\/events\/feeds$/)
    expect(JSON.parse(init.body)).toEqual({
      libraryDocumentId: LIB,
      provider: "ical",
      values: { feedUrl: "https://x.example/a.ics" },
    })
    expect(init.headers["X-Ba-User-Id"]).toBe("u1")
  })

  it("rate-limits writes at 10 an hour per user", async () => {
    let last: Response | null = null
    for (let i = 0; i < 11; i++)
      last = await proxyEventFeed(
        new Request("http://localhost", { method: "POST" }),
        {
          method: "POST",
          path: "feeds/aaaaaaaaaaaaaaaaaaaaaaaa/pause",
          kind: "write",
        }
      )
    expect(last!.status).toBe(429)
  })
})
```

Run: `cd apps/ui && pnpm vitest run src/lib/__tests__/event-feed-proxy.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement the proxy**

```ts
// apps/ui/src/lib/event-feed-proxy.ts
import "server-only"

import { validateFeedValues } from "@repo/shared-data"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { requireCapability } from "./access-server"
import { auth } from "./auth"
import { isDocumentIdParam, readJsonCapped } from "./bridge-params"
import { bridgeUserHeaders } from "./bridge-user-headers"
import { createRateLimiter, rateLimitResponse } from "./rate-limit"

/**
 * The `/api/contribute/event-feeds/*` routes: a claimant's requests to
 * Strapi's Event Feed API (`/api/events/feeds*`). Each needs `events.feed`,
 * a library among the session's claims when one is named, and a per-user
 * limit (writes 10 an hour, tests 20 an hour, reads 120 a minute). Bodies
 * are capped at 16 KB, reduced to their allowed keys, never logged, and
 * values are never echoed. Strapi re-checks every claim.
 */

const STRAPI = () => process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const MAX_BODY = 16 * 1024
const BODY_KEYS = [
  "libraryDocumentId",
  "provider",
  "values",
  "organizationId",
] as const

const limiters = {
  write: createRateLimiter({
    name: "event-feed-write",
    max: 10,
    windowMs: 60 * 60_000,
  }),
  test: createRateLimiter({
    name: "event-feed-test",
    max: 20,
    windowMs: 60 * 60_000,
  }),
  read: createRateLimiter({
    name: "event-feed-read",
    max: 120,
    windowMs: 60_000,
  }),
}

type User = {
  id: string
  email: string
  name?: string | null
  capabilities?: unknown
  claimedLibraryIds?: unknown
}

async function sessionUser(): Promise<User | null> {
  const s = await auth.api.getSession({ headers: await headers() })

  return (s?.user as User | undefined) ?? null
}

const json = (body: unknown, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export type ProxyEventFeedOptions = {
  method: "GET" | "POST" | "PUT" | "DELETE"
  /** Path under /api/events/, e.g. `feeds` or `feeds/<id>/pause`. */
  path: string
  kind: "read" | "write" | "test"
  /** The body names a library that must be among the session's claims. */
  libraryFromBody?: boolean
  /** Pre-check `values` against the registry (`provider` from the body). */
  validateValues?: "body" | "none"
  /** For PUT /values: the feed's provider isn't in the body; skip the pre-check. */
}

export async function proxyEventFeed(
  req: Request,
  opts: ProxyEventFeedOptions
): Promise<Response> {
  const user = await sessionUser()
  const denied = requireCapability(user, "events.feed")
  if (denied || !user) return denied ?? json({ error: "Sign in first" }, 401)
  if (!process.env.STRAPI_BRIDGE_SECRET)
    return json({ error: "Bridge not configured" }, 500)

  const limit = await limiters[opts.kind].check(user.id)
  if (!limit.ok) return rateLimitResponse(limit)

  for (const seg of opts.path.split("/").slice(1, 2))
    if (seg && seg !== "test" && seg !== "providers" && !isDocumentIdParam(seg))
      return json({ error: "Invalid id" }, 400)

  let body: string | undefined
  if (opts.method === "POST" || opts.method === "PUT") {
    const parsed = await readJsonCapped(req, MAX_BODY)
    if (!parsed.ok)
      return json({ error: "Invalid request body" }, parsed.status)
    const raw = (parsed.body ?? {}) as Record<string, unknown>
    const picked = Object.fromEntries(
      BODY_KEYS.filter((k) => k in raw).map((k) => [k, raw[k]])
    )
    if (opts.libraryFromBody) {
      const claims = Array.isArray(user.claimedLibraryIds)
        ? (user.claimedLibraryIds as string[])
        : []
      if (
        typeof picked.libraryDocumentId !== "string" ||
        !claims.includes(picked.libraryDocumentId)
      )
        return json(
          {
            error: {
              status: 403,
              name: "not_claimed",
              message: "You haven't claimed this library.",
            },
          },
          403
        )
    }
    if (opts.validateValues === "body") {
      const r = validateFeedValues(picked.provider, picked.values)
      if (!r.ok)
        return json(
          {
            error: {
              status: 400,
              name: "invalid_values",
              message: r.error,
              field: r.field,
            },
          },
          400
        )
    }
    body = JSON.stringify(picked)
  }

  try {
    const res = await fetch(`${STRAPI()}/api/events/${opts.path}`, {
      method: opts.method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...bridgeUserHeaders(user),
      },
      body,
      cache: "no-store",
    })
    const text = await res.text()

    return new NextResponse(text || null, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return json({ error: "The event feed service is unavailable." }, 502)
  }
}

/** RSC read of the user's feeds (same Strapi route as the proxy). */
export async function fetchEventFeeds<T>(
  user: User,
  path = "feeds"
): Promise<{ status: number; body: T | null }> {
  if (!process.env.STRAPI_BRIDGE_SECRET) return { status: 0, body: null }
  try {
    const res = await fetch(`${STRAPI()}/api/events/${path}`, {
      headers: bridgeUserHeaders(user),
      cache: "no-store",
    })

    return {
      status: res.status,
      body: (await res.json().catch(() => null)) as T | null,
    }
  } catch {
    return { status: 0, body: null }
  }
}
```

Check `requireCapability`'s argument type and that the session user carries `claimedLibraryIds` (`buildSessionAccess` in `lib/session-access.ts`); adjust the `User` type to the real session type.

- [ ] **Step 3: Route handlers**

Each file is a thin wrapper. For example:

```ts
// apps/ui/src/app/api/contribute/event-feeds/route.ts
import { proxyEventFeed } from "@/lib/event-feed-proxy"

export const dynamic = "force-dynamic"

export function GET(req: Request) {
  return proxyEventFeed(req, { method: "GET", path: "feeds", kind: "read" })
}

export function POST(req: Request) {
  return proxyEventFeed(req, {
    method: "POST",
    path: "feeds",
    kind: "write",
    libraryFromBody: true,
    validateValues: "body",
  })
}
```

```ts
// apps/ui/src/app/api/contribute/event-feeds/[documentId]/pause/route.ts
import { proxyEventFeed } from "@/lib/event-feed-proxy"

export const dynamic = "force-dynamic"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  return proxyEventFeed(req, {
    method: "POST",
    path: `feeds/${documentId}/pause`,
    kind: "write",
  })
}
```

The rest follow the same pattern:

- `providers`: GET, `read`.
- `test`: POST, `test`, `libraryFromBody` and `validateValues: "body"`.
- `[documentId]/values`: PUT, `write`. The provider isn't in the body, so Strapi validates.
- `[documentId]/test`: POST, `test`.
- `resume`: POST, `write`.
- `pending`: DELETE, `write`.
- `[documentId]`: DELETE, `write`.

Delete `apps/ui/src/app/api/contribute/event-feed/route.ts`.

- [ ] **Step 4: Sentry scrub on the server**

```ts
// apps/ui/sentry.server.config.ts (and the same in sentry.edge.config.ts)
Sentry.init({
  dsn: getEnvVar("NEXT_PUBLIC_SENTRY_DSN"),
  tracesSampleRate: 0.3,
  debug: false,
  // Never send request bodies, cookies or headers: bodies can hold event
  // feed credentials and personal details. Mirrors Strapi's sentry-scrub.
  beforeSend(event) {
    if (event.request) {
      delete event.request.data
      delete event.request.cookies
      const ua = event.request.headers?.["user-agent"]
      event.request.headers = ua ? { "user-agent": ua } : {}
    }

    return event
  },
})
```

- [ ] **Step 5: Run the tests and commit**

Run: `cd apps/ui && pnpm vitest run src/lib/__tests__/event-feed-proxy.test.ts && pnpm typecheck`
Expected: PASS.

```bash
git add apps/ui/src/lib/event-feed-proxy.ts apps/ui/src/lib/__tests__/event-feed-proxy.test.ts apps/ui/src/app/api/contribute apps/ui/sentry.server.config.ts apps/ui/sentry.edge.config.ts
git commit -m "feat(ui): event feed proxy routes with claim, value and rate checks"
```

### Task 14: Event feeds dashboard

**Files:**

- Modify: `apps/ui/src/app/[locale]/contribute/events/page.tsx` (rewrite)
- Create: `apps/ui/src/components/event-feeds/types.ts`, `FeedStatusBadge.tsx`, `FeedRow.tsx`, `LibraryFeedsSection.tsx`, `feed-copy.ts`
- Delete: `apps/ui/src/app/[locale]/contribute/events/_components/EventFeedForm.tsx` (Task 15 replaces it)
- Test: `apps/ui/src/components/event-feeds/__tests__/feed-copy.test.ts`

**Interfaces:**

- Consumes: `fetchEventFeeds` (Task 13); `FEED_TEST_COPY`, `FEED_TEST_LABEL` and `EVENT_PROVIDERS` from `@repo/shared-data`.
- Produces:
  - `types.ts`: `FeedView`, `LibraryFeeds` (the same shapes as Task 7's Interfaces)
  - `feed-copy.ts`: `feedStatusOf(feed: FeedView): { key: "active" | "paused" | "waiting" | "needs_changes" | "stopped"; label: string; icon: string; tone: "ok" | "info" | "warn" }` and `syncLine(feed: FeedView, now?: Date): string`

- [ ] **Step 1: Write the failing copy test**

```ts
// apps/ui/src/components/event-feeds/__tests__/feed-copy.test.ts
import { describe, expect, it } from "vitest"

import { feedStatusOf, syncLine } from "../feed-copy"

const base: any = {
  status: "active",
  pausedReason: null,
  review: null,
  lastSyncAt: null,
  upcomingEvents: 0,
  lastErrorCode: null,
}

describe("feedStatusOf", () => {
  it.each([
    [{ ...base }, "active", "Active"],
    [
      { ...base, status: "paused", pausedReason: "library" },
      "paused",
      "Paused",
    ],
    [
      { ...base, status: "paused", pausedReason: "sync_failures" },
      "stopped",
      "Stopped working",
    ],
    [
      {
        ...base,
        status: "pending",
        review: { status: "pending", kind: "connect" },
      },
      "waiting",
      "Waiting for review",
    ],
    [
      {
        ...base,
        status: "pending",
        review: { status: "needs_info", kind: "connect" },
      },
      "needs_changes",
      "Needs changes",
    ],
  ])("%o", (feed, key, label) => {
    expect(feedStatusOf(feed)).toMatchObject({ key, label })
  })
})

describe("syncLine", () => {
  it("says when it last synced and what's coming", () => {
    const now = new Date("2026-10-06T12:00:00Z")
    expect(
      syncLine(
        { ...base, lastSyncAt: "2026-10-06T09:00:00Z", upcomingEvents: 12 },
        now
      )
    ).toBe("Last synced 3 hours ago · 12 upcoming events")
    expect(syncLine({ ...base, upcomingEvents: 1 }, now)).toBe(
      "Not synced yet · 1 upcoming event"
    )
  })
})
```

Run: `cd apps/ui && pnpm vitest run src/components/event-feeds`
Expected: FAIL.

- [ ] **Step 2: Implement `types.ts` and `feed-copy.ts`**

```ts
// apps/ui/src/components/event-feeds/types.ts
import type { EventProviderKey, FeedTestCode } from "@repo/shared-data"

export type FeedView = {
  documentId: string
  provider: EventProviderKey
  label: string
  scope: "library" | "group"
  status: "draft" | "pending" | "active" | "paused"
  pausedReason: "library" | "admin" | "sync_failures" | null
  managedBy: "library" | "admin_group"
  hints: Record<string, string>
  pendingHints: Record<string, string> | null
  review: {
    submissionDocumentId: string
    kind: "connect" | "replace"
    status: string
    note: string | null
  } | null
  lastTestedAt: string | null
  lastTestResult: FeedTestCode | null
  lastSyncAt: string | null
  lastSyncStatus: "ok" | "partial" | "error" | null
  lastErrorCode: FeedTestCode | null
  upcomingEvents: number
}

export type LibraryFeeds = {
  library: { documentId: string; name: string; slug: string | null }
  feeds: FeedView[]
}
```

```ts
// apps/ui/src/components/event-feeds/feed-copy.ts
import type { FeedView } from "./types"

export function feedStatusOf(feed: FeedView) {
  if (feed.status === "pending" || feed.status === "draft") {
    return feed.review?.status === "needs_info"
      ? ({
          key: "needs_changes",
          label: "Needs changes",
          icon: "mdi:message-alert-outline",
          tone: "warn",
        } as const)
      : ({
          key: "waiting",
          label: "Waiting for review",
          icon: "mdi:clock-outline",
          tone: "info",
        } as const)
  }
  if (feed.status === "paused")
    return feed.pausedReason === "sync_failures"
      ? ({
          key: "stopped",
          label: "Stopped working",
          icon: "mdi:alert-circle-outline",
          tone: "warn",
        } as const)
      : ({
          key: "paused",
          label: "Paused",
          icon: "mdi:pause-circle-outline",
          tone: "info",
        } as const)

  return {
    key: "active",
    label: "Active",
    icon: "mdi:check-circle-outline",
    tone: "ok",
  } as const
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
function ago(iso: string, now: Date): string {
  const mins = Math.round((Date.parse(iso) - now.getTime()) / 60_000)
  if (Math.abs(mins) < 60) return rtf.format(mins, "minute")
  const hours = Math.round(mins / 60)
  if (Math.abs(hours) < 48) return rtf.format(hours, "hour")

  return rtf.format(Math.round(hours / 24), "day")
}

export function syncLine(feed: FeedView, now = new Date()): string {
  const when = feed.lastSyncAt
    ? `Last synced ${ago(feed.lastSyncAt, now)}`
    : "Not synced yet"
  const n = feed.upcomingEvents

  return `${when} · ${n} upcoming event${n === 1 ? "" : "s"}`
}
```

Run the test. Expected: PASS.

- [ ] **Step 3: Components and page**

`FeedStatusBadge.tsx` renders a pill with the icon and label. Tones: ok uses `var(--tint-public-bg)` on `T.accent.ok`, info uses `T.accent.chip` on `T.accent.primary`, warn uses `#F5EEDC` on `#6B5420`, the same warn pair `ClaimPanel` uses.

`FeedRow.tsx` (`"use client"`) shows:

- the provider label and `FeedStatusBadge`;
- each hint as a `<dl>` row (field label from `EVENT_PROVIDERS[provider].fields`);
- `syncLine(feed)`;
- `FEED_TEST_COPY[lastErrorCode]` when `lastErrorCode` is set and not `ok`;
- the review note in a `Notice tone="warn"` when the review is `needs_info`;
- "New details waiting for review" with a **Withdraw** button when `pendingHints` is set.

Actions:

- **Test** posts to `/api/contribute/event-feeds/${id}/test` and announces the result in an `aria-live="polite"` region using `FEED_TEST_COPY`.
- **Replace details** links to `/contribute/events/${id}/replace`.
- **Pause** and **Resume** post to their routes.
- **Disconnect** opens a confirm `<dialog>` naming the library and provider ("Disconnect the Eventbrite feed for Central Library? Its events will be removed from Libraries Global.") and then sends DELETE.
- After any action, `router.refresh()`.

For `managedBy === "admin_group"`, render only the status, provider and "Managed by Libraries Global"; no actions. Buttons use the secondary pill pattern; Disconnect uses `T.accent.danger` text.

`LibraryFeedsSection.tsx` is a white card (`T.bg.deep`, `T.border.line`, radius 20) with the library name as a serif h2 linking to the library page (`fetchPlaceLink` is unnecessary: use `/libraries?q=` only if there's no slug; otherwise the page passes an href), the feed rows, an empty state ("No event feeds yet. Connect one and its events appear on this library's page."), and a primary pill **Connect a feed** linking to `/contribute/events/connect?library=${documentId}`. Give the section `id={`library-${documentId}`}`, and when `highlight` is true add an indigo 2px outline plus `scrollIntoView` on mount.

`page.tsx`:

```tsx
// apps/ui/src/app/[locale]/contribute/events/page.tsx
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { LibraryFeedsSection } from "@/components/event-feeds/LibraryFeedsSection"
import type { LibraryFeeds } from "@/components/event-feeds/types"
import { getSessionSSR } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { fetchEventFeeds } from "@/lib/event-feed-proxy"
import { privateMetadata } from "@/lib/seo/metadata"

import { ContributeSectionHeader } from "../_components/ContributeSectionHeader"
import { ClaimFirst } from "./_components/ClaimFirst"
import { FeedsAside } from "./_components/FeedsAside"

export const metadata = privateMetadata("Event feeds")

export default async function ContributeEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ library?: string }>
}) {
  const session = await getSessionSSR(await headers())
  if (!session?.user) redirect("/auth/signin?callbackUrl=/contribute/events")
  const caps = (session.user as { capabilities?: string[] }).capabilities ?? []
  const { library: highlight } = await searchParams
  const result = caps.includes("events.feed")
    ? await fetchEventFeeds<{ data: { libraries: LibraryFeeds[] } }>(
        session.user as any
      )
    : null
  const libraries = result?.body?.data?.libraries ?? []

  return (
    <div
      style={{ background: T.bg.void, minHeight: "100vh", color: T.ink.base }}
    >
      <ContributeSectionHeader
        compact
        section="Event feeds"
        title="Your library's *event feeds.*"
        lead="Connect the platform your library publishes events on. Every new connection is reviewed before we sync it."
      />
      <div className="mx-auto w-full max-w-[1360px] px-4 pt-10 pb-20 sm:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          <div className="flex max-w-[820px] min-w-0 flex-col gap-6">
            {!caps.includes("events.feed") ? (
              <ClaimFirst />
            ) : result && result.status !== 200 ? (
              <p role="alert" style={{ color: T.accent.danger }}>
                We couldn't load your feeds. Try again in a minute.
              </p>
            ) : (
              libraries.map((l) => (
                <LibraryFeedsSection
                  key={l.library.documentId}
                  entry={l}
                  highlight={highlight === l.library.documentId}
                />
              ))
            )}
          </div>
          <FeedsAside />
        </div>
      </div>
    </div>
  )
}
```

`_components/ClaimFirst.tsx` is today's "Verified librarian required" section, moved out of the old page verbatim; change the heading to "Claim your library first" and keep the CTA. `_components/FeedsAside.tsx` is today's aside, with steps updated to:

1. "Pick a platform" (the seven labels).
2. "Test the connection" ("We check the details work before anything is saved").
3. "A moderator reviews it" ("They see whether the test passed, never the details themselves").
4. "Events appear on your library's page".

Its closing line: "Only Libraries Global staff can read stored details. Every access is logged."

Delete the old `EventFeedForm.tsx`.

- [ ] **Step 4: Typecheck, lint, run, commit**

Run: `cd apps/ui && pnpm typecheck && pnpm lint --quiet && pnpm vitest run src/components/event-feeds`
Expected: PASS.

```bash
git add apps/ui/src/app/[locale]/contribute/events apps/ui/src/components/event-feeds
git commit -m "feat(ui): event feeds dashboard for claimed libraries"
```

### Task 15: Connect and replace forms

**Files:**

- Create: `apps/ui/src/app/[locale]/contribute/events/connect/page.tsx`
- Create: `apps/ui/src/app/[locale]/contribute/events/[documentId]/replace/page.tsx`
- Create: `apps/ui/src/components/event-feeds/FeedValuesFields.tsx`, `ConnectFeedForm.tsx`, `ReplaceFeedForm.tsx`, `useFeedTest.ts`
- Test: `apps/ui/src/components/event-feeds/__tests__/ConnectFeedForm.test.tsx`

**Interfaces:**

- Consumes: the `/api/contribute/event-feeds` and `/test` routes (Task 13); `EVENT_PROVIDERS`, `validateFeedValues`, `FEED_TEST_COPY` and `FEED_TEST_BLOCKING` from `@repo/shared-data`.
- Produces:
  - `FeedValuesFields` with props `{ provider: EventProviderKey; values: Record<string,string>; onChange(next): void; currentHints?: Record<string,string>; errorField?: string }`
  - `ConnectFeedForm` with props `{ libraries: { documentId: string; name: string }[]; initialLibrary?: string; oauth: { eventbrite: boolean } }`
  - `ReplaceFeedForm` with props `{ feed: FeedView; libraryName: string }`

- [ ] **Step 1: Write the failing component test**

```tsx
// apps/ui/src/components/event-feeds/__tests__/ConnectFeedForm.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { ConnectFeedForm } from "../ConnectFeedForm"

const LIBS = [
  { documentId: "lib00000000000000000001", name: "Central Library" },
]

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith("/test")
              ? { data: { result: "auth_failed" } }
              : { data: { result: "ok", submissionDocumentId: "s1" } }
          ),
          { status: 200 }
        )
    )
  )
})

describe("ConnectFeedForm", () => {
  it("preselects a single library and shows the provider's fields", () => {
    render(<ConnectFeedForm libraries={LIBS} oauth={{ eventbrite: false }} />)
    expect(screen.getByText("Central Library")).toBeTruthy()
    fireEvent.click(screen.getByRole("radio", { name: /Calendar feed/ }))
    expect(screen.getByLabelText(/Calendar address/)).toBeTruthy()
  })

  it("marks secret inputs as passwords that browsers won't autofill", () => {
    render(<ConnectFeedForm libraries={LIBS} oauth={{ eventbrite: false }} />)
    fireEvent.click(screen.getByRole("radio", { name: /TicketSource/ }))
    const input = screen.getByLabelText(/API key/) as HTMLInputElement
    expect(input.type).toBe("password")
    expect(input.autocomplete).toBe("new-password")
  })

  it("shows the test result in plain words and blocks sending on a fixable failure", async () => {
    render(<ConnectFeedForm libraries={LIBS} oauth={{ eventbrite: false }} />)
    fireEvent.click(screen.getByRole("radio", { name: /TicketSource/ }))
    fireEvent.change(screen.getByLabelText(/API key/), {
      target: { value: "ts_live_ABCDEFGHIJ" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }))
    await waitFor(() =>
      expect(screen.getByText(/refused these details/)).toBeTruthy()
    )
    expect(
      (
        screen.getByRole("button", {
          name: "Send for review",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })
})
```

Run: `cd apps/ui && pnpm vitest run src/components/event-feeds/__tests__/ConnectFeedForm.test.tsx`
Expected: FAIL.

- [ ] **Step 2: Implement the fields, the hook and the forms**

```tsx
// apps/ui/src/components/event-feeds/FeedValuesFields.tsx
"use client"

import { EVENT_PROVIDERS, type EventProviderKey } from "@repo/shared-data"
import { useId, useState } from "react"

import { T } from "@/lib/design-tokens"

import {
  fieldHintStyle,
  fieldInputStyle,
  fieldLabelStyle,
} from "@/app/[locale]/contribute/index/_components/wizard.constants"

/** One provider's fields from the registry. Secrets are write-only inputs. */
export function FeedValuesFields({
  provider,
  values,
  onChange,
  currentHints,
  errorField,
}: {
  readonly provider: EventProviderKey
  readonly values: Record<string, string>
  readonly onChange: (next: Record<string, string>) => void
  readonly currentHints?: Record<string, string>
  readonly errorField?: string
}) {
  const id = useId()
  const [shown, setShown] = useState<Record<string, boolean>>({})

  return (
    <div className="flex flex-col gap-5">
      {EVENT_PROVIDERS[provider].fields.map((f) => {
        const inputId = `${id}-${f.key}`
        const hintId = `${inputId}-hint`

        return (
          <div key={f.key} className="flex flex-col gap-1.5">
            <label htmlFor={inputId} style={fieldLabelStyle}>
              {f.label}
              {f.required ? null : (
                <span style={{ color: T.ink.dim, fontWeight: 400 }}>
                  {" "}
                  (optional)
                </span>
              )}
            </label>
            <div className="flex items-center gap-2">
              <input
                id={inputId}
                name={f.key}
                type={
                  f.secret && !shown[f.key]
                    ? "password"
                    : f.kind === "url"
                      ? "url"
                      : "text"
                }
                autoComplete={f.secret ? "new-password" : "off"}
                spellCheck={false}
                data-sentry-mask
                aria-describedby={
                  f.hint || currentHints?.[f.key] ? hintId : undefined
                }
                aria-invalid={errorField === f.key || undefined}
                placeholder={
                  currentHints?.[f.key]
                    ? `Now: ${currentHints[f.key]}`
                    : undefined
                }
                value={values[f.key] ?? ""}
                maxLength={f.maxLength}
                onChange={(e) =>
                  onChange({ ...values, [f.key]: e.target.value })
                }
                style={{ ...fieldInputStyle, flex: 1 }}
              />
              {f.secret ? (
                <button
                  type="button"
                  className="rounded-full border px-3 py-2 text-[13px] font-semibold"
                  style={{
                    borderColor: T.border.hi,
                    color: T.ink.base,
                    background: T.bg.deep,
                  }}
                  aria-pressed={!!shown[f.key]}
                  onClick={() =>
                    setShown((s) => ({ ...s, [f.key]: !s[f.key] }))
                  }
                >
                  {shown[f.key] ? "Hide" : "Show"}
                </button>
              ) : null}
            </div>
            {f.hint ? (
              <p id={hintId} style={fieldHintStyle}>
                {f.hint}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
```

```ts
// apps/ui/src/components/event-feeds/useFeedTest.ts
"use client"

import type { FeedTestCode } from "@repo/shared-data"
import { useState } from "react"

/** Runs a connection test through the proxy; the result is a code. */
export function useFeedTest() {
  const [state, setState] = useState<{
    busy: boolean
    result: FeedTestCode | null
    error: string | null
  }>({
    busy: false,
    result: null,
    error: null,
  })
  async function run(url: string, body?: unknown) {
    setState({ busy: true, result: null, error: null })
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setState({
          busy: false,
          result: null,
          error: json?.error?.message ?? "The test couldn't run. Try again.",
        })
        return null
      }
      setState({ busy: false, result: json.data.result, error: null })
      return json.data.result as FeedTestCode
    } catch {
      setState({
        busy: false,
        result: null,
        error: "The test couldn't run. Check your connection.",
      })
      return null
    }
  }

  return {
    ...state,
    run,
    reset: () => setState({ busy: false, result: null, error: null }),
  }
}
```

`ConnectFeedForm.tsx` (`"use client"`) has three fieldsets with legends:

1. **Library.** With one library, it shows the name as text. With several, a `<select>`, initialised from `initialLibrary`.
2. **Platform.** Radio cards built from `EVENT_PROVIDERS` (use the DS `ChoiceCard`; check its props in `components/ds/ChoiceCard.tsx`), labelled with each provider's `label` and `description`. When `oauth.eventbrite` is true and Eventbrite is chosen, show a primary pill link **Connect with Eventbrite** to `/api/contribute/event-feeds/eventbrite/start?library=<id>`, with "Or paste a private token" beneath it opening the manual fields.
3. **Details.** `FeedValuesFields`, then **Test connection** (secondary pill) and **Send for review** (primary pill).

Behaviour:

- Changing any value calls `test.reset()`.
- Test runs `validateFeedValues` locally first; on failure it shows the message inline and focuses `errorField`. It then calls `test.run("/api/contribute/event-feeds/test", { libraryDocumentId, provider, values })`.
- Show the result in a `Notice` inside an `aria-live="polite"` region: tone ok for `ok`, warn otherwise, with `FEED_TEST_COPY[result]`.
- Send is disabled until a test has run and its result isn't in `FEED_TEST_BLOCKING`.
- Send posts `/api/contribute/event-feeds`. On 200, clear `values` and `router.push("/contribute/events?library=<id>")`. On 422, show `FEED_TEST_COPY[error.result]`; on any other error, show `error.message`.
- No draft persistence of any kind.

`ReplaceFeedForm.tsx` is the same details step for `feed.provider`, with `currentHints={feed.hints}`. Test uses `/api/contribute/event-feeds/test` with the feed's library and provider; Send uses PUT `/api/contribute/event-feeds/${feed.documentId}/values` with `{ values }`. It explains: "Your current details keep working until a moderator approves the new ones."

Pages:

- `connect/page.tsx` (RSC): same session and capability gate as the dashboard. It loads `fetchEventFeeds(user)` for the library list and `fetchEventFeeds(user, "feeds/providers")` for `oauth`, then renders `ContributeSectionHeader` (`section="Connect a feed"`, title "Connect an _event feed._", `back`) with `ConnectFeedForm`, passing `initialLibrary` from `?library`.
- `[documentId]/replace/page.tsx`: validates the param with `isDocumentIdParam` and finds the feed in the list response. A feed that's missing, `admin_group` or not `active`/`paused` calls `notFound()`. Otherwise it renders `ReplaceFeedForm`.

- [ ] **Step 3: Run the tests and commit**

Run: `cd apps/ui && pnpm vitest run src/components/event-feeds && pnpm typecheck && pnpm lint --quiet`
Expected: PASS.

```bash
git add apps/ui/src/app/[locale]/contribute/events apps/ui/src/components/event-feeds
git commit -m "feat(ui): connect and replace event feed forms with a connection test"
```

### Task 16: Site moderation panel and touchpoints

**Files:**

- Create: `apps/ui/src/components/moderation/EventFeedPanel.tsx`, `apps/ui/src/components/moderation/FeedTestButton.tsx`
- Modify: `apps/ui/src/components/moderation/index.ts`, `submissionMeta.ts` (`TYPE_LABELS`, `TYPE_COLORS`, `summaryOf`, `detailOf`, `REFUSAL_COPY` for `claim_lost`/`feed_mismatch`), `__tests__/submissionMeta.test.ts`
- Modify: `apps/ui/src/app/[locale]/contribute/moderation/[documentId]/page.tsx` (`PANELS`, `PANEL_TITLES`, `targetLinks`, approve label)
- Create: `apps/ui/src/app/api/moderation/submissions/[documentId]/feed-test/route.ts`
- Modify: `apps/ui/src/components/contributions/contributions.ts` (`KIND_META.event_feed`) and any per-type maps in `apps/ui/src/app/[locale]/profile/[username]/_components/sections/ContributionsSection.tsx` and `ActivitySection.tsx`
- Modify: `apps/ui/src/components/library/LibraryHelpPanel.tsx:289` (link `?library=`)
- Modify: `apps/ui/src/lib/contributor-shortcuts.ts` (label "Event feeds")
- Test: `apps/ui/src/components/moderation/__tests__/EventFeedPanel.test.tsx`

**Interfaces:**

- Consumes: `review` from Task 10 (`EventFeedReview`); `proxyModeration` (existing).

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/ui/src/components/moderation/__tests__/EventFeedPanel.test.tsx
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { EventFeedPanel } from "../EventFeedPanel"

const review = {
  credentialDocumentId: "cred00000000000000000001",
  exists: true,
  status: "pending",
  kind: "connect",
  provider: "ical",
  library: { documentId: "lib1", name: "Central Library", slug: "central" },
  currentHints: {},
  newHints: { feedUrl: "https://cal.example.org/…" },
  submittedTest: { result: "ok", testedAt: "2026-10-06T09:00:00Z" },
  latestTest: { result: "auth_failed", testedAt: "2026-10-06T11:00:00Z" },
  submitterHoldsClaim: false,
}

describe("EventFeedPanel", () => {
  it("shows both test results as text, the hints and a lost-claim warning", () => {
    render(
      <EventFeedPanel
        documentId="sub1"
        status="pending"
        review={review as any}
      />
    )
    expect(screen.getByText(/Passed/)).toBeTruthy()
    expect(screen.getByText(/Sign-in refused/)).toBeTruthy()
    expect(screen.getByText("https://cal.example.org/…")).toBeTruthy()
    expect(screen.getByText(/no longer holds a claim/)).toBeTruthy()
  })
})
```

In `submissionMeta.test.ts`, add `event_feed` to the parity loop the file already runs, comparing the admin and UI `TYPE_LABELS`, `summaryOf` and `detailOf`. Add refusal copy assertions for `claim_lost` and `feed_mismatch`.

Run: `cd apps/ui && pnpm vitest run src/components/moderation`
Expected: FAIL.

- [ ] **Step 2: Implement**

```tsx
// apps/ui/src/components/moderation/EventFeedPanel.tsx
import {
  EVENT_PROVIDERS,
  type EventProviderKey,
  FEED_TEST_COPY,
  FEED_TEST_LABEL,
  type FeedTestCode,
} from "@repo/shared-data"
import { Icon } from "@iconify/react"

import { Notice } from "@/components/ds"
import { T } from "@/lib/design-tokens"

import { FeedTestButton } from "./FeedTestButton"
import { formatDateTime } from "./submissionMeta"

export type EventFeedReview = {
  credentialDocumentId: string
  exists: boolean
  status: string | null
  kind: "connect" | "replace"
  provider: string
  library: { documentId: string; name: string; slug: string | null } | null
  currentHints: Record<string, string>
  newHints: Record<string, string>
  submittedTest: { result: FeedTestCode; testedAt: string } | null
  latestTest: { result: FeedTestCode; testedAt: string } | null
  submitterHoldsClaim: boolean
}

function TestLine({
  label,
  test,
}: {
  readonly label: string
  readonly test: EventFeedReview["submittedTest"]
}) {
  if (!test)
    return (
      <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
        {label}: not run
      </p>
    )
  const ok = test.result === "ok"

  return (
    <p
      className="m-0 flex items-start gap-2 text-[14px]"
      style={{ color: ok ? T.accent.ok : "#6B5420" }}
    >
      <Icon
        aria-hidden="true"
        icon={ok ? "mdi:check-circle-outline" : "mdi:alert-outline"}
        width={18}
        height={18}
        className="mt-0.5 shrink-0"
      />
      <span>
        <strong>
          {label}: {FEED_TEST_LABEL[test.result]}
        </strong>{" "}
        · {formatDateTime(test.testedAt)}
        {ok ? null : (
          <span style={{ color: T.ink.dim }}>
            {" "}
            — {FEED_TEST_COPY[test.result]}
          </span>
        )}
      </span>
    </p>
  )
}

/**
 * An Event Feed submission: the platform, the library, the masked details
 * (never the values) and whether the connection test passed. Only Strapi
 * admin can reveal a value.
 */
export function EventFeedPanel({
  documentId,
  status,
  review,
}: {
  readonly documentId: string
  readonly status: string
  readonly review: EventFeedReview | null
}) {
  if (!review)
    return (
      <p className="m-0" style={{ color: T.ink.dim }}>
        This feed's details couldn't be loaded.
      </p>
    )
  const def = EVENT_PROVIDERS[review.provider as EventProviderKey]
  const label = (key: string) =>
    def?.fields.find((f) => f.key === key)?.label ?? key
  const open = status === "pending" || status === "needs_info"

  return (
    <div className="flex flex-col gap-4">
      {!review.submitterHoldsClaim ? (
        <Notice icon="mdi:account-alert-outline" tone="warn" title="Claim lost">
          The submitter no longer holds a claim on this library. Reject this
          submission.
        </Notice>
      ) : null}
      {!review.exists ? (
        <Notice icon="mdi:link-off" tone="warn" title="Feed withdrawn">
          The library withdrew or disconnected this feed. Reject this
          submission.
        </Notice>
      ) : null}
      <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-[14px]">
        <dt style={{ color: T.ink.dim }}>Platform</dt>
        <dd className="m-0">{def?.label ?? review.provider}</dd>
        <dt style={{ color: T.ink.dim }}>Library</dt>
        <dd className="m-0">{review.library?.name ?? "Unknown"}</dd>
        <dt style={{ color: T.ink.dim }}>Kind</dt>
        <dd className="m-0">
          {review.kind === "replace"
            ? "New details for an active feed"
            : "New connection"}
        </dd>
        {Object.entries(review.newHints).map(([k, v]) => (
          <div key={k} className="contents">
            <dt style={{ color: T.ink.dim }}>
              {label(k)}
              {review.kind === "replace" ? " (new)" : ""}
            </dt>
            <dd
              className="m-0"
              style={{ fontFamily: T.font.mono, fontSize: "13px" }}
            >
              {v}
            </dd>
          </div>
        ))}
        {review.kind === "replace"
          ? Object.entries(review.currentHints).map(([k, v]) => (
              <div key={`c-${k}`} className="contents">
                <dt style={{ color: T.ink.dim }}>{label(k)} (current)</dt>
                <dd
                  className="m-0"
                  style={{ fontFamily: T.font.mono, fontSize: "13px" }}
                >
                  {v}
                </dd>
              </div>
            ))
          : null}
      </dl>
      <div className="flex flex-col gap-2" aria-live="polite">
        <TestLine label="Test when sent" test={review.submittedTest} />
        <TestLine label="Latest test" test={review.latestTest} />
      </div>
      {open && review.exists ? (
        <FeedTestButton documentId={documentId} />
      ) : null}
      <p className="m-0 text-[13px]" style={{ color: T.ink.dim }}>
        Details are encrypted. Moderators see only these masked hints; only
        Libraries Global staff can read a value.
      </p>
    </div>
  )
}
```

`FeedTestButton.tsx` (`"use client"`) is a secondary pill **Test again**. It sends PUT `/api/moderation/submissions/${documentId}/feed-test`, shows "Testing…" while busy, then calls `router.refresh()` so `latestTest` updates, and shows an error line on failure.

Route:

```ts
// apps/ui/src/app/api/moderation/submissions/[documentId]/feed-test/route.ts
import { proxyModeration } from "@/lib/moderation-proxy"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params

  return proxyModeration(req, {
    method: "PUT",
    path: `submissions/${documentId}/feed-test`,
    ids: [documentId],
    bodyKeys: [],
  })
}
```

Check `ProxyOptions` in `moderation-proxy.ts` for the exact option names and match them.

On the review page:

- `PANELS.event_feed = (d) => <EventFeedPanel documentId={d.documentId} status={d.status} review={d.review as EventFeedReview | null} />`;
- `PANEL_TITLES.event_feed = "The event feed"`;
- add `"event_feed"` to the `targetLinks` list beside `library_claim`;
- where the approve label special-cases a type (`grep -n "Approve" apps/ui/src/components/moderation/ReviewDecisionForm.tsx`), use "Approve and activate" for `event_feed`.

In `submissionMeta.ts`:

- `TYPE_LABELS.event_feed = "Event feed"`, with the same colour as `library_claim`;
- `summaryOf` and `detailOf` cases identical to the admin copy (Task 11);
- `REFUSAL_COPY.claim_lost = "The submitter no longer holds a claim on this library. Reject it instead."` and `REFUSAL_COPY.feed_mismatch = "This feed is no longer waiting on this submission. Reject it instead."`.

`contributions.ts` `KIND_META.event_feed` = `{ label: "Event feed", icon: "mdi:calendar-sync-outline", tint: the library_claim tint }`. Add the same key to the profile sections' maps if they have their own.

`LibraryHelpPanel.tsx`: the link becomes `href={`/contribute/events?library=${libraryDocumentId}`}` (the component has the documentId; check its props) and the label "Manage event feeds". In `contributor-shortcuts.ts`, the shortcut label becomes "Event feeds"; update its test.

- [ ] **Step 3: Run the tests and commit**

Run: `cd apps/ui && pnpm vitest run src/components/moderation src/lib/__tests__/contributor-shortcuts.test.ts && pnpm typecheck && pnpm lint --quiet`
Expected: PASS.

```bash
git add apps/ui/src/components/moderation apps/ui/src/app/[locale]/contribute/moderation apps/ui/src/app/api/moderation apps/ui/src/components/contributions apps/ui/src/app/[locale]/profile apps/ui/src/components/library/LibraryHelpPanel.tsx apps/ui/src/lib/contributor-shortcuts.ts apps/ui/src/lib/__tests__/contributor-shortcuts.test.ts
git commit -m "feat(ui): event feed review panel, re-test and contribution labels"
```

---

## Phase F: Worker

### Task 17: Per-feed sync, failure tracking and auto-pause

**Files:**

- Modify: `apps/sync-worker/src/pipeline/load-credentials.ts` (optional `credentialDocumentId`; `decrypt_failed` recorded)
- Modify: `apps/sync-worker/src/pipeline/sync.ts` (accept a scope; pass codes)
- Modify: `apps/sync-worker/src/pipeline/write-run.ts` (`updateCredentialStatus` writes the code and the failure count, and auto-pauses)
- Modify: `apps/sync-worker/src/cron.ts` (command carries `credential_document_id`)
- Modify: `apps/sync-worker/.env.example` (`EVENTS_AUTOPAUSE_AFTER=4`)
- Test: `apps/sync-worker/tests/pipeline/write-run.test.ts` (new), extend `load-credentials.test.ts`

**Interfaces:**

- Produces:
  - `loadCredentials(opts?: { credentialDocumentId?: string }): Promise<LoadedCredential[]>`
  - `runSync(trigger: "cron" | "manual", requestedByUserId?: string, opts?: { credentialDocumentId?: string })`
  - `updateCredentialStatus(credentialId: number, outcome: { ok: true } | { ok: false; code: FeedTestCode; message: string }): Promise<void>`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/sync-worker/tests/pipeline/write-run.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

const calls: any[] = []
vi.mock("../../src/db", () => {
  const builder: any = {
    where: vi.fn(() => builder),
    update: vi.fn(async (data: any) => {
      calls.push(data)
      return 1
    }),
    increment: vi.fn(() => builder),
    returning: vi.fn(async () => [
      { consecutive_failures: (globalThis as any).__failures ?? 1 },
    ]),
    first: vi.fn(async () => ({
      consecutive_failures: (globalThis as any).__failures ?? 1,
    })),
  }
  const db: any = vi.fn(() => builder)
  db.raw = vi.fn((s: string) => s)

  return { default: db }
})

import { updateCredentialStatus } from "../../src/pipeline/write-run"

beforeEach(() => {
  calls.length = 0
  process.env.EVENTS_AUTOPAUSE_AFTER = "4"
})

describe("updateCredentialStatus", () => {
  it("resets the failure count on success", async () => {
    await updateCredentialStatus(7, { ok: true })
    expect(calls[0]).toMatchObject({
      last_sync_status: "ok",
      consecutive_failures: 0,
      last_error_code: null,
    })
  })

  it("records the code and pauses after the threshold", async () => {
    ;(globalThis as any).__failures = 4
    await updateCredentialStatus(7, {
      ok: false,
      code: "auth_failed",
      message: "401 https://x.example/?t=s",
    })
    expect(
      calls.some(
        (c) => c.status === "paused" && c.paused_reason === "sync_failures"
      )
    ).toBe(true)
    expect(JSON.stringify(calls)).not.toContain("t=s")
  })

  it("doesn't pause before the threshold", async () => {
    ;(globalThis as any).__failures = 2
    await updateCredentialStatus(7, {
      ok: false,
      code: "unreachable",
      message: "timeout",
    })
    expect(calls.some((c) => c.status === "paused")).toBe(false)
  })
})
```

Run: `cd apps/sync-worker && pnpm vitest run tests/pipeline/write-run.test.ts`
Expected: FAIL (the old signature is `(id, status, message)`).

- [ ] **Step 2: Implement**

```ts
// apps/sync-worker/src/pipeline/write-run.ts — replace updateCredentialStatus
import type { FeedTestCode } from "@repo/shared-data"
import { redactUrlsInText } from "@repo/event-providers"

const autoPauseAfter = () =>
  Math.max(1, Number(process.env.EVENTS_AUTOPAUSE_AFTER ?? 4) || 4)

/**
 * One feed's sync outcome on its credential row. Failures count up; after
 * EVENTS_AUTOPAUSE_AFTER in a row the feed is paused (`sync_failures`) and
 * Strapi's cron tells its librarians. Messages are redacted; only Strapi
 * admin reads them, everyone else sees the code.
 */
export async function updateCredentialStatus(
  credentialId: number,
  outcome: { ok: true } | { ok: false; code: FeedTestCode; message: string }
): Promise<void> {
  const now = new Date().toISOString()
  if (outcome.ok) {
    await db("ev_event_credentials").where("id", credentialId).update({
      last_sync_at: now,
      last_sync_status: "ok",
      last_error_code: null,
      last_error_message: null,
      consecutive_failures: 0,
    })
    return
  }
  await db("ev_event_credentials")
    .where("id", credentialId)
    .update({
      last_sync_at: now,
      last_sync_status: "error",
      last_error_code: outcome.code,
      last_error_message: redactUrlsInText(outcome.message).slice(0, 1000),
      consecutive_failures: db.raw("COALESCE(consecutive_failures, 0) + 1"),
    })
  const row = await db("ev_event_credentials")
    .where("id", credentialId)
    .first("consecutive_failures")
  if ((row?.consecutive_failures ?? 0) >= autoPauseAfter())
    await db("ev_event_credentials")
      .where("id", credentialId)
      .where("status", "active")
      .update({
        status: "paused",
        paused_reason: "sync_failures",
        auto_pause_notified_at: null,
      })
}
```

In `sync.ts`, update the three call sites:

- unknown provider: `updateCredentialStatus(cred.id, { ok: false, code: "provider_error", message })`;
- fetch threw: `updateCredentialStatus(cred.id, { ok: false, code: classifyFailure(err), message: err.message })`;
- success: `updateCredentialStatus(cred.id, { ok: true })`.

Pass validation failures (Task 2 gave them `code`) through `updateCredentialStatus(f.credential.id, { ok: false, code: f.code, message: f.error })`. Add `opts?: { credentialDocumentId?: string }` to `runSync` and forward it to `loadCredentials(opts)`.

In `load-credentials.ts`:

- add `if (opts?.credentialDocumentId) query.where("ec.document_id", opts.credentialDocumentId)`;
- in the decrypt `catch`, call `await updateCredentialStatus(row.id, { ok: false, code: "decrypt_failed", message: "Stored value could not be decrypted" })` before `continue`.

In `cron.ts`, select `credential_document_id` with the command and call `runSync("manual", cmd.requested_by_user_id, { credentialDocumentId: cmd.credential_document_id ?? undefined })`.

Add a `load-credentials` test: with `credentialDocumentId`, the query is filtered; and a row that fails to decrypt calls `updateCredentialStatus` with `decrypt_failed`.

- [ ] **Step 3: Run the tests and commit**

Run: `pnpm --filter @repo/sync-worker typecheck && pnpm --filter @repo/sync-worker test`
Expected: PASS.

```bash
git add apps/sync-worker
git commit -m "feat(sync-worker): per-feed sync, failure codes and auto-pause"
```

---

## Phase G: Eventbrite OAuth

### Task 18: Strapi exchange and organisation completion

**Files:**

- Create: `apps/strapi/src/plugins/events/server/services/feed-oauth.ts`
- Modify: `apps/strapi/src/plugins/events/server/services/index.ts`, `controllers/feeds.ts`, `routes/content-api.ts`
- Modify: `apps/strapi/.env.example` (`EVENTBRITE_CLIENT_ID`, `EVENTBRITE_CLIENT_SECRET`, `EVENTBRITE_REDIRECT_URI`)
- Test: `apps/strapi/tests/events/feed-oauth.test.ts`

**Interfaces:**

- Produces:
  - `feedOauth.exchangeEventbrite(user: FeedUser, input: { code: string; libraryDocumentId: string }) → { credentialDocumentId: string; organizations: { id: string; name: string }[]; completed?: { submissionDocumentId: string; result: FeedTestCode } } | FeedError`
  - `feedOauth.completeEventbrite(user, documentId, organizationId) → { submissionDocumentId; result } | FeedError`
  - Routes: `POST /feeds/oauth/eventbrite` and `POST /feeds/:documentId/organization` (bridge-gated, via `run`)

Before writing code, check Eventbrite's OAuth documentation (`https://www.eventbrite.com/platform/docs/authentication`) for:

- whether the token response carries `expires_in` or a `refresh_token`;
- the organisations endpoint (`/v3/users/me/organizations/`).

Record what you find in a comment at the top of `feed-oauth.ts`. If tokens expire, add `refreshToken` to the stored values and make the Eventbrite provider refresh; that is out of this plan's scope, so stop and report.

- [ ] **Step 1: Write the failing test**

```ts
// apps/strapi/tests/events/feed-oauth.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest"

import oauthFactory from "../../src/plugins/events/server/services/feed-oauth"
import { openValues } from "../../src/plugins/events/server/utils/credential-crypto"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const CRED = "plugin::events.event-credential"
const L1 = "lib00000000000000000001"
const USER = { id: "u1", email: "u@x.org", name: "U" }

beforeEach(() => {
  process.env.EVENTS_CREDENTIAL_KEY = "e".repeat(64)
  process.env.EVENTBRITE_CLIENT_ID = "cid"
  process.env.EVENTBRITE_CLIENT_SECRET = "csecret"
  process.env.EVENTBRITE_REDIRECT_URI =
    "https://libraries.global/api/contribute/event-feeds/eventbrite/callback"
})

function setup(orgs: { id: string; name: string }[]) {
  const fake = makeFakeStrapi({
    [CRED]: [],
    "plugin::events.credential-event": [],
    "api::library.library": [{ documentId: L1, name: "Central" }],
  })
  const http = vi.fn(async (url: string, init?: any) => {
    if (url.endsWith("/oauth/token")) {
      expect(String(init.body)).toContain("client_secret=csecret")
      return new Response(
        JSON.stringify({
          access_token: "EB_TOKEN_ABCDEFGHIJKL",
          token_type: "bearer",
        }),
        { status: 200 }
      )
    }
    return new Response(JSON.stringify({ organizations: orgs }), {
      status: 200,
    })
  })
  const complete = vi.fn(async () => ({
    submissionDocumentId: "s1",
    result: "ok",
  }))
  const claims = new Set([L1])
  fake.strapi.plugin = vi.fn(() => ({
    service: (s: string) =>
      s === "submission-policy"
        ? {
            loadCapabilities: async () => ({
              caps: {
                claimedLibraryIds: claims,
                set: new Set(["events.feed"]),
              },
            }),
          }
        : undefined,
  }))
  const svc = oauthFactory({
    strapi: fake.strapi,
    http,
    completeDraft: complete,
  })

  return { ...fake, svc, http, complete }
}

describe("Eventbrite OAuth", () => {
  it("stores the token encrypted on a draft and lists organisations", async () => {
    const { svc, store } = setup([
      { id: "111", name: "A" },
      { id: "222", name: "B" },
    ])
    const r: any = await svc.exchangeEventbrite(USER, {
      code: "c0de",
      libraryDocumentId: L1,
    })
    const row = store[CRED]![0]!
    expect(row.status).toBe("draft")
    expect(
      openValues(row.credentialsEncrypted, row.documentId, "current")
    ).toEqual({ accessToken: "EB_TOKEN_ABCDEFGHIJKL" })
    expect(r.organizations).toHaveLength(2)
    expect(JSON.stringify(r)).not.toContain("EB_TOKEN")
  })

  it("completes at once when there is one organisation", async () => {
    const { svc, complete } = setup([{ id: "111", name: "A" }])
    const r: any = await svc.exchangeEventbrite(USER, {
      code: "c0de",
      libraryDocumentId: L1,
    })
    expect(complete).toHaveBeenCalledWith(USER, expect.any(String), "111")
    expect(r.completed).toEqual({ submissionDocumentId: "s1", result: "ok" })
  })

  it("refuses an unclaimed library and an unconfigured app", async () => {
    const { svc } = setup([])
    expect(
      await svc.exchangeEventbrite(USER, {
        code: "c",
        libraryDocumentId: "libX0000000000000000001",
      })
    ).toMatchObject({ error: { status: 404 } })
    delete process.env.EVENTBRITE_CLIENT_SECRET
    expect(
      await svc.exchangeEventbrite(USER, { code: "c", libraryDocumentId: L1 })
    ).toMatchObject({ error: { status: 503 } })
  })
})
```

Run: `cd apps/strapi && pnpm vitest run tests/events/feed-oauth.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement**

```ts
// apps/strapi/src/plugins/events/server/services/feed-oauth.ts
import { feedHints } from "@repo/shared-data"

import { CREDENTIAL_UID } from "./credentials"
import { sealValues } from "../utils/credential-crypto"
import { claimedLibraryIds } from "../utils/feed-access"

const TOKEN_URL = "https://www.eventbrite.com/oauth/token"
const ORGS_URL = "https://www.eventbriteapi.com/v3/users/me/organizations/"

type Deps = {
  strapi: any
  http?: typeof fetch
  /** Finishes a draft: sets organizationId, tests, opens the review (feeds.completeDraft). */
  completeDraft?: (
    user: any,
    documentId: string,
    organizationId: string
  ) => Promise<any>
}

const fail = (status: number, name: string, message: string) => ({
  error: { status, name, message },
})

export default ({ strapi, http = fetch, completeDraft }: Deps) => {
  const complete =
    completeDraft ??
    ((u: any, id: string, org: string) =>
      strapi.plugin("events").service("feeds").completeDraft(u, id, org))

  return {
    async exchangeEventbrite(
      user: any,
      input: { code: string; libraryDocumentId: string }
    ) {
      const {
        EVENTBRITE_CLIENT_ID: id,
        EVENTBRITE_CLIENT_SECRET: secret,
        EVENTBRITE_REDIRECT_URI: redirect,
      } = process.env
      if (!id || !secret || !redirect)
        return fail(
          503,
          "oauth_unavailable",
          "Eventbrite sign-in isn't set up."
        )
      if (
        !(await claimedLibraryIds(strapi, user.id)).has(input.libraryDocumentId)
      )
        return fail(404, "not_found", "Library not found.")
      if (!/^[A-Za-z0-9._-]{4,512}$/.test(input.code))
        return fail(400, "invalid_code", "Invalid authorisation code.")

      const tokenRes = await http(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: id,
          client_secret: secret,
          code: input.code,
          redirect_uri: redirect,
        }).toString(),
        signal: AbortSignal.timeout(15_000),
      })
      const token = (await tokenRes.json().catch(() => null)) as {
        access_token?: string
      } | null
      if (!tokenRes.ok || !token?.access_token)
        return fail(
          502,
          "oauth_failed",
          "Eventbrite didn't accept the sign-in. Try again."
        )

      const orgRes = await http(ORGS_URL, {
        headers: { Authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(15_000),
      })
      const orgJson = (await orgRes.json().catch(() => null)) as {
        organizations?: { id: string; name: string }[]
      } | null
      const organizations = (orgJson?.organizations ?? [])
        .map((o) => ({ id: String(o.id), name: String(o.name ?? o.id) }))
        .slice(0, 50)
      if (organizations.length === 0)
        return fail(
          422,
          "no_organizations",
          "That Eventbrite account has no organisations."
        )

      const values = { accessToken: token.access_token }
      const library = await strapi
        .documents("api::library.library")
        .findOne({ documentId: input.libraryDocumentId, fields: ["name"] })
      const draft = await strapi.db.transaction(async () => {
        const created = await strapi.documents(CREDENTIAL_UID).create({
          data: {
            provider: "eventbrite",
            label: `${String(library?.name ?? "Library").slice(0, 150)} · Eventbrite`,
            scope: "library",
            status: "draft",
            source: "library",
            connectedBy: `ba:${user.id}`,
            credentialsEncrypted: "{}",
            hints: { ...feedHints("eventbrite", values), organizations },
            libraries: [{ documentId: input.libraryDocumentId }],
          },
        })
        await strapi.documents(CREDENTIAL_UID).update({
          documentId: created.documentId,
          data: {
            credentialsEncrypted: sealValues(
              values,
              created.documentId,
              "current"
            ),
          },
        })

        return created
      })

      if (organizations.length === 1)
        return {
          credentialDocumentId: draft.documentId,
          organizations,
          completed: await complete(
            user,
            draft.documentId,
            organizations[0]!.id
          ),
        }

      return { credentialDocumentId: draft.documentId, organizations }
    },

    completeEventbrite: (
      user: any,
      documentId: string,
      organizationId: string
    ) => complete(user, documentId, organizationId),
  }
}
```

Add `completeDraft(user, documentId, organizationId)` to `feeds.ts`:

1. Load the row and require `status === "draft"`, `connectedBy === "ba:<user>"`, and that its library is still claimed (404 otherwise).
2. Check `organizationId` is among `hints.organizations[].id` (400 otherwise).
3. Open the current slot, add `organizationId`, and validate with `validateFeedValues("eventbrite", values)`.
4. Run the policy check, the open-submission limit and the test (with the blocking rules) exactly as `connect` does.
5. In one transaction: update the row to `status: "pending"`, re-seal the values, set `hints = feedHints("eventbrite", values)` (dropping `organizations`), set `lastTestedAt`/`lastTestResult`, create the `kind: "connect"` Submission, set `pendingSubmissionDocumentId` and record `connect_submitted`.

Factor the shared part of `connect` and `completeDraft` into a local `openConnectReview(user, documentId, libraryDocumentId, provider, values, result, testedAt)` so neither duplicates the transaction body.

Controller actions:

- `oauthEventbrite: (ctx) => run(ctx, (u) => oauth().exchangeEventbrite(u, { code: String(body(ctx).code ?? ""), libraryDocumentId: String(body(ctx).libraryDocumentId ?? "") }))`
- `organization: (ctx) => run(ctx, (u) => oauth().completeEventbrite(u, ctx.params.documentId, String(body(ctx).organizationId ?? "")), { docId: true })`

Here `oauth = () => strapi.plugin("events").service("feedOauth")`. Register `feedOauth` in `services/index.ts` and add the two routes.

- [ ] **Step 3: Run the tests and commit**

Run: `cd apps/strapi && pnpm vitest run tests/events`
Expected: PASS.

```bash
git add apps/strapi/src/plugins/events apps/strapi/tests/events/feed-oauth.test.ts apps/strapi/.env.example
git commit -m "feat(events): Eventbrite OAuth exchange and organisation completion"
```

### Task 19: Next OAuth routes and the organisation step

**Files:**

- Create: `apps/ui/src/lib/oauth-state.ts`
- Create: `apps/ui/src/app/api/contribute/event-feeds/eventbrite/start/route.ts`, `.../eventbrite/callback/route.ts`, `apps/ui/src/app/api/contribute/event-feeds/[documentId]/organization/route.ts`
- Create: `apps/ui/src/app/[locale]/contribute/events/[documentId]/organisation/page.tsx`, `apps/ui/src/components/event-feeds/OrganisationPicker.tsx`
- Modify: `apps/ui/.env.example` (`EVENTBRITE_CLIENT_ID`)
- Test: `apps/ui/src/lib/__tests__/oauth-state.test.ts`

**Interfaces:**

- Produces:
  - `signState(payload: { nonce: string; userId: string; libraryDocumentId: string; exp: number }): string`
  - `verifyState(token: string): typeof payload | null`, which checks the signature and the expiry

- [ ] **Step 1: Write the failing test**

```ts
// apps/ui/src/lib/__tests__/oauth-state.test.ts
import { beforeEach, describe, expect, it } from "vitest"

import { signState, verifyState } from "../oauth-state"

beforeEach(() => {
  process.env.BETTER_AUTH_SECRET = "test-secret-at-least-32-characters-long"
})

const payload = () => ({
  nonce: "n1",
  userId: "u1",
  libraryDocumentId: "lib1",
  exp: Date.now() + 60_000,
})

describe("oauth state", () => {
  it("round-trips a signed payload", () => {
    const p = payload()
    expect(verifyState(signState(p))).toEqual(p)
  })

  it("rejects tampering and expiry", () => {
    const t = signState(payload())
    const [body, sig] = t.split(".")
    const forged = Buffer.from(
      JSON.stringify({ ...payload(), userId: "u2" })
    ).toString("base64url")
    expect(verifyState(`${forged}.${sig}`)).toBeNull()
    expect(verifyState(`${body}.x${sig!.slice(1)}`)).toBeNull()
    expect(
      verifyState(signState({ ...payload(), exp: Date.now() - 1 }))
    ).toBeNull()
  })
})
```

Run: `cd apps/ui && pnpm vitest run src/lib/__tests__/oauth-state.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement `oauth-state.ts` and the routes**

```ts
// apps/ui/src/lib/oauth-state.ts
import "server-only"

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto"

type StatePayload = {
  nonce: string
  userId: string
  libraryDocumentId: string
  exp: number
}

function key(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required")

  return Buffer.from(
    hkdfSync("sha256", secret, "", "event-feed-oauth-state", 32)
  )
}

const sign = (body: string) =>
  createHmac("sha256", key()).update(body).digest("base64url")

/** A signed, expiring OAuth `state` for the Eventbrite connect flow. */
export function signState(payload: StatePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")

  return `${body}.${sign(body)}`
}

export function verifyState(token: string): StatePayload | null {
  const [body, sig] = token.split(".")
  if (!body || !sig) return null
  const expected = Buffer.from(sign(body))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given))
    return null
  try {
    const p = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as StatePayload
    if (typeof p.exp !== "number" || p.exp < Date.now()) return null

    return p
  } catch {
    return null
  }
}
```

The `vi.mock("server-only", () => ({}))` line is needed in the test file; add it at the top.

`start/route.ts` (GET):

1. Get the session user; `requireCapability(user, "events.feed")`; the `library` query parameter must pass `isDocumentIdParam` and be in `user.claimedLibraryIds` (403 otherwise).
2. Return 503 when `EVENTBRITE_CLIENT_ID` is unset.
3. Apply the `test` limiter key from Task 13 (export the limiters from `event-feed-proxy.ts` for this).
4. Make `nonce = randomBytes(16).toString("base64url")` and `state = signState({ nonce, userId: user.id, libraryDocumentId, exp: Date.now() + 10 * 60_000 })`.
5. Set the cookie `__Host-eb_oauth` to `nonce` (`httpOnly`, `secure`, `sameSite: "lax"`, `path: "/"`, `maxAge: 600`).
6. Redirect (302) to `https://www.eventbrite.com/oauth/authorize?response_type=code&client_id=${EVENTBRITE_CLIENT_ID}&redirect_uri=${encodeURIComponent(APP_PUBLIC_URL + "/api/contribute/event-feeds/eventbrite/callback")}&state=${state}`.

`callback/route.ts` (GET):

1. Read `code` and `state`; `verifyState(state)`; read the cookie; require `payload.nonce === cookie` and `payload.userId === session.user.id`. Delete the cookie in every response.
2. On any failure, redirect to `/contribute/events?oauth=failed`.
3. POST to Strapi `/api/events/feeds/oauth/eventbrite` with `{ code, libraryDocumentId: payload.libraryDocumentId }` and `bridgeUserHeaders`.
4. On `data.completed`, redirect to `/contribute/events?library=<id>&oauth=sent`. On a 422 from the completion (`test_failed`), redirect to `/contribute/events?library=<id>&oauth=test_failed`. With several organisations, redirect to `/contribute/events/${data.credentialDocumentId}/organisation`.

`[documentId]/organization/route.ts`: POST via `proxyEventFeed(req, { method: "POST", path: \`feeds/${documentId}/organization\`, kind: "write" })`, with `organizationId`added to the proxy's`BODY_KEYS` (already listed in Task 13).

`organisation/page.tsx`: RSC. Load the user's feeds and find the `draft` feed whose `hints.organizations` holds the choices. The list view must include drafts with `hints.organizations`, so let `list()` pass `hints` through unchanged for drafts. `notFound()` when it's missing. Render `OrganisationPicker`: radio cards of the organisation names, then **Send for review**, which POSTs `/api/contribute/event-feeds/${id}/organization` and then `router.push("/contribute/events?library=…&oauth=sent")`, showing `FEED_TEST_COPY` on a 422.

On the dashboard, read `?oauth=` and show a `Notice`:

- `sent`: ok, "Your Eventbrite feed was sent for review."
- `failed`: warn, "Eventbrite sign-in didn't finish. Try again."
- `test_failed`: warn, `FEED_TEST_COPY.auth_failed`.

- [ ] **Step 3: Run the tests and commit**

Run: `cd apps/ui && pnpm vitest run src/lib/__tests__/oauth-state.test.ts && pnpm typecheck && pnpm lint --quiet`
Expected: PASS.

```bash
git add apps/ui/src/lib/oauth-state.ts apps/ui/src/lib/__tests__/oauth-state.test.ts apps/ui/src/lib/event-feed-proxy.ts apps/ui/src/app/api/contribute/event-feeds apps/ui/src/app/[locale]/contribute/events apps/ui/src/components/event-feeds apps/ui/.env.example
git commit -m "feat(ui): Connect with Eventbrite"
```

---

## Phase H: End to end and docs

### Task 20: Playwright access spec

**Files:**

- Create: `qa/tests/playwright/e2e/access/event-feeds.spec.ts`
- Create: `qa/tests/playwright/fixtures/feeds/library-events.ics`
- Modify: `qa/tests/playwright/helpers/access-fixtures.ts` only if the `librarian` fixture lacks a claimed library documentId the spec can read; check `FIXTURES.librarian` first

**Interfaces:**

- Consumes: the seeded `librarian`, `moderator-global` and `reader` fixtures.

- [ ] **Step 1: Write the spec**

`safeFetch` blocks loopback addresses, so a local `.ics` can't be served to Strapi's test. Run the spec against a public fixture URL set in `qa/tests/playwright/.env` as `EVENT_FEED_TEST_ICS_URL`, and `test.skip` when it's unset. The steps:

1. As `reader`, `/contribute/events` shows "Claim your library first".
2. As `librarian`:
   1. open `/contribute/events`, then **Connect a feed**;
   2. choose "Calendar feed (.ics)" and fill the calendar address with `EVENT_FEED_TEST_ICS_URL`;
   3. **Test connection** shows "Connected: we could read your events.";
   4. **Send for review** lands on the dashboard with the status "Waiting for review".
3. As `moderator-global`, open `/contribute/moderation`, filter the type to Event feed, and open the submission:
   1. the panel shows "Test when sent: Passed";
   2. the page HTML doesn't contain the URL's path;
   3. **Approve and activate**.
4. As `librarian`, the feed shows "Active"; **Pause** shows "Paused"; **Disconnect** with confirm removes it.
5. As `librarian`, a direct `fetch("/api/contribute/event-feeds", { method: "POST", body: { libraryDocumentId: "<another library>" … } })` answers 403.

- [ ] **Step 2: Run it**

Run: `cd qa/tests/playwright && pnpm seed:access && npx playwright test --project=access e2e/access/event-feeds.spec.ts`
Expected: PASS, or skipped without `EVENT_FEED_TEST_ICS_URL`, with the local UI, Strapi (rebuilt) and `EVENTS_CREDENTIAL_KEY` set.

- [ ] **Step 3: Commit**

```bash
git add qa/tests/playwright/e2e/access/event-feeds.spec.ts qa/tests/playwright/.env.example
git commit -m "test(e2e): connect, review, pause and disconnect an event feed"
```

### Task 21: Docs

**Files:**

- Modify: `CLAUDE.md`
  - Core pillars: add "Event feeds" under Contribute.
  - Access model: `events.feed` and `event_feed`.
  - Future Goals §1 Events: a new "Event Feeds (built)" paragraph with the lifecycle, security rules and routes, plus the worker deploy gap.
  - Routing table: `/contribute/events`, `/contribute/events/connect`, `/contribute/events/[documentId]/replace`, `/contribute/events/[documentId]/organisation`.
  - Monorepo structure: `packages/event-providers`.
- Modify: `CONTEXT.md` (add **Event Feed** and **Event Credential**, spec §3; amend the Capability entry's "connect an event feed" wording)
- Modify: `docs/events-system-spec.md`:
  - "Strapi ↔ Worker communication channels": tests now run in Strapi; there's no test-ping; per-feed sync commands; auto-pause.
  - "The worker's tiny HTTP server": `/health` only.
- Modify: `docs/strapi-role-permissions.md` (Reveal event credentials)
- Modify: `apps/strapi/.env.example`, `apps/sync-worker/.env.example`, `apps/ui/.env.example`: keys added in earlier tasks, with one-line comments; remove `WORKER_SECRET`

- [ ] **Step 1: Write the doc changes**

The CLAUDE.md paragraph (under Future Goals §1, after the bullet list):

```markdown
**Event Feeds (built, 2026-10):** a claimant connects their library's events platform at `/contribute/events` (`components/event-feeds/`; proxy `lib/event-feed-proxy.ts`, routes `app/api/contribute/event-feeds/*`). Providers and their fields come from one registry, `EVENT_PROVIDERS` in `@repo/shared-data`; provider code lives in `@repo/event-providers`, shared by Strapi (in-process connection tests) and the sync worker. Values are sealed with `@repo/events-crypto` (AES-256-GCM, AAD = credential documentId, or `:pending` for a replacement under review) and are `private`. Only Strapi admin users with "Reveal event credentials" can read one, and each reveal is logged in `plugin::events.credential-event` (append-only, no routes). Every new value is an `event_feed` Submission (index queue) carrying only masked hints and the test result; approval activates it (`feeds.approveSubmission`), rejection destroys it. Pause, resume, disconnect and withdraw are direct. Feeds belong to the library: any current claimant manages them; group feeds are admin-only. The worker auto-pauses a feed after `EVENTS_AUTOPAUSE_AFTER` failed syncs and Strapi's 15-minute cron emails the claimants. Rotate the key with `pnpm --filter @repo/strapi events:rekey`. Spec: `docs/superpowers/specs/2026-10-05-event-feed-credentials-design.md`. Still open: the worker has no production host.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md CONTEXT.md docs/events-system-spec.md docs/strapi-role-permissions.md apps/strapi/.env.example apps/sync-worker/.env.example apps/ui/.env.example
git commit -m "docs: event feeds, the provider package and credential handling"
```

---

## Final verification

- [ ] Run: `pnpm --filter @repo/shared-data build && pnpm --filter @repo/access build && pnpm --filter @repo/event-providers build && pnpm --filter @repo/event-providers test && (cd packages/access && pnpm test) && pnpm --filter @repo/sync-worker test && (cd apps/strapi && pnpm test:unit) && (cd apps/ui && pnpm vitest run && pnpm typecheck && pnpm lint --quiet) && pnpm --filter @repo/strapi build:plugins && pnpm --filter @repo/strapi build`
      Expected: every step passes.
- [ ] Manually: start Strapi and the UI, then:
  - as a seeded librarian, connect an iCal feed;
  - as `moderator-global`, approve it;
  - in Strapi admin as super admin, grant "Reveal event credentials" to your role and reveal the value;
  - check that `ev_credential_events` holds `connect_submitted`, `approved` and `revealed`;
  - check that `GET /api/events/feeds` through the bridge never contains `credentialsEncrypted`.
- [ ] `grep -rn "credential-submit\|contribute/event-feed\b\|isActive" apps/ui/src apps/strapi/src apps/sync-worker/src` returns nothing relevant. `meetup` and `bibliocommons` appear only as an Event `sourceProvider`, if at all.
