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
