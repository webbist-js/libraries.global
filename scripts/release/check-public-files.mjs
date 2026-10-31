import { execFileSync } from "node:child_process"
import { pathToFileURL } from "node:url"

const privatePaths = [
  /^\.claude\/context\//,
  /^(?:infra|docs|\.scratch)\//,
  /^\.motion-site\/log\.json$/,
  /^apps\/ui\/scripts\/[^/]*-catalogue\.json$/,
  /(?:^|\/)\.env(?:\.[^/]+)?$/,
  /(?:^|\/)(?:id_ed25519|id_rsa|id_ecdsa)(?:\.[^/]+)?$/,
  /\.(?:pem|key|p12|pfx|dump|sqlite|sqlite3)$/,
]

export function rejectedPublicPaths(paths) {
  return paths.filter(
    (path) =>
      !path.endsWith(".example") &&
      privatePaths.some((pattern) => pattern.test(path))
  )
}

function main() {
  const args = process.argv.slice(2)
  const gitArgs =
    args.length === 0
      ? ["ls-files", "-z"]
      : args.length === 2 &&
          args[0] === "--unpushed" &&
          /^[a-f0-9]{40}$/.test(args[1])
        ? [
            "log",
            "--format=",
            "--name-only",
            "-z",
            "--diff-filter=ACMR",
            args[1],
            "--not",
            "--remotes",
          ]
        : null
  if (!gitArgs) throw new Error("Expected --unpushed and a full commit SHA")
  const paths = execFileSync("/usr/bin/git", gitArgs, { encoding: "utf8" })
    .split(/[\0\n]/)
    .filter(Boolean)
  const rejected = rejectedPublicPaths(paths)
  if (rejected.length) {
    console.error(
      "Private operational paths must not be pushed:",
      [...new Set(rejected)].join(", ")
    )
    process.exitCode = 1
  } else
    console.log(
      `Checked ${paths.length} public paths; private operational paths are absent.`
    )
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main()
