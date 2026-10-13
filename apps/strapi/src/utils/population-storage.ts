import path from "node:path"

// Migrations and runtime imports use the same validation, place matching and writes.
// Strapi keeps user migrations in the application root, including production builds.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const storage = require(
  path.resolve(process.cwd(), "database/migrations/shared/population-storage")
)

export const populationPlan = storage.populationPlan
export const storePopulationPlan = storage.storePopulationPlan
export const readPopulationEstimates = storage.readPopulationEstimates
