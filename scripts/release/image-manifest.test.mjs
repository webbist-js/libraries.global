import assert from "node:assert/strict"
import test from "node:test"

import {
  assertRegistry,
  createPublicManifest,
  resolvePrivateReferences,
  SERVICES,
} from "./image-manifest.mjs"

const commit = "a".repeat(40)
const registry = "registry.digitalocean.com/example-registry"
const digest = `sha256:${"b".repeat(64)}`
const references = () =>
  Object.fromEntries(
    SERVICES.map((name) => [name, `${registry}/${name}@${digest}`])
  )

test("public artifact contains only the source and service digests", () => {
  const manifest = createPublicManifest(commit, registry, references())
  assert.equal(manifest.schema, 2)
  assert.equal(manifest.commit, commit)
  assert.deepEqual(manifest.images, {
    ui: `ui@${digest}`,
    strapi: `strapi@${digest}`,
    worker: `worker@${digest}`,
  })
  assert.doesNotMatch(JSON.stringify(manifest), /registry/)
  assert.deepEqual(resolvePrivateReferences(manifest, registry), references())
})

test("rejects image tags, wrong registries, wrong services and malformed digests", () => {
  for (const ui of [
    `${registry}/ui:git-${commit}`,
    `registry.digitalocean.com/another-registry/ui@${digest}`,
    `${registry}/worker@${digest}`,
    `${registry}/ui@sha256:short`,
    `${registry}/ui@${digest}\nextra`,
    undefined,
  ]) {
    assert.throws(() =>
      createPublicManifest(commit, registry, { ...references(), ui })
    )
  }
  assert.throws(() => createPublicManifest("HEAD", registry, references()))
})

test("private resolution refuses malformed or unexpected artifact fields", () => {
  const valid = createPublicManifest(commit, registry, references())
  for (const manifest of [
    { ...valid, schema: 1 },
    { ...valid, registry },
    { ...valid, repository: "another/project" },
    { ...valid, commit: "HEAD" },
    { ...valid, images: { ...valid.images, ui: references().ui } },
    { ...valid, images: { ...valid.images, another: `another@${digest}` } },
    { ...valid, images: { ui: `ui@${digest}` } },
    { ...valid, images: { ...valid.images, ui: `strapi@${digest}` } },
  ]) {
    assert.throws(() => resolvePrivateReferences(manifest, registry))
  }
})

test("refuses arbitrary hosts, paths and control characters without echoing them", () => {
  for (const value of [
    "https://registry.digitalocean.com/example-registry",
    "registry.digitalocean.com/example-registry/extra",
    "example-registry.invalid/private",
    registry + "\n::warning::private",
    undefined,
  ]) {
    assert.throws(() => assertRegistry(value), {
      message: "Invalid private registry configuration.",
    })
  }
})
