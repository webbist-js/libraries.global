/** Fixed product funnel fields only. Never pass account, Team, Stripe or URL data. */
const EVENTS = [
  "pricing_action",
  "begin_checkout",
  "checkout_step",
  "checkout_handoff",
  "checkout_error",
] as const
const PRODUCTS = ["supporter", "pro", "team", "team_api", "personal"] as const
const ACTIONS = [
  "open_team",
  "close_team",
  "monthly",
  "yearly",
  "select_api",
  "remove_api",
  "continue",
  "standard",
  "public_service",
] as const
const STEPS = ["team_details", "api_review", "billing_review"] as const

export type CheckoutEventName = (typeof EVENTS)[number]
export type CheckoutAnalytics = {
  product: (typeof PRODUCTS)[number]
  billing_interval: "month" | "year"
  billing_mode?: "sandbox" | "live"
  api_addon?: "selected" | "not_selected"
  action_type?: (typeof ACTIONS)[number]
  checkout_step?: (typeof STEPS)[number]
}

function sanitizeCheckoutFields(
  data: Record<string, unknown>
): Record<string, string> | undefined {
  const clean: Record<string, string> = {}
  for (const [field, allowed] of [
    ["billing_mode", ["sandbox", "live"]],
    ["api_addon", ["selected", "not_selected"]],
    ["action_type", ACTIONS],
    ["checkout_step", STEPS],
  ] as const) {
    if (data[field] !== undefined) {
      if (!(allowed as readonly unknown[]).includes(data[field])) return
      clean[field] = String(data[field])
    }
  }

  return clean
}

export function sanitizeCheckoutEvent(
  name: string,
  input: unknown
): Record<string, string> | undefined {
  if (
    !EVENTS.includes(name as CheckoutEventName) ||
    !input ||
    typeof input !== "object"
  )
    return
  const data = input as Record<string, unknown>
  if (data.product === "personal" && name !== "pricing_action") return
  if (
    !PRODUCTS.includes(data.product as CheckoutAnalytics["product"]) ||
    !["month", "year"].includes(String(data.billing_interval))
  )
    return
  if (
    (data.product === "team" && data.billing_interval !== "year") ||
    (data.product === "team_api" && data.billing_interval !== "month")
  )
    return
  const clean: Record<string, string> = {
    product: String(data.product),
    billing_interval: String(data.billing_interval),
    interaction_source: name === "pricing_action" ? "pricing" : "checkout",
  }
  const extra = sanitizeCheckoutFields(data)
  if (!extra) return
  Object.assign(clean, extra)
  if (name === "pricing_action" && !clean.action_type) return
  if (name === "checkout_step" && !clean.checkout_step) return

  return clean
}

export function pushCheckoutEvent(
  name: CheckoutEventName,
  parameters: CheckoutAnalytics
): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      (window.librariesGlobalAnalytics?.trackCheckout?.(name, parameters) ??
        false)
    )
  } catch {
    return false
  }
}

/** Async completion never survives a route change or consent withdrawal/regrant. */
const droppedEvent = () => false

export function captureCheckoutEvent(
  name: CheckoutEventName,
  parameters: CheckoutAnalytics
): () => boolean {
  try {
    const complete =
      typeof window !== "undefined"
        ? window.librariesGlobalAnalytics?.prepareCheckout?.(name, parameters)
        : undefined

    return () => {
      try {
        return complete?.() ?? false
      } catch {
        return false
      }
    }
  } catch {
    return droppedEvent
  }
}

/** Only provider checkout actions produce handoff/error funnel events. */
export function captureCheckoutAttempt(
  action: unknown,
  parameters: CheckoutAnalytics
) {
  const selected =
    action &&
    typeof action === "object" &&
    "action" in action &&
    action.action === "checkout"

  return {
    handoff: selected
      ? captureCheckoutEvent("checkout_handoff", parameters)
      : droppedEvent,
    failed: selected
      ? captureCheckoutEvent("checkout_error", parameters)
      : droppedEvent,
  }
}
