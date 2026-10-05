// apps/sync-worker/src/pipeline/validate.ts
import {
  classifyFailure,
  getProvider,
  redactUrlsInText,
} from "@repo/event-providers"
import type { FeedTestCode } from "@repo/shared-data"

import type { LoadedCredential } from "../types"

export interface ValidationResult {
  valid: LoadedCredential[]
  failed: {
    credential: LoadedCredential
    code: FeedTestCode
    error: string
  }[]
}

export async function validateCredentials(
  credentials: LoadedCredential[]
): Promise<ValidationResult> {
  const valid: LoadedCredential[] = []
  const failed: ValidationResult["failed"] = []

  await Promise.all(
    credentials.map(async (cred) => {
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
          error: redactUrlsInText(
            err instanceof Error ? err.message : String(err)
          ),
        })
      }
    })
  )

  return { valid, failed }
}
