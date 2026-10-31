import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const RUNTIME = /^(?:apps__(?:ui|strapi|sync-worker)|packages__[^>]+)>/

export function runtimeFindings(report) {
  if (!report?.metadata?.vulnerabilities || !report.advisories)
    throw new Error("Dependency audit did not return a complete report")
  const findings = []
  for (const advisory of Object.values(report.advisories)) {
    if (!["high", "critical"].includes(advisory.severity)) continue
    for (const finding of advisory.findings) {
      for (const dependencyPath of finding.paths) {
        if (!/^(?:apps|packages|qa)__[^>]+>/.test(dependencyPath))
          throw new Error("Unrecognized dependency-audit path")
        if (RUNTIME.test(dependencyPath))
          findings.push({
            advisory: advisory.github_advisory_id,
            module: advisory.module_name,
            version: finding.version,
            path: dependencyPath,
          })
      }
    }
  }

  return findings
}
const key = (finding) =>
  [finding.advisory, finding.module, finding.version, finding.path].join("|")

export function unreviewedFindings(report, baseline, now = new Date()) {
  const reviewed = new Map(
    baseline.findings.map((finding) => [key(finding), finding])
  )

  return runtimeFindings(report).filter((finding) => {
    const exception = reviewed.get(key(finding))
    const expiresAt = Date.parse(exception?.reviewBy ?? "")

    return (
      !exception?.reason || !Number.isFinite(expiresAt) || expiresAt <= +now
    )
  })
}
function main() {
  let output
  try {
    // CI installs pnpm through the pinned setup action. Neither the executable
    // name nor its arguments come from repository input or audit output.
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    output = execFileSync("pnpm", ["audit", "--prod", "--json"], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 120_000,
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (error) {
    output = error.stdout
  }
  const report = JSON.parse(output || "null")
  const baseline = JSON.parse(
    readFileSync(
      new URL("../../qa/security/dependency-baseline.json", import.meta.url),
      "utf8"
    )
  )
  const remaining = unreviewedFindings(report, baseline)
  console.log(
    "Production audit totals (all workspaces):",
    report.metadata.vulnerabilities
  )
  if (remaining.length) {
    for (const finding of remaining)
      console.error("Unreviewed or expired runtime finding:", key(finding))
    process.exitCode = 1
  } else
    console.log(
      "No new high/critical application findings; dated upstream exceptions remain separately recorded."
    )
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main()
