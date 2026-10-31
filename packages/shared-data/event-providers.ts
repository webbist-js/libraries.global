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
        pattern: String.raw`^\d{5,20}$`,
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
  if (url.protocol !== "https:") return "The address must start with https://."
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
