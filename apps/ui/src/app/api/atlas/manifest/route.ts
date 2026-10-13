import { createAtlasBackend } from "@/lib/atlas-backend"

export async function GET(req: Request) {
  if (process.env.ATLAS_QUERY_ENABLED !== "true")
    return Response.json(
      { error: "Atlas queries are unavailable" },
      { status: 503 }
    )
  try {
    const state = await createAtlasBackend(req.signal).state()

    return Response.json(
      { manifest: state.manifest, dictionary: state.dictionary },
      { headers: { "cache-control": "no-store" } }
    )
  } catch {
    return Response.json(
      { error: "Atlas manifest is temporarily unavailable" },
      { status: 503 }
    )
  }
}
