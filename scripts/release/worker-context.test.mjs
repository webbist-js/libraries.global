import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { exportWorkerContext } from "./worker-context.mjs"

test("the real worker build context includes its Dockerfile and excludes UI and operator files", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "worker-context-test-"))
  try {
    const commit = execFileSync("/usr/bin/git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim()
    exportWorkerContext(commit, directory)
    assert.equal(
      existsSync(path.join(directory, "apps/sync-worker/Dockerfile")),
      true
    )
    for (const name of [
      "apps/ui",
      ".git",
      ".scratch",
      "docs",
      "infra",
      "node_modules",
    ])
      assert.equal(existsSync(path.join(directory, name)), false, name)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("refuses shell fragments and relative destinations", () => {
  assert.throws(() => exportWorkerContext("HEAD; echo unsafe", process.cwd()))
  assert.throws(() => exportWorkerContext("a".repeat(40), "worker"))
})
