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
