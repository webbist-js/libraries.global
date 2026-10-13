import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { performance } from "node:perf_hooks"

import {
  artifactDirectory,
  readReport,
  report,
  requireDisk,
  requireDisposable,
} from "./runtime.js"

const { resolve } = path

requireDisposable()
const dataset = await readReport<{
  physicalRecords: number
  fullScale: boolean
}>("dataset")
const config = JSON.parse(
  await readFile(
    new URL(
      "../../../apps/sync-worker/atlas-build.config.json",
      import.meta.url
    ),
    "utf8"
  )
) as { linuxImage: string | null; candidateDetailZooms: number[] }
if (!config.linuxImage?.startsWith("sha256:"))
  throw new Error(
    "Build and pin the Linux image ID in atlas-build.config.json first"
  )
const image = config.linuxImage
const candidate = Number(process.env.ATLAS_BENCH_DETAIL_ZOOM ?? 10)
if (!config.candidateDetailZooms.includes(candidate))
  throw new Error("Detail zoom must be 10..16")
await requireDisk()
async function run(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker", // eslint-disable-line sonarjs/no-os-command-from-path -- Opt-in local benchmark invokes Docker with fixed arguments.
      [
        "run",
        "--rm",
        "--label",
        "atlas.disposable=true",
        "--cpus=2",
        "--memory=2g",
        "-v",
        `${artifactDirectory}:/data`,
        image,
        ...args,
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    )
    const stdout: Buffer[] = [],
      stderr: Buffer[] = []
    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.reduce((n, b) => n + b.length, 0) < 1024 * 1024)
        stdout.push(chunk)
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr.push(chunk)
      if (stderr.length > 20) stderr.shift()
    })
    child.on("error", reject)
    child.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(stdout).toString())
        : reject(
            new Error(
              `Native build failed (${code}): ${Buffer.concat(stderr).toString()}`
            )
          )
    )
  })
}
const started = performance.now()
try {
  await run([
    "tippecanoe",
    "-o",
    `atlas-z${candidate}.mbtiles`,
    "-l",
    "libraries",
    "-Z",
    String(candidate),
    "-z16",
    "-B",
    String(candidate),
    "-r1",
    "-M512000",
    "-O200000",
    "-Q",
    "libraries.ndjson",
  ])
  const built = performance.now()
  const validation = JSON.parse(
    await run([
      "python3",
      "/opt/atlas/validate_archive.py",
      `atlas-z${candidate}.mbtiles`,
      "libraries.ndjson",
      String(candidate),
      String(dataset.physicalRecords),
    ])
  ) as unknown
  const validated = performance.now()
  await run([
    "pmtiles",
    "convert",
    `atlas-z${candidate}.mbtiles`,
    `atlas-z${candidate}.pmtiles`,
  ])
  await run(["pmtiles", "verify", `atlas-z${candidate}.pmtiles`])
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(
    resolve(artifactDirectory, `atlas-z${candidate}.pmtiles`)
  ))
    hash.update(chunk)
  await report(`build-z${candidate}`, {
    status: "passed",
    fullScale: dataset.fullScale,
    detailZoom: candidate,
    linuxImage: image,
    buildSeconds: (built - started) / 1000,
    validationSeconds: (validated - built) / 1000,
    totalSeconds: (performance.now() - started) / 1000,
    validation,
    archiveBytes: (
      await stat(resolve(artifactDirectory, `atlas-z${candidate}.pmtiles`))
    ).size,
    sha256: hash.digest("hex"),
  })
} catch (error) {
  await report(`build-z${candidate}`, {
    status: "failed",
    fullScale: dataset.fullScale,
    detailZoom: candidate,
    linuxImage: image,
    seconds: (performance.now() - started) / 1000,
    error: error instanceof Error ? error.message : String(error),
  })
  throw error
}
