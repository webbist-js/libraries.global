import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, describe, expect, it } from "vitest"

const scripts = fileURLToPath(new URL("../scripts/", import.meta.url))
const directory = mkdtempSync(path.join(tmpdir(), "token-guard-"))
const envFile = path.join(directory, "cms.env")
// Only the local development token is configured. The production URL is
// unroutable so a guard failure can never reach a real CMS.
writeFileSync(
  envFile,
  [
    "STRAPI_MCP_TOKEN=local-development-placeholder",
    "STRAPI_PRODUCTION_URL=https://cms.invalid",
  ].join("\n")
)
afterAll(() => rmSync(directory, { recursive: true, force: true }))

const childEnv = () => {
  const env = { ...process.env, CMS_ENV_FILE: envFile }
  delete env.STRAPI_PRODUCTION_MCP_TOKEN
  delete env.STRAPI_PRODUCTION_URL

  return env
}
const run = (script: string, args: string[] = []) =>
  spawnSync(process.execPath, [path.join(scripts, script), ...args], {
    env: childEnv(),
    encoding: "utf8",
    timeout: 20000,
  })

const missingProductionToken =
  /STRAPI_PRODUCTION_MCP_TOKEN is missing; production never uses the local STRAPI_MCP_TOKEN/

describe.each([
  ["attribute-journal-author.mjs", ["--env-file", envFile, "--username", "a"]],
  ["update-beta-invitation-notice.mjs", []],
])("%s production credential", (script, args) => {
  it("refuses production without the production editorial token", () => {
    const result = run(script, args)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(missingProductionToken)
  })

  it("never falls back to the local development token", () => {
    const source = readFileSync(path.join(scripts, script), "utf8")
    expect(source).not.toMatch(
      /PRODUCTION_MCP_TOKEN\s*\|\|\s*(?:process\.)?(?:env|source)\.STRAPI_MCP_TOKEN/
    )
  })
})

describe("attribute-journal-author.mjs local credential", () => {
  it("accepts the local token for an explicit local run", () => {
    // Port 9 refuses connections, so the run stops at the first request.
    const result = run("attribute-journal-author.mjs", [
      "--env-file",
      envFile,
      "--username",
      "a",
      "--local",
      "--url",
      "http://127.0.0.1:9",
    ])
    expect(result.status).not.toBe(0)
    expect(result.stderr).not.toMatch(/is missing/)
  })
})
