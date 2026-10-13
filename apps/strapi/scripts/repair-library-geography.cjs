/** Repair missing geography from cached boundary evidence; preserve original source records. */
const assert = require("node:assert/strict")
const { existsSync, readFileSync, statSync, writeFileSync } = require("node:fs")
const { createRequire } = require("node:module")
const path = require("node:path")

const { libraryFacts } = require("./publish-ready-libraries.cjs")

const ROOT = path.resolve(__dirname, "..")
const REPORTS = path.resolve(ROOT, "../../.scratch/audit-history")
const COUNTRY_CODES = { Sweden: "SE", Norway: "NO", Denmark: "DK" }
const nameKey = (value) =>
  value
    .normalize("NFD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll(
      /\b(?:kommun|kommune|municipality|county|lan|fylke|region)\b/g,
      ""
    )
    .replaceAll(/[^a-z0-9]/g, "")
const codeKey = (code, country) =>
  country === "DK" ? String(code).replace(/^0+/, "") : String(code)

function matchArea(gap, boundaries, areas) {
  const country = COUNTRY_CODES[gap.country.name]
  assert.ok(country, "Unsupported country")
  assert.ok(
    boundaries.some(
      (b) =>
        b.tags.admin_level === "2" &&
        (b.tags["ISO3166-1:alpha2"] ||
          b.tags["ISO3166-1"] ||
          b.tags.country_code) === country
    ),
    `Point outside the expected country: ${gap.name}`
  )
  // Christiansø is a state-administered reporting area, outside Denmark's
  // municipalities. Use its existing official statistical hierarchy, with
  // the administration's library page establishing the institution's island.
  if (country === "DK" && gap.sources?.[0]?.record_id === "Q21106883") {
    assert.equal(gap.name, "Christiansø Bibliotek")
    assert.ok(gap.addresses?.includes("Christiansø"))
    const matches = areas.filter(
      (p) =>
        p.iso_2 === "DK" &&
        p.name === "Christiansø" &&
        p.estimates?.some(
          (e) =>
            e.reportingCode === "411" &&
            e.parentReportingCode === "084" &&
            e.coverage?.administrativeStatus?.includes(
              "outside the 98 municipalities"
            )
        )
    )
    assert.equal(
      matches.length,
      1,
      "Missing official Christiansø reporting area"
    )
    const area = matches[0]
    assert.equal(area.country_id, gap.country.document_id)
    assert.equal(area.region_name, "Hovedstaden")

    return {
      area,
      method: "official unincorporated reporting area",
      references: [
        {
          dataset: "dst-population",
          recordId: "411",
          label: "Christiansø statistical reporting area",
          url: "https://www.dst.dk/en/Statistik/dokumentation/nomenklaturer/nuts",
          fields: ["region", "area"],
        },
        {
          label: "Christiansø Administration: library location",
          url: "https://www.christiansoe.dk/livet-pa-oen/bibliotek/",
          fields: ["area"],
        },
      ],
    }
  }
  const municipal = boundaries.filter((b) =>
    ["7", "8"].includes(b.tags.admin_level)
  )
  const codes = new Set(
    municipal.flatMap((b) =>
      Object.entries(b.tags)
        .filter(
          ([key]) =>
            key === "ref" ||
            /^ref:(?:scb|SE:scb|kommunenr|kommunenummer|SSB|DK:kommune)$/.test(
              key
            )
        )
        .map(([, value]) => codeKey(value, country))
    )
  )
  let matches = areas.filter(
    (p) =>
      p.iso_2 === country &&
      (p.estimates || []).some((e) =>
        codes.has(codeKey(e.reportingCode, country))
      )
  )
  let method = "current municipality code"
  if (!matches.length) {
    const names = new Set(
      municipal.flatMap((b) =>
        Object.entries(b.tags)
          .filter(
            ([key]) =>
              key === "name" ||
              key === "official_name" ||
              /^name:(sv|nb|nn|da|en)$/.test(key)
          )
          .map(([, value]) => nameKey(value))
      )
    )
    matches = areas.filter(
      (p) =>
        p.iso_2 === country && p.estimates?.length && names.has(nameKey(p.name))
    )
    method = "exact municipality name"
  }
  assert.equal(
    matches.length,
    1,
    `Ambiguous or missing current municipality for ${gap.name}`
  )
  const area = matches[0]
  assert.equal(
    area.country_id,
    gap.country.document_id,
    "Municipality country mismatch"
  )
  const matchesCode = (boundary) =>
    Object.entries(boundary.tags).some(
      ([key, value]) =>
        (key === "ref" || key.startsWith("ref:")) &&
        (area.estimates || []).some(
          (e) => codeKey(e.reportingCode, country) === codeKey(value, country)
        )
    )
  const matchedBoundary =
    municipal.find(matchesCode) ||
    municipal.find((b) => nameKey(b.tags.name || "") === nameKey(area.name))
  assert.ok(
    matchedBoundary && matchedBoundary.id >= 3600000000,
    "Missing municipality relation"
  )
  const regionBoundaries = boundaries.filter((b) => b.tags.admin_level === "4")
  assert.ok(
    regionBoundaries.some((b) =>
      [
        b.tags.name,
        b.tags["name:en"],
        b.tags["name:sv"],
        b.tags["name:nb"],
        b.tags["name:da"],
      ]
        .filter(Boolean)
        .some((name) => nameKey(name) === nameKey(area.region_name))
    ),
    `Boundary region disagrees with current geography for ${gap.name}`
  )

  return { area, method, relationId: matchedBoundary.id - 3600000000 }
}
module.exports = { matchArea }

