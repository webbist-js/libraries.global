import assert from "node:assert/strict"
import test from "node:test"

import { manifestCheck } from "./publish-manifest-check.mjs"

test("publishes the commit and relative digests with an exact workflow attempt", () => {
  const manifest = {
    schema: 2,
    repository: "webbist-js/libraries.global",
    commit: "a".repeat(40),
    images: {},
  }
  const check = manifestCheck(manifest, "12345", "2")
  assert.equal(check.head_sha, manifest.commit)
  assert.equal(check.external_id, "12345:2")
  assert.match(check.details_url, /runs\/12345\/attempts\/2$/)
  assert.deepEqual(JSON.parse(check.output.summary), manifest)
  assert.doesNotMatch(check.output.summary, /registry|token|password/)
})

test("refuses workflow identifiers that could redirect the server", () => {
  for (const id of ["123/../../other", "", "0", "1\nprivate", undefined])
    assert.throws(() => manifestCheck({}, id, "1"))
})
