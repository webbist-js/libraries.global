import { BillingError } from "@/lib/billing/config"
import {
  apiFailure,
  apiLibraries,
  apiPlaces,
  withApiRequest,
} from "@/lib/team-api/gateway"
import { teamApiPlaceRoute } from "@/lib/team-api/paths"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ path?: string[] }> }

const places = withApiRequest<{ country?: string; region?: string }>(
  { scope: "libraries:read", endpoint: "places.list" },
  ({ request, maximum }, place) => apiPlaces(request, maximum, place)
)
const libraries = withApiRequest<{
  country: string
  region?: string
  area?: string
}>(
  { scope: "libraries:read", endpoint: "places.libraries" },
  ({ request, maximum }, place) =>
    apiLibraries(request, maximum, undefined, place)
)

/**
 * GET /api/v1/places                          countries with libraries
 * GET /api/v1/places/{country}                its regions
 * GET /api/v1/places/{country}/{region}       its areas
 * GET /api/v1/places/{country}[/{region}[/{area}]]/libraries  the libraries there
 */
export async function GET(request: Request, { params }: Ctx) {
  const route = teamApiPlaceRoute((await params).path ?? [])
  if (!route) return apiFailure(new BillingError("record_not_found", 404))

  return route.kind === "places"
    ? places(request, route)
    : libraries(request, route)
}
