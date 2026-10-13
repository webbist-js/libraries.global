import { execFileSync } from "node:child_process"

const paths = execFileSync("/usr/bin/git", ["ls-files", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean)
const privatePaths = [
  /^(?:infra|docs|\.scratch)\//,
  /^\.motion-site\/log\.json$/,
  /^apps\/ui\/scripts\/[^/]*-catalogue\.json$/,
  /(?:^|\/)\.env(?:\.[^/]+)?$/,
  /(?:^|\/)(?:id_ed25519|id_rsa|id_ecdsa)(?:\.[^/]+)?$/,
  /\.(?:pem|key|p12|pfx|dump|sqlite|sqlite3)$/,
]
const rejected = paths.filter(
  (path) =>
    !path.endsWith(".example") &&
    privatePaths.some((pattern) => pattern.test(path))
)
if (rejected.length) {
  console.error(
    "Private operational files must not be tracked:",
    rejected.join(", ")
  )
  process.exitCode = 1
} else {
  console.log(
    `Checked ${paths.length} public files; private operational paths are absent.`
  )
}
