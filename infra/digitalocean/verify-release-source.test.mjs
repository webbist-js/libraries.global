import assert from "node:assert/strict"
import test from "node:test"

import {
  assertPassingChecks,
  assertProtectedSource,
} from "./verify-release-source.mjs"

const sha = "1234567890abcdef1234567890abcdef12345678"
const names = [
  "Install, Lint, Test and Build",
  "Analyze (javascript-typescript)",
  "Analyze (actions)",
]
const checks = () =>
  names.map((name, index) => ({
    id: index + 1,
    name,
    head_sha: sha,
    app: { id: 15368 },
    status: "completed",
    conclusion: "success",
  }))

test("accepts only the intended repository and protected branch", () => {
  assert.doesNotThrow(() =>
    assertProtectedSource("webbist-js/libraries.global", "refs/heads/dev", sha)
  )
  assert.throws(() =>
    assertProtectedSource("other/libraries.global", "refs/heads/dev", sha)
  )
  assert.throws(() =>
    assertProtectedSource(
      "webbist-js/libraries.global",
      "refs/pull/11/merge",
      sha
    )
  )
  assert.throws(() =>
    assertProtectedSource(
      "webbist-js/libraries.global",
      "refs/heads/codex/example",
      sha
    )
  )
  assert.throws(() =>
    assertProtectedSource(
      "webbist-js/libraries.global",
      "refs/heads/dev",
      "HEAD"
    )
  )
})

test("accepts completed checks from GitHub Actions on the selected commit", () => {
  assert.doesNotThrow(() => assertPassingChecks(checks(), sha))
})

test("rejects missing, pending, failed, neutral and skipped checks", () => {
  assert.throws(() => assertPassingChecks(checks().slice(1), sha))
  for (const conclusion of ["failure", "neutral", "skipped", null]) {
    const result = checks()
    result[0].conclusion = conclusion
    assert.throws(() => assertPassingChecks(result, sha))
  }
  const pending = checks()
  pending[0].status = "in_progress"
  assert.throws(() => assertPassingChecks(pending, sha))
})

test("rejects spoofed checks and checks from another commit", () => {
  const spoofed = checks()
  spoofed[0].app.id = 123
  assert.throws(() => assertPassingChecks(spoofed, sha))
  const different = checks()
  different[0].head_sha = "a".repeat(40)
  assert.throws(() => assertPassingChecks(different, sha))
})

test("uses the newest check so an earlier pass cannot hide a failed rerun", () => {
  const result = checks()
  result.push({ ...result[0], id: 20, conclusion: "failure" })
  assert.throws(() => assertPassingChecks(result, sha))
  result.push({ ...result[0], id: 21 })
  assert.doesNotThrow(() => assertPassingChecks(result, sha))
})
