/** Fixed product funnel fields only. Never pass account, Team, Stripe or URL data. */
const EVENTS = ["begin_checkout", "checkout_handoff", "checkout_error"] as const
/** API Access is the only purchase, billed monthly. */
const PRODUCTS = ["team_api"] as const

export type CheckoutEventName = (typeof EVENTS)[number]
export type CheckoutAnalytics = {
  product: (typeof PRODUCTS)[number]
  billing_interval: "month"
  billing_mode?: "sandbox" | "live"
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
  if (
    !PRODUCTS.includes(data.product as CheckoutAnalytics["product"]) ||
    data.billing_interval !== "month"
  )
    return
  const clean: Record<string, string> = {
    product: String(data.product),
    billing_interval: "month",
    interaction_source: "checkout",
  }
  if (data.billing_mode !== undefined) {
    if (data.billing_mode !== "sandbox" && data.billing_mode !== "live") return
    clean.billing_mode = data.billing_mode
  }

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
