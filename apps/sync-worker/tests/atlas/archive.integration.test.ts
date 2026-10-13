import { createRequire } from "node:module"
import path from "node:path"
import { readFile, writeFile, readdir } from "node:fs/promises"
import { tmpdir } from "node:os"

import knex, { type Knex } from "knex"
import { projectAtlasLibrary } from "@repo/shared-data"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import {
  buildAtlasArchive,
  verifyAtlasDelivery,
  type AtlasArchiveOptions,
} from "../../src/atlas/archive"

const header = Buffer.alloc(127)
header.write("PMTiles")
header[7] = 3
const delivery = () =>
  new Response(header, {
    status: 206,
    headers: {
      "content-range": "bytes 0-126/127",
      etag: '"immutable"',
      "access-control-allow-origin": "https://ui.test",
      "access-control-expose-headers": "ETag, Content-Range",
    },
  })
afterEach(() => vi.unstubAllGlobals())
describe("Atlas delivery response contract", () => {
  it("accepts only an exact bounded 206 with exposed ETag and CORS", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => delivery())
    )
    await verifyAtlasDelivery(
      "https://cdn.test/archive",
      127,
      "https://ui.test",
      new AbortController().signal
    )
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(header))
    )
    await expect(
      verifyAtlasDelivery(
        "https://cdn.test/archive",
        127,
        "https://ui.test",
        new AbortController().signal
      )
    ).rejects.toThrow("range/CORS")
  })
  it("cancels an oversized range instead of consuming a complete archive", async () => {
    const cancelled = vi.fn()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(128))
      },
      cancel: cancelled,
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(stream, {
            status: 206,
            headers: Object.fromEntries(delivery().headers),
          })
      )
    )
    await expect(
      verifyAtlasDelivery(
        "https://cdn.test/archive",
        127,
        "https://ui.test",
        new AbortController().signal
      )
    ).rejects.toThrow("Oversized")
    expect(cancelled).toHaveBeenCalledOnce()
  })
})
describe.skipIf(!process.env.ATLAS_TEST_DATABASE_URL)(
  "Atlas fenced archive publication",
  () => {
    let db: Knex
    beforeAll(async () => {
      const url = new URL(process.env.ATLAS_TEST_DATABASE_URL!)
      if (
        url.hostname !== "127.0.0.1" ||
        url.port !== "15432" ||
        url.pathname !== "/atlas_test"
      )
        throw new Error("Use isolated Atlas fixture")
      db = knex({
        client: "pg",
        connection: url.toString(),
        pool: { min: 0, max: 2 },
      })
      const require = createRequire(path.resolve("package.json"))
      await require("../strapi/database/migrations/2026.10.08T00.00.00.atlas-projection.js").up(
        db
      )
    })
    afterAll(async () => {
      await db?.destroy()
    })
    beforeEach(async () => {
      await db.raw(
        "TRUNCATE atlas_changes, atlas_index_batches, atlas_outbox, atlas_records RESTART IDENTITY CASCADE"
      )
      await db("atlas_state")
        .where({ key: "current" })
        .update({
          projection_revision: "1",
          indexed_through: "1",
          journal_floor: "0",
          query_epoch: "00000000-0000-4000-8000-000000000001",
          dictionary: JSON.stringify({ version: "fixture", entries: [] }),
          manifest: null,
          archive_history: "[]",
          build_token: null,
          build_until: null,
        })
      const projection = projectAtlasLibrary(
        {
          documentId: "one",
          name: "Current data",
          slug: "current-data",
          locale: "en",
          published: true,
          location: { lat: 0, lng: 0 },
        },
        { atlasId: 1, canonicalLocale: "en", now: new Date() }
      )!
      await db("atlas_records").insert({
        document_id: "one",
        active: true,
        projection: JSON.stringify(projection),
        latitude: 0,
        longitude: 0,
        revision: "1",
      })
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => delivery())
      )
    })
    const options = (): AtlasArchiveOptions => ({
      detailZoom: 10,
      publicBaseUrl: "https://cdn.test/",
      bucket: "atlas-test",
      endpoint: "https://r2.test",
      validator: "/fixture/validator.py",
      origin: "https://ui.test",
      runner: vi.fn(async (command, args, cwd) => {
        if (command === "tippecanoe" && args[0] === "-v")
          return "tippecanoe v2.79.0\n"
        if (command === "pmtiles" && args[0] === "version")
          return "pmtiles 1.31.2, commit fixture\n"
        if (command === "tippecanoe") {
          expect(args).toContain("-r1")
          expect(args.some((arg) => /drop|coalesce|cluster/.test(arg))).toBe(
            false
          )
          const line = await readFile(path.join(cwd, "source.ndjson"), "utf8")
          expect(JSON.parse(line).properties.i).toBe("one")
        }
        if (command === "python3")
          return JSON.stringify({ complete: true, sourceCount: 1 })
        if (command === "pmtiles" && args[0] === "convert")
          await writeFile(path.join(cwd, "archive.pmtiles"), header)
        return ""
      }),
    })
    it("uploads immutable archive before manifest, coalesces another job and cleans scratch", async () => {
      const before = await readdir(tmpdir()),
        config = options()
      const result = await buildAtlasArchive(
        db,
        config,
        new AbortController().signal
      )
      expect(result).toMatchObject({
        count: 1,
        sourceStartRevision: "1",
        sourceEndRevision: "1",
        archiveBytes: 127,
      })
      const uploads = vi
        .mocked(config.runner!)
        .mock.calls.filter(([command]) => command === "aws")
      expect(uploads[0][1].join(" ")).toContain("archive.pmtiles")
      expect(uploads[1][1].join(" ")).toContain("manifest.json")
      expect(
        await buildAtlasArchive(db, options(), new AbortController().signal)
      ).toBeNull()
      expect(
        (await readdir(tmpdir())).filter(
          (file) => file.startsWith("atlas-build-") && !before.includes(file)
        )
      ).toEqual([])
    })
    it("keeps the previous pointer when delivery fails or the query epoch changes", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(header))
      )
      await expect(
        buildAtlasArchive(db, options(), new AbortController().signal)
      ).rejects.toThrow("range/CORS")
      expect((await db("atlas_state").first()).manifest).toBeNull()
      const config = options(),
        runner = config.runner!
      config.runner = async (...args) => {
        const result = await runner(...args)
        if (args[0] === "pmtiles" && args[1][0] === "verify")
          await db("atlas_state").update({
            query_epoch: "00000000-0000-4000-8000-000000000002",
          })
        return result
      }
      await expect(
        buildAtlasArchive(db, config, new AbortController().signal)
      ).rejects.toThrow("cannot be reconciled")
      expect((await db("atlas_state").first()).build_token).toBeNull()
    })
  }
)
