import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const REPOSITORY = "webbist-js/libraries.global"

export const SERVICES = ["ui", "strapi", "worker", "analysis"]
const LEGACY_SERVICES = ["ui", "strapi", "worker"]
const SHA = /^[a-f0-9]{40}$/
const DIGEST = /^sha256:[a-f0-9]{64}$/

export function assertRegistry(registry) {
  if (
    typeof registry !== "string" ||
    !/^registry\.digitalocean\.com\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(registry)
  ) {
    throw new Error("Invalid private registry configuration.")
  }
}

export function createPublicManifest(commit, registry, references) {
  assertRegistry(registry)
  if (!SHA.test(commit ?? "")) throw new Error("Invalid release commit.")
  const images = Object.fromEntries(
    SERVICES.map((service) => {
      const reference = references?.[service]
      const prefix = `${registry}/${service}@`
      if (
        typeof reference !== "string" ||
        !reference.startsWith(prefix) ||
        !DIGEST.test(reference.slice(prefix.length))
      ) {
        throw new Error("Invalid published image digest.")
      }

      return [service, `${service}@${reference.slice(prefix.length)}`]
    })
  )

  return { schema: 3, repository: REPOSITORY, commit, images }
}

export function resolvePrivateReferences(manifest, registry) {
  assertRegistry(registry)
  const services = manifest?.schema === 2 ? LEGACY_SERVICES : SERVICES
  if (
    Object.keys(manifest ?? {})
      .sort()
      .join(",") !== "commit,images,repository,schema" ||
    ![2, 3].includes(manifest?.schema) ||
    manifest.repository !== REPOSITORY ||
    !SHA.test(manifest.commit ?? "") ||
    Object.keys(manifest.images ?? {})
      .sort()
      .join(",") !== [...services].sort().join(",")
  ) {
    throw new Error("Invalid public image manifest.")
  }

  return Object.fromEntries(
    services.map((service) => {
      const reference = manifest.images[service]
      const prefix = `${service}@`
      if (
        typeof reference !== "string" ||
        !reference.startsWith(prefix) ||
        !DIGEST.test(reference.slice(prefix.length))
      ) {
        throw new Error("Invalid public image manifest.")
      }

      return [service, `${registry}/${reference}`]
    })
  )
}

function main() {
  if (process.env.GITHUB_ACTIONS !== "true")
    throw new Error("Manifest publishing requires GitHub Actions.")
  const temporary = process.env.RUNNER_TEMP
  if (!temporary) throw new Error("Missing runner temporary directory.")
  const references = Object.fromEntries(
    SERVICES.map((service) => [
      service,
      readFileSync(path.join(temporary, `${service}.image`), "utf8").trim(),
    ])
  )
  const manifest = createPublicManifest(
    process.env.GITHUB_SHA,
    process.env.REGISTRY,
    references
  )
  writeFileSync(
    path.join(temporary, "release-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    { mode: 0o600 }
  )
  console.log(
    "Public commit and image digests recorded without registry details."
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main()
  } catch {
    console.error("Image manifest validation failed.")
    process.exitCode = 1
  }
}
