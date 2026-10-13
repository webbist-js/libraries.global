import { authDbPool } from "@/lib/auth"
import { BillingError, billingConfig } from "@/lib/billing/config"
import { receiveBillingEvent } from "@/lib/billing/events"
import { billingFailure, billingJson } from "@/lib/billing/http"
import { billingStripe } from "@/lib/billing/provider"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const secret = billingConfig().webhookSecret
  if (!secret) return billingJson({ error: "webhook_unconfigured" }, 503)
  const signature = req.headers.get("stripe-signature")
  if (!signature || signature.length > 4096)
    return billingJson({ error: "invalid_signature" }, 400)
  // Never parse JSON before signature verification, and bound the actual body.
  const reader = req.body?.getReader()
  if (!reader) return billingJson({ error: "invalid_body" }, 400)
  const chunks: Uint8Array[] = []
  let bytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > 512_000) {
      await reader.cancel()

      return billingJson({ error: "payload_too_large" }, 413)
    }
    chunks.push(value)
  }
  const raw = Buffer.concat(chunks)
  let event
  try {
    event = billingStripe().webhooks.constructEvent(raw, signature, secret)
  } catch {
    return billingJson({ error: "invalid_signature" }, 400)
  }
  try {
    await receiveBillingEvent(authDbPool, event)

    return billingJson({ received: true })
  } catch (error) {
    return billingFailure(error instanceof BillingError ? error : undefined)
  }
}
