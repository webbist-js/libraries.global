/** Public, consented product metrics. Never pass URLs, form fields or users. */
const SOURCES = [
  "home",
  "find",
  "find_grid",
  "find_list",
  "find_map",
  "library_hero",
  "library_sidebar",
  "library_correction",
  "atlas_map",
  "atlas_panel",
  "atlas_search",
  "atlas_list",
  "atlas_recent",
  "atlas_filters",
  "atlas_layers",
  "atlas_toolbar",
  "atlas_export",
  "article",
  "article_share",
  "event_detail",
  "event_modal",
  "event_calendar",
  "event_save",
  "beta",
  "newsletter",
  "contact",
  "drive",
  "drive_share",
  "upgrade_prompt",
  "home_plans",
  "mobile_timetable",
  "navigation",
] as const
const ACTIONS = [
  "directions",
  "website",
  "catalogue",
  "join",
  "booking",
  "plan_visit",
  "follow",
  "unfollow",
  "request",
  "success",
  "denied",
  "unavailable",
  "clear",
  "layer_on",
  "layer_off",
  "filter",
  "projection",
  "view",
  "share",
  "save",
  "unsave",
  "registration_handoff",
  "subscribe_handoff",
  "ics_handoff",
  "submit",
  "compare",
  "upgrade",
  "open",
  "select_stop",
  "locale",
] as const
const CONTENT = ["library", "journal", "knowledge", "event", "drive"] as const
const SEARCH = ["libraries", "atlas", "journal", "knowledge", "events"] as const
const RESULTS = ["zero", "one", "two_to_ten", "more_than_ten"] as const
const SUBMISSIONS = [
  "beta_request",
  "newsletter",
  "contact",
  "feedback",
  "correction",
  "verification",
  "photo",
  "source",
] as const

export type InteractionSource = (typeof SOURCES)[number]
export type AnalyticsParameters = {
  interaction_source: InteractionSource
  action_type?: (typeof ACTIONS)[number]
  content_type?: (typeof CONTENT)[number]
  search_type?: (typeof SEARCH)[number]
  result_bucket?: (typeof RESULTS)[number]
  submission_type?: (typeof SUBMISSIONS)[number]
  library_document_id?: string
  content_id?: string
  destination?:
    | "atlas"
    | "libraries"
    | "journal"
    | "knowledge"
    | "events"
    | "community"
    | "membership"
  target_locale?: "en" | "cs" | "fr"
  method?: "copy" | "x"
  format?: "csv" | "geojson"
  selection_mode?: "selected" | "all"
  layer_name?:
    | "pins"
    | "density"
    | "openLate"
    | "closures"
    | "access"
    | "events"
    | "complete"
    | "perCapita"
    | "founded"
    | "mobile"
    | "population"
    | "deprivation"
    | "carAccess"
    | "transit"
    | "schools"
    | "reach"
    | "coverageGaps"
    | "serviceCoverage"
  view_mode?: "grid" | "list" | "map" | "globe" | "flat"
}

const EVENT_FIELDS = {
  library_action: ["action_type", "library_document_id"],
  library_follow: ["action_type", "library_document_id"],
  search: ["search_type"],
  search_results: ["search_type", "result_bucket"],
  search_error: ["search_type"],
  select_content: [
    "content_type",
    "content_id",
    "library_document_id",
    "view_mode",
  ],
  near_me: ["action_type"],
  generate_lead: ["submission_type"],
  submission_success: ["submission_type"],
  correction_open: ["library_document_id", "action_type"],
  atlas_action: ["action_type", "layer_name", "view_mode"],
  atlas_export: ["format", "selection_mode", "result_bucket"],
  export_blocked: ["format", "selection_mode"],
  content_engaged: ["content_type", "content_id"],
  share: ["content_type", "content_id", "method"],
  event_action: ["action_type", "content_id"],
  drive_action: ["action_type", "content_id"],
  membership_interest: ["action_type"],
  upgrade_prompt: ["action_type"],
  mobile_service_action: ["action_type", "library_document_id", "content_id"],
  navigation_action: [
    "content_type",
    "action_type",
    "destination",
    "target_locale",
  ],
} as const

export type AnalyticsEventName = keyof typeof EVENT_FIELDS

