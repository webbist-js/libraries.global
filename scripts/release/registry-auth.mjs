import { spawnSync } from "node:child_process"
import { appendFileSync, chmodSync, mkdtempSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { assertRegistry } from "./image-manifest.mjs"

export function validateRegistryLogin(registry, username, token) {
  assertRegistry(registry)
  if (
    typeof username !== "string" ||
    !username ||
    /[:\r\n\0]/.test(username) ||
    typeof token !== "string" ||
    !token ||
    /[\r\n\0]/.test(token)
  ) {
    throw new Error("Missing or invalid registry login.")
  }
}

export function maskCommand(value) {
  return `::add-mask::${value
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A")}\n`
}

function main() {
  if (process.env.GITHUB_ACTIONS !== "true")
    throw new Error("Registry login requires GitHub Actions.")
  const registry = process.env.REGISTRY
  const username = process.env.DO_REGISTRY_USERNAME
  const token = process.env.DO_REGISTRY_TOKEN
  validateRegistryLogin(registry, username, token)
  const auth = `${username}:${token}`
  for (const value of [
    registry,
    username,
    token,
    auth,
    Buffer.from(auth).toString("base64"),
  ]) {
    process.stdout.write(maskCommand(value))
  }
  const temporary = process.env.RUNNER_TEMP
  const environmentFile = process.env.GITHUB_ENV
  for (const value of [temporary, environmentFile]) {
    if (!value || !path.isAbsolute(value) || /[\r\n\0]/.test(value))
      throw new Error("Missing runner paths.")
  }
  // Atomic private directory outside the checkout; cleanup knows it before login.
  const configuration = mkdtempSync(path.join(temporary, "registry-"))
  chmodSync(configuration, 0o700)
  appendFileSync(environmentFile, `DOCKER_CONFIG=${configuration}\n`)
  const login = spawnSync(
    "/usr/bin/docker",
    [
      "login",
      "registry.digitalocean.com",
      "--username",
      username,
      "--password-stdin",
    ],
    {
      input: token + "\n",
      encoding: "utf8",
      maxBuffer: 64 * 1024,
      timeout: 30000,
      env: { ...process.env, DOCKER_CONFIG: configuration },
    }
  )
  // Docker diagnostics may include login details. Keep them out of the log.
  if (login.status !== 0) throw new Error("Registry authentication failed.")
  chmodSync(path.join(configuration, "config.json"), 0o600)
  console.log("Scoped registry authentication configured.")
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main()
  } catch {
    console.error(
      "Registry authentication setup failed; verify its scoped secrets and expiry."
    )
    process.exitCode = 1
  }
}
