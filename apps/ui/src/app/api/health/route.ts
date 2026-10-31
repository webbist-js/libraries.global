import { cmsMaintenance } from "@/lib/cms-maintenance"

export const dynamic = "force-dynamic"

// Health check endpoint. Returns a 200 status code if the server is running.
async function handler() {
  if (
    process.env.CMS_MAINTENANCE_REQUIRED === "true" &&
    !(await cmsMaintenance("maintenanceStatus")).ok
  )
    return Response.json(
      { data: "maintenance_unhealthy" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )

  return Response.json(
    { data: "OK" },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  )
}

export { handler as GET }
