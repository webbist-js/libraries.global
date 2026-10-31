import assert from "node:assert/strict"
import test from "node:test"

import { runtimeFindings, unreviewedFindings } from "./check-dependencies.mjs"

function report(path = "apps__strapi>vendor>package") {
  return {
    metadata: { vulnerabilities: {} },
    advisories: {
      fixture: {
        severity: "high",
        github_advisory_id: "GHSA-fixture",
        module_name: "package",
        findings: [{ version: "1.0.0", paths: [path] }],
      },
    },
  }
}
test("fails new findings and expires exceptions instead of silently accepting vendor changes", () => {
  const input = report()
  const finding = runtimeFindings(input)[0]
  assert.equal(unreviewedFindings(input, { findings: [] }).length, 1)
  const baseline = {
    findings: [
      { ...finding, reason: "Reviewed fixture", reviewBy: "2026-11-14" },
    ],
  }
  assert.equal(
    unreviewedFindings(input, baseline, new Date("2026-10-31")).length,
    0
  )
  assert.equal(
    unreviewedFindings(input, baseline, new Date("2026-11-14")).length,
    1
  )
  assert.equal(
    unreviewedFindings(input, {
      findings: [{ ...finding, reason: "Fixture", reviewBy: "invalid" }],
    }).length,
    1
  )
  assert.equal(
    unreviewedFindings(report("apps__strapi>different>package"), baseline)
      .length,
    1
  )
})
test("keeps non-deployed documentation build dependencies outside the application gate", () => {
  assert.deepEqual(runtimeFindings(report("apps__docs>builder>package")), [])
  assert.equal(
    runtimeFindings(report("packages__shared-data>package")).length,
    1
  )
})
test("fails incomplete audit output and unknown path formats", () => {
  assert.throws(() => runtimeFindings({}), /complete report/)
  assert.throws(() => runtimeFindings(report("unrecognized")), /Unrecognized/)
})