const ENUMS: Record<string, readonly string[]> = {
  interaction_source: SOURCES,
  action_type: ACTIONS,
  content_type: CONTENT,
  search_type: SEARCH,
  result_bucket: RESULTS,
  submission_type: SUBMISSIONS,
  method: ["copy", "x"],
  format: ["csv", "geojson"],
  selection_mode: ["selected", "all"],
  layer_name: [
    "pins",
    "density",
    "openLate",
    "closures",
    "access",
    "events",
    "complete",
    "perCapita",
    "founded",
    "mobile",
    "population",
    "deprivation",
    "carAccess",
    "transit",
    "schools",
    "reach",
    "coverageGaps",
    "serviceCoverage",
  ],
  view_mode: ["grid", "list", "map", "globe", "flat"],
  destination: [
    "atlas",
    "libraries",
    "journal",
    "knowledge",
    "events",
    "community",
    "membership",
  ],
  target_locale: ["en", "cs", "fr"],
}
const PUBLIC_ID = /^[A-Za-z0-9_-]{1,128}$/
const EVENT_ACTIONS: Record<string, readonly string[]> = {
  library_action: [
    "directions",
    "website",
    "catalogue",
    "join",
    "booking",
    "plan_visit",
  ],
  library_follow: ["follow", "unfollow"],
  near_me: ["request", "success", "denied", "unavailable", "clear"],
  correction_open: ["open"],
  atlas_action: [
    "layer_on",
    "layer_off",
    "filter",
    "projection",
    "view",
    "share",
  ],
  event_action: [
    "save",
    "unsave",
    "registration_handoff",
    "subscribe_handoff",
    "ics_handoff",
  ],
  drive_action: ["submit"],
  membership_interest: ["compare", "upgrade"],
  upgrade_prompt: ["open"],
  mobile_service_action: ["open", "select_stop", "ics_handoff"],
  navigation_action: ["open", "locale"],
}
const REQUIRED_FIELDS: Record<string, readonly string[]> = {
  library_action: ["library_document_id", "action_type"],
  library_follow: ["library_document_id", "action_type"],
  search: ["search_type"],
  search_results: ["search_type", "result_bucket"],
  search_error: ["search_type"],
  select_content: ["content_type"],
  content_engaged: ["content_type", "content_id"],
  generate_lead: ["submission_type"],
  submission_success: ["submission_type"],
  share: ["content_type", "method"],
  atlas_export: ["format", "selection_mode"],
  export_blocked: ["format", "selection_mode"],
}
function validParameter(field: string, value: unknown): value is string {
  if (typeof value !== "string") return false

  return field === "library_document_id" || field === "content_id"
    ? PUBLIC_ID.test(value)
    : Boolean(ENUMS[field]?.includes(value))
}

/** Runtime allowlist also protects the browser hook and explicit DOM metadata. */
export function sanitizeAnalyticsEvent(
  name: string,
  input: unknown,
  partial = false
): Record<string, string> | undefined {
  if (!Object.hasOwn(EVENT_FIELDS, name) || !input || typeof input !== "object")
    return
  const data = input as Record<string, unknown>
  if (!SOURCES.includes(data.interaction_source as InteractionSource)) return
  const fields: readonly string[] = EVENT_FIELDS[name as AnalyticsEventName]
  const clean: Record<string, string> = {
    interaction_source: String(data.interaction_source),
  }
  for (const field of fields) {
    const value = data[field]
    if (value === undefined) continue
    if (!validParameter(field, value)) return
    clean[field] = value
  }
  if (
    clean.action_type &&
    EVENT_ACTIONS[name] &&
    !EVENT_ACTIONS[name]!.includes(clean.action_type)
  )
    return
  if (
    name === "generate_lead" &&
    clean.submission_type &&
    !["beta_request", "newsletter"].includes(clean.submission_type)
  )
    return
  if (
    !partial &&
    (
      REQUIRED_FIELDS[name] ?? (EVENT_ACTIONS[name] ? ["action_type"] : [])
    ).some((field) => !clean[field])
  )
    return

  return clean
}

const DESTINATIONS: Record<string, AnalyticsParameters["destination"]> = {
  "/map": "atlas",
  "/libraries": "libraries",
  "/journal": "journal",
  "/knowledge": "knowledge",
  "/events": "events",
  "/community": "community",
  "/contribute/membership": "membership",
  "/profile/membership": "membership",
  "/plans": "membership",
}

