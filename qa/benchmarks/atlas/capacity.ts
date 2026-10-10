import { execFile } from "node:child_process"
import { readdir, stat, statfs } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import {
  artifactDirectory,
  readReport,
  report,
  request,
  requireDisposable,
} from "./runtime.js"

const { resolve } = path

requireDisposable()
const execute = promisify(execFile)
const dataset = await readReport<{
  physicalRecords: number
  fullScale: boolean
}>("dataset")
const stats = await request<{ databaseSize: number; usedDatabaseSize: number }>(
  "/stats"
)
const disk = await statfs(artifactDirectory)
const files = await readdir(artifactDirectory)
const inputs = files.filter((f) => f.endsWith(".ndjson"))
const inputBytes = (
  await Promise.all(
    inputs.map(async (f) => (await stat(resolve(artifactDirectory, f))).size)
  )
).reduce((sum, n) => sum + n, 0)
const scale = 3000000 / dataset.physicalRecords
const dockerInfo = JSON.parse(
  (
    await execute("docker", ["info", "--format", "{{json .}}"], {
      maxBuffer: 1024 * 1024,
    })
  ).stdout
) as { NCPU: number; MemTotal: number; ServerVersion: string }
const containers = (
  await execute("docker", [
    "stats",
    "--no-stream",
    "--format",
    "{{.Name}} {{.MemUsage}} {{.CPUPerc}}",
  ])
).stdout
  .trim()
  .split("\n")
const available = disk.bavail * disk.bsize
const total = disk.blocks * disk.bsize
const minimumEstimate = (inputBytes + stats.usedDatabaseSize) * scale
const result = {
  measuredAt: new Date().toISOString(),
  physicalRecords: dataset.physicalRecords,
  fullScale: dataset.fullScale,
  measured: {
    inputBytes,
    searchDatabaseAllocatedBytes: stats.databaseSize,
    searchDatabaseUsedBytes: stats.usedDatabaseSize,
    availableDiskBytes: available,
    filesystemBytes: total,
    filesystemUsedFraction: 1 - disk.bfree / disk.blocks,
    docker: {
      cpus: dockerInfo.NCPU,
      memoryBytes: dockerInfo.MemTotal,
      version: dockerInfo.ServerVersion,
    },
    containers,
  },
  extrapolation: {
    targetRecords: 3000000,
    method:
      "linear from the measured synthetic corpus; estimate, not a three-million-record measurement",
    inputAndTwoLiveIndexesBytes: minimumEstimate,
    excludes: [
      "staging rebuild",
      "retained predecessor indexes",
      "MBTiles and PMTiles archives",
      "native build scratch",
      "journal/PostgreSQL",
    ],
  },
  fullRunFitsEstimatedFreeDisk: minimumEstimate < available - 12 * 1024 ** 3,
  gateA: "not-passed",
}
await report("capacity", result)
console.log(JSON.stringify(result, null, 2))
