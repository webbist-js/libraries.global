import "dotenv/config"

async function main() {
  const required = (key: string) => {
    const value = process.env[key]
    if (!value) throw new Error(`${key} is required for population import`)

    return value
  }
  const response = await fetch(
    new URL(
      process.argv.includes("--local")
        ? "/api/atlas/population/local/import"
        : "/api/atlas/population/import",
      required("STRAPI_URL")
    ),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-secret": required("STRAPI_BRIDGE_SECRET"),
        "x-atlas-token": required("ATLAS_SERVICE_TOKEN"),
      },
      body: JSON.stringify({ dryRun: process.argv.includes("--dry-run") }),
      signal: AbortSignal.timeout(120000),
      redirect: "error",
    }
  )
  if (!response.ok) throw new Error(`Population import HTTP ${response.status}`)
  console.log(JSON.stringify(await response.json(), null, 2))
}

// eslint-disable-next-line unicorn/prefer-top-level-await -- CommonJS worker.
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Population import failed"
  )
  process.exitCode = 1
})
