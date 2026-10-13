import "server-only"

import {
  ATLAS_LIMITS,
  parseAtlasQueryRequest,
  type AtlasQueryRequest,
} from "@repo/shared-data"

import { readJsonCapped } from "@/lib/bridge-params"

export async function readAtlasQuery(
  req: Request
): Promise<{ request: AtlasQueryRequest } | { response: Response }> {
  const raw = await readJsonCapped(req, ATLAS_LIMITS.queryBytes)
  if (!raw.ok)
    return {
      response: Response.json(
        {
          error:
            raw.status === 413
              ? "Atlas request is too large"
              : "Invalid Atlas JSON",
        },
        { status: raw.status }
      ),
    }
  try {
    return { request: parseAtlasQueryRequest(raw.body) }
  } catch {
    return {
      response: Response.json(
        { error: "Invalid Atlas query" },
        { status: 400 }
      ),
    }
  }
}
