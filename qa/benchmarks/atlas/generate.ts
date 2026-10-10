import { createHash } from "node:crypto"
import { once } from "node:events"
import { createWriteStream } from "node:fs"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { performance } from "node:perf_hooks"

import {
  atlasPoint,
  projectAtlasLibrary,
  type AtlasDictionary,
  type AtlasLibrarySource,
  type AtlasProjection,
} from "@repo/shared-data"

import {
  artifactDirectory,
  report,
  requireDisk,
  requireDisposable,
} from "./runtime.js"

const { resolve } = path

requireDisposable()
if (process.env.ATLAS_BENCH_ALLOW_SYNTHETIC !== "small-fixture-only")
  throw new Error(
    "Synthetic generation is opt-in; use existing data for growth estimates"
  )
const count = Number(process.env.ATLAS_BENCH_RECORDS ?? 1000)
if (!Number.isSafeInteger(count) || count < 100 || count > 5000)
  throw new Error("ATLAS_BENCH_RECORDS must be 100..5000")
const seed = 20261008
let state = seed
const random = () => {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0

  return state / 2 ** 32
}
const now = new Date("2026-10-08T10:15:00Z")
const hubs = [
  [51.5, -0.12, "Europe/London", "London", "england"],
  [40.7, -74, "America/New_York", "New York", "usa"],
  [35.7, 139.7, "Asia/Tokyo", "東京", "japan"],
  [28.6, 77.2, "Asia/Calcutta", "Delhi", "india"],
  [-23.55, -46.63, "America/Sao_Paulo", "São Paulo", "brazil"],
  [-33.87, 151.2, "Australia/Sydney", "Sydney", "australia"],
  [6.5, 3.4, "Africa/Lagos", "Lagos", "nigeria"],
  [48.86, 2.35, "Europe/Paris", "Paris", "france"],
] as const
const names = [
  "A",
  "Ab",
  "École",
  "Ecole",
  "東京",
  "Αθήνα",
  "中央図書館",
  "Biblioteca",
  "Library",
]
const access = Array.from({ length: 12 }, (_, n) => ({
  documentId: `access-${n}`,
  name: `Access ${n}`,
}))
const services = Array.from({ length: 48 }, (_, n) => ({
  documentId: `service-${n}`,
  name: `Facility ${n}`,
}))
const amenities = Array.from({ length: 40 }, (_, n) => ({
  documentId: `amenity-${n}`,
  name: `Facility ${n + 48}`,
}))
const dictionary: AtlasDictionary = {
  version: "benchmark-v1",
  entries: [
    ...access.map((o) => ({
      code: `access:${o.documentId}`,
      kind: "access" as const,
      name: o.name,
      aliases: [],
    })),
    ...services.map((o) => ({
      code: `service:${o.documentId}`,
      kind: "service" as const,
      name: o.name,
      aliases: [],
    })),
    ...amenities.map((o) => ({
      code: `amenity:${o.documentId}`,
      kind: "amenity" as const,
      name: o.name,
      aliases: [],
    })),
  ],
}
await mkdir(artifactDirectory, { recursive: true })
await requireDisk()
const streams = [
  "projection.ndjson",
  "libraries.ndjson",
  "general.ndjson",
  "mobile-stops.ndjson",
].map((name) =>
  createWriteStream(resolve(artifactDirectory, name), { flags: "wx" })
)
const hashes = streams.map(() => createHash("sha256"))
const write = async (index: number, value: unknown) => {
  const line = `${JSON.stringify(value)}\n`
  hashes[index]!.update(line)
  if (!streams[index]!.write(line)) await once(streams[index]!, "drain")
}
const started = performance.now()
let mapped = 0,
  listed = 0,
  translated = 0,
  timetableServices = 0,
  peakRss = 0
