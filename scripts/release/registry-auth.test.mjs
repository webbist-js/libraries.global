import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { maskCommand, validateRegistryLogin } from "./registry-auth.mjs"

const registry = "registry.digitalocean.com/example-registry"

test("registry login refuses missing or injected credential inputs", () => {
  assert.doesNotThrow(() =>
    validateRegistryLogin(registry, "example-user", "example-token")
  )
  for (const [username, token] of [
    [undefined, "example-token"],
    ["example-user", undefined],
    ["example:user", "example-token"],
    ["example-user\nother", "example-token"],
    ["example-user", "example-token\nother"],
    ["", ""],
  ]) {
    assert.throws(() => validateRegistryLogin(registry, username, token))
  }
})

test("workflow masks escape control characters before emitting a command", () => {
  assert.equal(
    maskCommand("example%\r\n::warning::text"),
    "::add-mask::example%25%0D%0A::warning::text\n"
  )
})

test("local invocation fails before consuming or printing credentials", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./registry-auth.mjs", import.meta.url))],
    {
      env: {
        ...process.env,
        GITHUB_ACTIONS: "false",
        REGISTRY: registry,
        DO_REGISTRY_USERNAME: "example-user",
        DO_REGISTRY_TOKEN: "example-token",
      },
      encoding: "utf8",
    }
  )
  assert.equal(result.status, 1)
  assert.equal(result.stdout, "")
  assert.equal(result.stderr.includes("example-token"), false)
  assert.equal(result.stderr.includes("example-user"), false)
  assert.equal(result.stderr.includes(registry), false)
})
