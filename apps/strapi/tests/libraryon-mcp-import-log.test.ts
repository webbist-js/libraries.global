import { spawnSync } from "node:child_process"
import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { afterAll, describe, expect, it } from "vitest"

const strapi = path.resolve(__dirname, "..")
const script = path.join(strapi, "scripts/libraryon-mcp-import.ts")
const tsx = pathToFileURL(createRequire(script).resolve("tsx")).href
// Relative log paths resolve here, so any file the refusal created would show.
const cwd = mkdtempSync(path.join(tmpdir(), "libraryon-log-"))
afterAll(() => rmSync(cwd, { recursive: true, force: true }))

const run = (args: string[]) =>
  spawnSync(process.execPath, ["--import", tsx, script, ...args], {
    cwd,
    // Unroutable endpoints: a guard failure can never reach a real service.
    env: {
      ...process.env,
      STRAPI_URL: "http://127.0.0.1:9",
      STRAPI_MCP_TOKEN: "",
      LIBRARYON_API: "http://127.0.0.1:9",
    },
    encoding: "utf8",
    timeout: 20000,
  })

describe("libraryon-mcp-import.ts log location", () => {
  it.each([[[]], [["--dry-run"]], [["--log"]], [["--log="]]])(
    "requires an explicit --log path (%j)",
    (args) => {
      const result = run(args)
      expect(result.status).toBe(1)
      expect(result.stderr).toMatch(/--log=<path> is required/)
      expect(readdirSync(cwd)).toEqual([])
    }
  )

  it("has no implicit scratch default", async () => {
    const { readFile } = await import("node:fs/promises")
    expect(await readFile(script, "utf8")).not.toMatch(/\.scratch/)
  })
})
