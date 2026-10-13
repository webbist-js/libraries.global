"use strict"

const {
  populationPlan,
  storePopulationPlan,
  ensurePopulationColumns,
  retirePopulationIndexRegistration,
} = require("./shared/population-storage")

async function up(knex) {
  if (!["pg", "postgres", "postgresql"].includes(knex.client.config.client))
    return
  await retirePopulationIndexRegistration(knex)
  if (!(await knex.schema.hasTable("population_observations"))) return
  await ensurePopulationColumns(knex)
  const rows = await knex("population_observations").select("*")
  if (!rows.length) return
  const observations = rows.map((r) => ({
    key: r.key,
    level: r.level,
    reportingCode: r.reporting_code,
    iso2: r.iso_2,
    name: r.name,
    population: r.population,
    year: r.year,
    source: r.source,
    sourceUrl: r.source_url,
    licence: r.licence,
    retrievedAt: r.retrieved_at,
    method: r.method,
    boundaryVersion: r.boundary_version,
    parentReportingCode: r.parent_reporting_code,
  }))
  const plan = await populationPlan(knex, observations)
  await storePopulationPlan(knex, plan)
  // Every row is mapped before retiring the table. A failed mapping rolls back the migration.
  await knex.schema.dropTable("population_observations")
}

async function down() {} // Population remains on its geographic owners.

module.exports = { up, down }
