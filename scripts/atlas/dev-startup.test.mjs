import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"
import { fileURLToPath } from "node:url"

test("pnpm dev schedules the Reach service and both Atlas workers", () => {
  const graph = JSON.parse(
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- Use the developer's pnpm installation for this local CLI regression test.
    execFileSync("pnpm", ["--silent", "dev", "--dry=json"], {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      encoding: "utf8",
      timeout: 30000,
      // The dry-run graph includes every workspace input and exceeds Node's
      // default 1 MiB output cap as the repository grows.
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048" },
    })
  )
  for (const id of [
    "@repo/analysis#dev",
    "@repo/sync-worker#dev:analysis",
    "@repo/sync-worker#dev:atlas",
  ]) {
    const task = graph.tasks.find((item) => item.taskId === id)
    assert.ok(task, `${id} is missing from pnpm dev`)
    assert.notEqual(task.command, "<NONEXISTENT>")
    assert.equal(task.resolvedTaskDefinition.persistent, true)
    assert.equal(task.resolvedTaskDefinition.cache, false)
  }
})
