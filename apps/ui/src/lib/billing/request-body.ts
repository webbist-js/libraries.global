import "server-only"

import { BillingError } from "./config"

/** Small purchase selections never need an unbounded request body. */
export async function readBillingJson(req: Request): Promise<unknown> {
  const maximum = 4096
  if (Number(req.headers.get("content-length")) > maximum)
    throw new BillingError("billing_request_too_large", 413)
  const reader = req.body?.getReader()
  if (!reader) throw new BillingError("invalid_billing_request", 400)
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maximum) {
        await reader.cancel()
        throw new BillingError("billing_request_too_large", 413)
      }
      chunks.push(value)
    }

    return JSON.parse(Buffer.concat(chunks).toString("utf8"))
  } catch (error) {
    if (error instanceof BillingError) throw error
    throw new BillingError("invalid_billing_request", 400)
  } finally {
    reader.releaseLock()
  }
}
