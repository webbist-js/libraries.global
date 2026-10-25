import { readTextCapped } from "@/lib/bridge-params"

export const runtime = "nodejs"
export async function GET(req: Request) {
  try {
    const host = process.env.STRAPI_URL,
      secret = process.env.STRAPI_BRIDGE_SECRET,
      token = process.env.ATLAS_SERVICE_TOKEN
    if (
      !host ||
      !secret ||
      !token ||
      process.env.ATLAS_QUERY_ENABLED !== "true"
    )
      throw new Error("Unavailable")
    const url = new URL("/api/atlas/networks", host)
    for (const [key, value] of new URL(req.url).searchParams) {
      if (
        !["q", "country", "region", "after", "selected"].includes(key) ||
        value.length > (key === "after" ? 600 : key === "q" ? 80 : 100)
      )
        return Response.json(
          { error: "Invalid service search" },
          { status: 400 }
        )
      url.searchParams.set(key, value)
    }
    const response = await fetch(url, {
      headers: { "x-service-secret": secret, "x-atlas-token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    })
    if (!response.ok) throw new Error("Unavailable")
    const text = await readTextCapped(response, 512 * 1024)
    if (!text) throw new Error("Invalid catalogue")
    const value = JSON.parse(text)
    if (
      !Array.isArray(value.networks) ||
      value.networks.length > 25 ||
      !Array.isArray(value.countries) ||
      value.countries.length > 512 ||
      !Array.isArray(value.regions) ||
      value.regions.length > 1000
    )
      throw new Error("Invalid catalogue")

    return Response.json(value)
  } catch {
    return Response.json(
      { error: "Network catalogue unavailable" },
      { status: 503 }
    )
  }
}
