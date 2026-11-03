import { authDbPool } from "@/lib/auth"
import { BillingError } from "@/lib/billing/config"
import {
  apiFailure,
  apiLibraries,
  apiPlaces,
  serveTeamApi,
} from "@/lib/team-api/gateway"
import { teamApiPlaceRoute } from "@/lib/team-api/paths"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ path?: string[] }> }

/**
 * GET /api/v1/places                          countries with libraries
 * GET /api/v1/places/{country}                its regions
 * GET /api/v1/places/{country}/{region}       its areas
 * GET /api/v1/places/{country}[/{region}[/{area}]]/libraries  the libraries there
 */
export async function GET(request: Request, { params }: Ctx) {
  const route = teamApiPlaceRoute((await params).path ?? [])
  if (!route) return apiFailure(new BillingError("record_not_found", 404))
  if (route.kind === "places")
    return serveTeamApi(
      authDbPool,
      request,
      "libraries:read",
      "places.list",
      (maximum) => apiPlaces(request, maximum, route)
    )

  return serveTeamApi(
    authDbPool,
    request,
    "libraries:read",
    "places.libraries",
    (maximum) => apiLibraries(request, maximum, undefined, route)
  )
}
