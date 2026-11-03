import { authUpstreamHeaders, authUpstreamUrl } from "@/lib/auth-transport"

export async function GET() {
  try {
    const response = await fetch(
      authUpstreamUrl("/api/auth-internal/providers"),
      {
        headers: authUpstreamHeaders(new Headers()),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }
    )
    if (!response.ok) throw new Error("Providers unavailable")

    return Response.json(await response.json(), {
      headers: { "Cache-Control": "no-store" },
    })
  } catch {
    return Response.json({ providers: [] }, { status: 503 })
  }
}
