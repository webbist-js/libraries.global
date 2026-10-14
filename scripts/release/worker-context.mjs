import { execFileSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

export function exportWorkerContext(commit, destination) {
  if (
    !/^[a-f0-9]{40}$/.test(commit ?? "") ||
    !path.isAbsolute(destination ?? "")
  )
    throw new Error("Invalid worker build context.")
  mkdirSync(destination, { recursive: true, mode: 0o700 })
  const archive = execFileSync("/usr/bin/git", ["archive", commit], {
    maxBuffer: 80 * 1024 * 1024,
  })
  // The worker Dockerfile deliberately refuses a context containing apps/ui.
  execFileSync("/usr/bin/tar", ["-x", "-C", destination, "--exclude=apps/ui"], {
    input: archive,
  })
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    exportWorkerContext(
      process.env.GITHUB_SHA,
      path.join(process.env.RUNNER_TEMP, "worker-context")
    )
    console.log(
      "Exported the committed worker context without UI or local files."
    )
  } catch {
    console.error("Worker build context preparation failed.")
    process.exitCode = 1
  }
}
