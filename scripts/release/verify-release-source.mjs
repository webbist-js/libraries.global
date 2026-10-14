import { pathToFileURL } from "node:url"

export const REPOSITORY = "webbist-js/libraries.global"
export const REQUIRED_CHECKS = [
  "Install, Lint, Test and Build",
  "Analyze (javascript-typescript)",
  "Analyze (python)",
  "Analyze (actions)",
]

export function assertProtectedSource(repository, ref, sha) {
  if (repository !== REPOSITORY || ref !== "refs/heads/main") {
    throw new Error("Production releases require the protected main branch.")
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

export async function githubJson(path, options = {}) {
  const response = await fetch(
    `https://api.github.com/repos/${REPOSITORY}/${path}`,
    {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
        ...options.headers,
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
  const deadline =
    Date.now() + (process.argv.includes("--wait") ? 55 * 60_000 : 0)
  for (;;) {
    const branch = await githubJson("git/ref/heads/main")
    if (branch.object?.sha !== sha)
      throw new Error("The release commit is no longer the main branch head.")
    const checks = await githubJson(
      `commits/${sha}/check-runs?per_page=100&filter=all`
    )
    if (checks.total_count > checks.check_runs.length)
      throw new Error(
        "Release checks are truncated; operator verification is required."
      )
    const state = releaseChecksState(checks.check_runs, sha)
    if (state === "success") break
    if (state === "failure" || Date.now() >= deadline)
      assertPassingChecks(checks.check_runs, sha)
    console.log("Waiting for CI and CodeQL on the merged main commit.")
    await new Promise((resolve) => setTimeout(resolve, 30_000))
  }
  console.log("Protected release source and required commit checks verified.")
}

export function releaseChecksState(checks, sha) {
  if (!Array.isArray(checks)) throw new Error("Missing release checks.")
  let pending = false
  for (const name of REQUIRED_CHECKS) {
    const latest = checks
      .filter(
        (check) =>
          check.name === name &&
          check.head_sha === sha &&
          check.app?.id === 15368
      )
      .sort((a, b) => b.id - a.id)[0]
    if (!latest || latest.status !== "completed") pending = true
    else if (latest.conclusion !== "success") return "failure"
  }

  return pending ? "pending" : "success"
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
