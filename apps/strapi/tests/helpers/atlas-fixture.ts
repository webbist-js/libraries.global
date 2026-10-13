import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"

import { createStrapi } from "@strapi/strapi"

import { registerAtlasOutboxMiddleware } from "../../src/documentMiddlewares/atlas-outbox"

/** A tiny isolated app using the installed Strapi and a disposable PostgreSQL DB. */
export async function createAtlasFixture() {
  const url = process.env.ATLAS_TEST_DATABASE_URL
  if (!url) throw new Error("Set ATLAS_TEST_DATABASE_URL explicitly")
  const parsed = new URL(url)
  if (
    !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
    parsed.port !== "15432" ||
    parsed.pathname !== "/atlas_test"
  )
    throw new Error(
      "Atlas transaction tests require the isolated atlas_test DB on localhost:15432"
    )
  const directory = await mkdtemp(path.join(tmpdir(), "atlas-strapi-"))
  const put = async (file: string, body: string) => {
    const target = path.join(directory, file)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, body)
  }
  await put(
    "package.json",
    JSON.stringify({
      name: "atlas-transaction-fixture",
      version: "1.0.0",
      dependencies: { "@strapi/strapi": "5.55.1", pg: "^8.13.1" },
    })
  )
  await symlink(
    path.resolve("node_modules"),
    path.join(directory, "node_modules")
  )
  await put(
    "config/database.js",
    `module.exports = { connection: { client: 'postgres', connection: { connectionString: ${JSON.stringify(url)} }, pool: { min: 0, max: 4 } } }`
  )
  await put(
    "config/server.js",
    "module.exports = { app: { keys: ['atlas-test-key-1', 'atlas-test-key-2'] }, host: '127.0.0.1', port: 17720 }"
  )
  await put(
    "config/admin.js",
    "module.exports = { auth: { secret: 'atlas-test-admin-secret' }, apiToken: { salt: 'atlas-test-api-salt' }, transfer: { token: { salt: 'atlas-test-transfer-salt' } } }"
  )
  await put("config/plugins.js", "module.exports = {}")
  await mkdir(path.join(directory, "public/uploads"), { recursive: true })
  for (const [name, attributes, draftAndPublish] of [
    [
      "library",
      {
        name: { type: "string", required: true },
        slug: { type: "string" },
        completeness: { type: "integer" },
      },
      true,
    ],
    ["region", { name: { type: "string" }, slug: { type: "string" } }, true],
    [
      "library-notice",
      {
        type: { type: "string" },
        library: {
          type: "relation",
          relation: "manyToOne",
          target: "api::library.library",
        },
      },
      false,
    ],
  ] as const) {
    await put(
      `src/api/${name}/content-types/${name}/schema.json`,
      JSON.stringify({
        kind: "collectionType",
        info: { singularName: name, pluralName: `${name}s`, displayName: name },
        options: { draftAndPublish },
        attributes,
      })
    )
  }
  const previousEnabled = process.env.ATLAS_ENABLED
  process.env.ATLAS_ENABLED = "true"
  process.env.STRAPI_TELEMETRY_DISABLED = "1"
  const strapi = await createStrapi({
    appDir: directory,
    distDir: directory,
    autoReload: false,
    serveAdminPanel: false,
  }).load()
  const require = createRequire(path.resolve("package.json"))
  await require("./database/migrations/2026.10.08T00.00.00.atlas-projection.js").up(
    strapi.db.connection
  )
  registerAtlasOutboxMiddleware({ strapi })
  await strapi.db.connection("atlas_outbox").delete()

  return {
    strapi,
    async destroy() {
      // Strapi 5.55.1 removes *all* process listeners at teardown. Keep the
      // test runner's IPC handlers; this does not change content transactions.
      const removeListeners = process.removeAllListeners
      process.removeAllListeners = function (event?: string | symbol) {
        return event === undefined ? this : removeListeners.call(this, event)
      }
      try {
        await strapi.destroy()
      } finally {
        process.removeAllListeners = removeListeners
        if (previousEnabled === undefined) delete process.env.ATLAS_ENABLED
        else process.env.ATLAS_ENABLED = previousEnabled
        await rm(directory, { recursive: true, force: true })
      }
    },
  }
}
