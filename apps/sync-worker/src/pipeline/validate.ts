// apps/sync-worker/src/pipeline/validate.ts
import { getProvider } from "../providers"
import type { LoadedCredential } from "../providers/types"

export interface ValidationResult {
  valid: LoadedCredential[]
  failed: { credential: LoadedCredential; error: string }[]
}

export async function validateCredentials(
  credentials: LoadedCredential[]
): Promise<ValidationResult> {
  const valid: LoadedCredential[] = []
  const failed: { credential: LoadedCredential; error: string }[] = []

  await Promise.all(
    credentials.map(async (cred) => {
      const provider = getProvider(cred.provider)
      if (!provider) {
        failed.push({
          credential: cred,
          error: `No provider registered for "${cred.provider}"`,
        })

        return
      }
      try {
        const result = await provider.test(cred.credentials)
        if (result.ok) {
          valid.push(cred)
        } else {
          failed.push({
            credential: cred,
            error: result.error ?? "test() returned ok=false",
          })
        }
      } catch (err: any) {
        failed.push({
          credential: cred,
          error: (err.message as string) ?? "Unknown error",
        })
      }
    })
  )

  return { valid, failed }
}