const oracleSamples: AtlasProjection[] = []
for (let id = 1; id <= count; id++) {
  const hub = hubs[Math.floor(random() * hubs.length)]!
  const rounded = id % 17 === 0,
    coincident = id % 100 === 0
  const spread = id % 5 === 0 ? 18 : 0.6
  let lat = Math.max(-89, Math.min(89, hub[0] + (random() - 0.5) * spread))
  let lng = Math.max(-180, Math.min(180, hub[1] + (random() - 0.5) * spread))
  if (rounded) {
    lat = Math.round(lat * 100) / 100
    lng = Math.round(lng * 100) / 100
  }
  if (coincident) {
    lat = hub[0]
    lng = hub[1]
  }
  if (id % 997 === 0) {
    lat = id % 2 ? 89 : -89
    lng = id % 2 ? 179.9 : -179.9
  }
  const openingTimes =
    id % 9
      ? {
          days: [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
          ].map((day, n) => ({
            day,
            enabled: n < 6 || id % 11 === 0,
            timeframes: [
              { startTime: "09:15", endTime: id % 7 ? "18:30" : "20:15" },
            ],
          })),
        }
      : null
  const source: AtlasLibrarySource = {
    documentId: `bench${String(id).padStart(10, "0")}`,
    name: `${names[id % names.length]} ${Math.floor(id / 3)}`,
    slug: `library-${id}`,
    locale: "en",
    published: true,
    libraryType: [
      "Public",
      "University",
      "Archive",
      "National",
      "Monastic",
      "Other",
      "Mobile",
    ][id % 7],
    operatorType: ["Municipality", "University", "Independent", null][id % 4],
    operationalStatus: id % 41 ? "open" : "permanently_closed",
    city: id % 31 ? hub[3] : null,
    location: { lat, lng },
    timezone: id % 37 ? hub[2] : null,
    openingTimes,
    country: { documentId: hub[4], slug: hub[4], name: hub[4] },
    region: { documentId: `region-${hub[4]}`, slug: hub[4], name: hub[3] },
    hasActiveFeed: id % 13 === 0,
    catalogueUrl: id % 4 ? null : "https://example.test/catalogue",
    foundedYear: 1700 + (id % 325),
    completeness: id % 19 ? id % 101 : null,
    accessibility: access.filter((_, n) => (id + n * 7) % (n + 3) === 0),
    services: services.filter((_, n) => (id + n * 3) % (n + 5) === 0),
    amenities: amenities.filter((_, n) => (id + n * 11) % (n + 7) === 0),
    notices:
      id % 97
        ? []
        : [
            {
              id: `notice-${id}`,
              type: "closure",
              scope: "library",
              scopeWeek: null,
              scopeDay: null,
              stopId: null,
              from: "2026-10-08",
              to: "2026-10-08",
              endedAt: null,
              message: "Temporary closure",
              reason: null,
            },
          ],
  }
  const projection = projectAtlasLibrary(source, {
    atlasId: id,
    canonicalLocale: "en",
    now,
  })!
  mapped++
  if (projection.listed) listed++
  await write(0, projection)
  await write(1, atlasPoint(projection))
  // Existing general index contains canonical and translated search documents;
  // describe this synthetic model explicitly rather than claiming production parity.
  const general = {
    ...projection,
    id: id * 2,
    description:
      `${source.name}: lending books, digital collections, events and community activities. `.repeat(
        5
      ),
    accessibility: source.accessibility?.map((o) => o.name),
    services: source.services?.map((o) => o.name),
    amenities: source.amenities?.map((o) => o.name),
    openingTimes,
  }
  await write(2, general)
  if (id % 5 === 0) {
    await write(2, {
      ...general,
      id: id * 2 + 1,
      locale: "fr",
      name: `Bibliothèque ${source.name}`,
    })
    translated++
  }
  if (id % 100 === 0) {
    timetableServices++
    for (let n = 0; n < 8; n++)
      await write(3, {
        id: `${id}-${n}`,
        serviceDocumentId: `mobile${id}`,
        stopId: `stop-${n}`,
        name: `Mobile stop ${n}`,
        _geo: { lat: lat + n / 10000, lng },
        schedule: { weekday: n % 7, arrival: "10:15", departure: "10:45" },
      })
    if (
      projectAtlasLibrary(
        { ...source, libraryType: "Mobile", mobileTimetable: {} },
        { atlasId: id, canonicalLocale: "en", now }
      )
    )
      throw new Error("Timetable depot leaked into building corpus")
  }
  if (id <= 2000) oracleSamples.push(projection)
  if (id % 10000 === 0) {
    await requireDisk()
    peakRss = Math.max(peakRss, process.memoryUsage().rss)
    console.log(
      JSON.stringify({
        stage: "generate",
        records: id,
        rss: process.memoryUsage().rss,
      })
    )
  }
}
for (const stream of streams) {
  stream.end()
  await once(stream, "finish")
}
await report("dataset", {
  seed,
  physicalRecords: count,
  mapped,
  listed,
  translated,
  timetableServices,
  mobileStops: timetableServices * 8,
  evaluatedAt: now.toISOString(),
  dictionary,
  seconds: (performance.now() - started) / 1000,
  peakRss,
  sha256: hashes.map((h) => h.digest("hex")),
  fullScale: false,
})
await report("oracle-sample", oracleSamples)
