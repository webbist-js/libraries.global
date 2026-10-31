import assert from "node:assert/strict"
import test from "node:test"

import { rejectedPublicPaths } from "./check-public-files.mjs"

test("rejects operational material while allowing contributor docs and placeholders", () => {
  assert.deepEqual(
    rejectedPublicPaths([
      "docs/operations/recovery.md",
      ".scratch/runtime.env",
      "infra/network.json",
      "apps/ui/.env.local",
      "id_ed25519",
      "backup.dump",
      "apps/ui/.env.local.example",
      "apps/docs/docs/architecture.md",
      "scripts/release/release-agent.json.example",
    ]),
    [
      "docs/operations/recovery.md",
      ".scratch/runtime.env",
      "infra/network.json",
      "apps/ui/.env.local",
      "id_ed25519",
      "backup.dump",
    ]
  )
})