async function main() {
  const apply = process.argv.includes("--apply")
  const backup = process.argv.includes("--backup")
    ? process.argv[process.argv.indexOf("--backup") + 1]
    : null
  if (
    apply &&
    (!backup ||
      !existsSync(backup) ||
      statSync(backup).size < 1024 ||
      readFileSync(backup).subarray(0, 5).toString() !== "PGDMP")
  )
    throw new Error("Completed pg_dump backup required")
  process.loadEnvFile(path.join(ROOT, ".env"))
  if (
    !["localhost", "127.0.0.1", "0.0.0.0"].includes(process.env.DATABASE_HOST)
  )
    throw new Error("Local database required")
  const gaps = JSON.parse(
    readFileSync(path.join(REPORTS, "entityref-gap-evidence.json"), "utf8")
  )
  const geography = JSON.parse(
    readFileSync(path.join(REPORTS, "current-nordic-places.json"), "utf8")
  )
  const boundaries = JSON.parse(
    readFileSync(path.join(REPORTS, "osm-gap-boundaries.json"), "utf8")
  )
  const plan = gaps.map((gap) => ({
    gap,
    ...matchArea(
      gap,
      boundaries[gap.sources[0].record_id] || [],
      geography.areas
    ),
  }))
  writeFileSync(
    path.join(REPORTS, "geography-repair-plan.json"),
    JSON.stringify(plan, null, 2)
  )
  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      libraries: plan.length,
      methods: plan.reduce(
        (out, row) => ((out[row.method] = (out[row.method] || 0) + 1), out),
        {}
      ),
    })
  )
  if (!apply) return
  const req = createRequire(path.join(ROOT, "package.json"))
  const client = new (req("pg").Client)({
    host: "127.0.0.1",
    port: Number(process.env.DATABASE_PORT),
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  })
  const base = new URL(process.env.STRAPI_URL || "http://127.0.0.1:1337")
  if (!["localhost", "127.0.0.1"].includes(base.hostname))
    throw new Error("Local Strapi required")
  const request = async (route, options = {}) => {
    const response = await fetch(new URL(route, base), {
      ...options,
      headers: {
        Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
        "x-service-secret": process.env.STRAPI_BRIDGE_SECRET,
        "x-library-ingest": "true",
      },
      signal: AbortSignal.timeout(30000),
    })
    const result = await response.json()
    if (!response.ok)
      throw new Error(
        `Strapi HTTP ${response.status}: ${result.error?.message}`
      )

    return result.data
  }
  try {
    await client.connect()
    await client.query("SELECT pg_advisory_lock(7420113)")
    const dataset = require("../src/seeds/openstreetmap-dataset.json")
    const existing = await request(
      "/api/datasets?filters[key][$eq]=openstreetmap"
    )
    if (!existing.length)
      await request("/api/datasets", {
        method: "POST",
        body: JSON.stringify({ data: dataset }),
      })
    const results = []
    for (const row of plan) {
      const { gap, area, relationId } = row
      const q = new URLSearchParams({
        status: "draft",
        locale: gap.locale,
        "populate[sourceRecords]": "true",
      })
      const route = `/api/libraries/${gap.document_id}?${q}`
      const draft = await request(route)
      const initial = (await libraryFacts(client, [draft.id]))[0]
      assert.equal(initial.name, gap.name, "Library name changed since plan")
      assert.equal(initial.slug, gap.slug, "Library slug changed since plan")
      const point = geography.libraries.find(
        (p) => p.document_id === gap.document_id
      ).location
      const current = (
        await client.query("SELECT location FROM libraries WHERE id=$1", [
          draft.id,
        ])
      ).rows[0].location
      assert.deepEqual(
        current,
        point,
        "Coordinates changed since boundary lookup"
      )
      const prefix = [
        gap.continent.slug,
        gap.country.slug,
        area.region_slug,
        area.slug,
        gap.slug,
      ].join(":")
      if (initial.places.region)
        assert.equal(
          initial.places.region.documentId,
          area.region_id,
          "Existing region differs from repair"
        )
      if (initial.places.area)
        assert.equal(
          initial.places.area.documentId,
          area.document_id,
          "Existing area differs from repair"
        )
      const sources = draft.sourceRecords.map(({ id, ...record }) => record)
      const references = row.references || [
        {
          dataset: "openstreetmap",
          recordId: `relation/${relationId}`,
          label: "Administrative boundaries (OpenStreetMap)",
          url: `https://www.openstreetmap.org/relation/${relationId}`,
          fields: ["region", "area"],
        },
      ]
      for (const reference of references)
        if (
          !sources.some(
            (r) => r.dataset === reference.dataset && r.url === reference.url
          )
        )
          sources.push({
            ...reference,
            role: "reference",
            retrievedAt: new Date().toISOString().slice(0, 10),
          })
      if (!initial.entity_ref || sources.length !== draft.sourceRecords.length)
        await request(route, {
          method: "PUT",
          body: JSON.stringify({
            data: {
              region: { connect: [{ documentId: area.region_id }] },
              area: { connect: [{ documentId: area.document_id }] },
              sourceRecords: sources,
            },
          }),
        })
      const after = (await libraryFacts(client, [draft.id]))[0]
      assert.equal(
        after.entity_ref,
        prefix,
        "Generated entityRef differs from location"
      )
      assert.deepEqual(
        after.sources.slice(0, initial.sources.length),
        initial.sources,
        "Original source records changed"
      )
      for (const field of ["name", "slug", "created_at"])
        assert.deepEqual(after[field], initial[field], `${field} changed`)
      const afterPoint = (
        await client.query("SELECT location FROM libraries WHERE id=$1", [
          draft.id,
        ])
      ).rows[0].location
      assert.deepEqual(afterPoint, point, "Original map pin changed")
      results.push({
        documentId: gap.document_id,
        entityRef: after.entity_ref,
        area: area.name,
        region: area.region_name,
        evidence: references.map((r) => r.url),
        method: row.method,
      })
      writeFileSync(
        path.join(REPORTS, "geography-repair-progress.json"),
        JSON.stringify(results, null, 2)
      )
      if (results.length % 25 === 0)
        console.log(JSON.stringify({ repaired: results.length }))
    }
    writeFileSync(
      path.join(REPORTS, "geography-repair-result.json"),
      JSON.stringify({ repaired: results.length, results }, null, 2)
    )
    console.log(
      JSON.stringify({
        repaired: results.length,
        verified: [
          "original sources and map pins preserved",
          "current municipal and regional identities",
          "lifecycle-generated entityRefs",
        ],
      })
    )
  } finally {
    await client.end()
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