export function navigationAttributes(href: string) {
  const destination = DESTINATIONS[href]

  return destination
    ? analyticsAttributes("navigation_action", {
        interaction_source: "navigation",
        action_type: "open",
        destination,
      })
    : {}
}

export function resultBucket(
  count: number
): AnalyticsParameters["result_bucket"] {
  return count <= 0
    ? "zero"
    : count === 1
      ? "one"
      : count <= 10
        ? "two_to_ten"
        : "more_than_ten"
}

export function pushAnalyticsEvent(
  name: AnalyticsEventName,
  parameters: AnalyticsParameters
): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      (window.librariesGlobalAnalytics?.track(name, parameters) ?? false)
    )
  } catch {
    // Measurement must not interrupt navigation or an accepted submission.
    return false
  }
}

/** Capture before an async operation; never replay across consent or navigation. */
const droppedEvent = () => false

export function captureAnalyticsEvent(
  name: AnalyticsEventName,
  parameters: AnalyticsParameters
): (additional?: Partial<AnalyticsParameters>) => boolean {
  try {
    const complete =
      typeof window !== "undefined"
        ? window.librariesGlobalAnalytics?.prepare(name, parameters)
        : undefined
    if (!complete) return droppedEvent

    return (additional) => {
      try {
        return complete(additional)
      } catch {
        return false
      }
    }
  } catch {
    return droppedEvent
  }
}

/** Explicit semantic metadata lets server-rendered links remain server components. */
export function analyticsAttributes(
  name: AnalyticsEventName,
  parameters: AnalyticsParameters
) {
  const clean = sanitizeAnalyticsEvent(name, parameters)

  return clean
    ? {
        "data-analytics-event": name,
        "data-analytics-params": JSON.stringify(clean),
      }
    : {}
}

export function installAnalyticsClickTracking(browser: Window): () => void {
  const click = (event: MouseEvent) => {
    if (event.defaultPrevented || (event.button !== 0 && event.button !== 1))
      return
    const target = event.target
    if (!(target instanceof Element)) return
    const element = target.closest<HTMLElement>("[data-analytics-event]")
    if (element && !["A", "BUTTON"].includes(element.tagName)) return
    if (!element || (event.type === "auxclick" && element.tagName !== "A"))
      return
    try {
      browser.librariesGlobalAnalytics?.track(
        element.dataset.analyticsEvent ?? "",
        JSON.parse(element.dataset.analyticsParams ?? "{}")
      )
    } catch {
      // Invalid metadata or a blocked provider cannot break the interaction.
    }
  }
  browser.document.addEventListener("click", click, true)
  browser.document.addEventListener("auxclick", click, true)
  const submit = (event: Event) => {
    const form = event.target
    if (
      event.defaultPrevented ||
      !(form instanceof HTMLFormElement) ||
      form.dataset.analyticsEvent !== "search"
    )
      return
    // Only explicitly marked search forms; no query or other field is sent.
    if (!String(new FormData(form).get("q") ?? "").trim()) return
    try {
      browser.librariesGlobalAnalytics?.track(
        "search",
        JSON.parse(form.dataset.analyticsParams ?? "{}")
      )
    } catch {
      /* Ignore invalid metadata. */
    }
  }
  browser.document.addEventListener("submit", submit, true)

  return () => {
    browser.document.removeEventListener("click", click, true)
    browser.document.removeEventListener("auxclick", click, true)
    browser.document.removeEventListener("submit", submit, true)
  }
}

const consentListeners = new Set<() => void>()

export function subscribeAnalyticsConsent(listener: () => void) {
  consentListeners.add(listener)

  return () => {
    consentListeners.delete(listener)
  }
}
export function analyticsConsentGranted(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.librariesGlobalAnalytics?.hasConsent?.() ?? false)
  )
}
export function analyticsConsentVersion(): number {
  return typeof window !== "undefined"
    ? (window.librariesGlobalAnalytics?.consentVersion?.() ?? 0)
    : 0
}
export function notifyAnalyticsConsent() {
  consentListeners.forEach((listener) => listener())
}
