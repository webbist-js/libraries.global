import "dotenv/config"
import path from "node:path"

import { atlasPopulationBaseline } from "@repo/shared-data"
import knex from "knex"

import { buildAtlasArchive } from "./archive"

const required = (key: string): string => {
  const value = process.env[key]
  if (!value) throw new Error(`${key} is required`)

  return value
}
async function main() {
  if (
    process.env.ATLAS_BUILD_ENABLED !== "true" ||
    process.platform !== "linux"
  )
    throw new Error(
      "Atlas builds must be enabled explicitly on the Linux job runner"
    )
  const db = knex({
    client: "pg",
    connection: required("ATLAS_DATABASE_URL"),
    pool: { min: 0, max: 2 },
  })
  const controller = new AbortController()
  const stop = () => controller.abort()
  process.once("SIGINT", stop)
  process.once("SIGTERM", stop)
  try {
    const manifest = await buildAtlasArchive(
      db,
      {
        detailZoom: Number(required("ATLAS_DETAIL_ZOOM")),
        directory: process.env.ATLAS_SCRATCH_DIR,
        publicBaseUrl: required("ATLAS_PUBLIC_BASE_URL"),
        bucket: required("ATLAS_R2_BUCKET"),
        endpoint: required("ATLAS_R2_ENDPOINT"),
        origin: required("ATLAS_UI_ORIGIN"),
        validator: path.resolve(required("ATLAS_VALIDATOR_PATH")),
        countries: {
          source: path.resolve(
            __dirname,
            "../../../ui/public",
            `.${atlasPopulationBaseline.geometryUrl}`
          ),
          validator: path.resolve(
            __dirname,
            "../../../../qa/benchmarks/atlas/validate_countries.py"
          ),
        },
      },
      AbortSignal.any([
        controller.signal,
        AbortSignal.timeout(6 * 60 * 60 * 1000),
      ])
    )
    console.log(
      manifest
        ? `[atlas-build] published ${manifest.buildId}; ${manifest.count} records; ${manifest.archiveBytes} bytes`
        : "[atlas-build] coalesced: active lease or recent archive"
    )
  } finally {
    process.removeListener("SIGINT", stop)
    process.removeListener("SIGTERM", stop)
    await db.destroy()
  }
}
// eslint-disable-next-line unicorn/prefer-top-level-await -- CommonJS worker.
main().catch((error) => {
  console.error(
    "[atlas-build] failed",
    error instanceof Error ? error.message : "operation failed"
  )
  process.exitCode = 1
})
