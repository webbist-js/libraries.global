import { pathToFileURL } from "node:url"

const REPOSITORY = "webbist-js/libraries.global"
const REQUIRED_CHECKS = [
  "Install, Lint, Test and Build",
  "Analyze (javascript-typescript)",
  "Analyze (actions)",
]

export function assertProtectedSource(repository, ref, sha) {
  if (repository !== REPOSITORY || ref !== "refs/heads/dev") {
    throw new Error("Image publishing requires the protected dev branch.")
  }
  if (!/^[a-f0-9]{40}$/.test(sha ?? "")) {
    throw new Error("Invalid release commit.")
  }
}

export function assertPassingChecks(checks, sha) {
  if (!Array.isArray(checks)) throw new Error("Missing release checks.")
  for (const name of REQUIRED_CHECKS) {
    const matching = checks
      .filter(
        (check) =>
          check.name === name &&
          check.head_sha === sha &&
          check.app?.id === 15368
      )
      .sort((a, b) => b.id - a.id)
    const latest = matching[0]
    if (latest?.status !== "completed" || latest.conclusion !== "success") {
      throw new Error(`Release check has not passed: ${name}`)
    }
  }
}

async function githubJson(path) {
  const response = await fetch(
    `https://api.github.com/repos/${REPOSITORY}/${path}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      signal: AbortSignal.timeout(15000),
    }
  )
  if (!response.ok)
    throw new Error(`Release verification returned HTTP ${response.status}.`)

  return response.json()
}

async function main() {
  const sha = process.env.GITHUB_SHA
  assertProtectedSource(
    process.env.GITHUB_REPOSITORY,
    process.env.GITHUB_REF,
    sha
  )
  const branch = await githubJson("git/ref/heads/dev")
  if (branch.object?.sha !== sha)
    throw new Error("The release commit is no longer the dev branch head.")
  const checks = await githubJson(`commits/${sha}/check-runs?per_page=100`)
  assertPassingChecks(checks.check_runs, sha)
  console.log("Protected release source and required commit checks verified.")
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
