import { readFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { resolvePrivateReferences } from "./image-manifest.mjs"
import {
  assertProtectedSource,
  githubJson,
  REPOSITORY,
} from "./verify-release-source.mjs"

export function manifestCheck(manifest, runId, attempt) {
  if (!/^[1-9]\d*$/.test(runId ?? "") || !/^[1-9]\d*$/.test(attempt ?? ""))
    throw new Error("Invalid publisher run.")

  return {
    name: "Production image manifest",
    head_sha: manifest.commit,
    external_id: `${runId}:${attempt}`,
    details_url: `https://github.com/${REPOSITORY}/actions/runs/${runId}/attempts/${attempt}`,
    status: "completed",
    conclusion: "success",
    output: {
      title: "Immutable production images",
      summary: JSON.stringify(manifest),
    },
  }
}

async function main() {
  assertProtectedSource(
    process.env.GITHUB_REPOSITORY,
    process.env.GITHUB_REF,
    process.env.GITHUB_SHA
  )
  const manifest = JSON.parse(
    readFileSync(
      path.join(process.env.RUNNER_TEMP, "release-manifest.json"),
      "utf8"
    )
  )
  resolvePrivateReferences(manifest, process.env.REGISTRY)
  if (manifest.commit !== process.env.GITHUB_SHA)
    throw new Error("Publisher commit mismatch.")
  const branch = await githubJson("git/ref/heads/main")
  if (branch.object?.sha !== manifest.commit)
    throw new Error("A newer main commit superseded this build.")
  await githubJson("check-runs", {
    method: "POST",
    body: JSON.stringify(
      manifestCheck(
        manifest,
        process.env.GITHUB_RUN_ID,
        process.env.GITHUB_RUN_ATTEMPT
      )
    ),
    headers: { "Content-Type": "application/json" },
  })
  console.log(
    "Published the credential-free manifest for the server's pull agent."
  )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    console.error("Production manifest publication failed.")
    process.exitCode = 1
  })
}
