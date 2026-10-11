import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"

import { expect, it } from "vitest"

const requireLocal = createRequire(import.meta.url)
const strapiPackage = requireLocal.resolve("@strapi/strapi/package.json")
const requireStrapi = createRequire(strapiPackage)
const { getUserConfig } = requireLocal(
  path.join(path.dirname(strapiPackage), "dist/src/node/core/config.js")
)
const { optimizeDeps, resolveConfig } = requireStrapi("vite")

it("refreshes the admin's linked CommonJS package after its exports change", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "strapi-admin-vite-"))
  try {
    const workspace = path.join(root, "packages/shared-data")
    const moduleScope = path.join(root, "node_modules/@repo")
    await mkdir(workspace, { recursive: true })
    await mkdir(moduleScope, { recursive: true })
    await writeFile(
      path.join(workspace, "package.json"),
      JSON.stringify({ name: "@repo/shared-data", main: "index.js" })
    )
    await symlink(workspace, path.join(moduleScope, "shared-data"))
    const entry = path.join(workspace, "index.js")
    await writeFile(entry, "exports.version = 1")

    const configureAdmin = await getUserConfig(["vite.config.ts"], {
      appDir: path.resolve(import.meta.dirname, ".."),
    })
    const config = configureAdmin({
      root,
      configFile: false,
      logLevel: "silent",
      optimizeDeps: { noDiscovery: true },
    })
    const cachedBundle = async (force: boolean) => {
      const resolved = await resolveConfig(
        { ...config, optimizeDeps: { ...config.optimizeDeps, force } },
        "serve"
      )
      const result = await optimizeDeps(resolved)

      return readFile(result.optimized["@repo/shared-data"].file, "utf8")
    }

    // Reproduce the actual bug: changing workspace output alone does not
    // invalidate Vite's dependency cache.
    expect(await cachedBundle(false)).not.toContain("normalizeOpeningSchedule")
    await writeFile(
      entry,
      "exports.normalizeOpeningSchedule = function normalizeOpeningSchedule(value) { return value }"
    )
    expect(await cachedBundle(false)).not.toContain("normalizeOpeningSchedule")
    expect(await cachedBundle(config.optimizeDeps.force)).toContain(
      "function normalizeOpeningSchedule"
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
