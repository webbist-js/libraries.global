import "server-only"
import { authUpstreamHeaders, authUpstreamUrl } from "./auth-transport"

/** Fresh identity lookup for jobs and billing; no application query reads credential tables. */
export async function verifiedIdentity(
  userId: string
): Promise<{ id: string; email: string } | null> {
  const response = await fetch(
    authUpstreamUrl("/api/auth-internal/verified-identities"),
    {
      method: "POST",
      headers: authUpstreamHeaders(new Headers(), true),
      body: JSON.stringify({ ids: [userId] }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    }
  )
  if (!response.ok) throw new Error("Identity lookup unavailable")
  const body = (await response.json()) as {
    data: { id: string; email: string }[]
  }

  return body.data.find((row) => row.id === userId) ?? null
}
