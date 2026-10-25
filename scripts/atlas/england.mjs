#!/usr/bin/env node
/** Reproducible local country acceptance. Services are started separately. */
import { spawn } from "node:child_process"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parseEnv } from "node:util"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=")

    return [key, value.join("=") || "true"]
  })
)
const stage = args.stage ?? "plan"
const apply = args.apply === "true"
const analysis = path.join(root, "apps/analysis")
const data = path.resolve(args.data ?? path.join(analysis, "data"))
const python = args.python ?? path.join(analysis, ".venv/bin/python")
const profilePath = path.resolve(
  args.profile ?? path.join(analysis, "profiles/england.json")
)
const profile = JSON.parse(readFileSync(profilePath, "utf8"))
if (profile.country !== "GB-ENG")
  throw new Error("The England acceptance command requires an England profile")
if (
  ![
    "plan",
    "controls",
    "prepare",
    "import",
    "backfill",
    "verify",
    "all",
  ].includes(stage)
)
  throw new Error("Unknown acceptance stage")
if (args.refresh === "true" && args.snapshot)
  throw new Error("Choose --refresh or --snapshot")

async function run(command, argv, workspace = root) {
  const child = spawn(command, argv, {
    cwd: workspace,
    stdio: "inherit",
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048" },
  })
  const stop = () => child.kill("SIGTERM")
  process.once("SIGINT", stop)
  process.once("SIGTERM", stop)
  try {
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject)
      child.once("exit", (code) => resolve(code))
    })
    if (code !== 0)
      throw new Error(
        `Acceptance stage failed: ${path.basename(command)} (exit ${code})`
      )
  } finally {
    process.removeListener("SIGINT", stop)
    process.removeListener("SIGTERM", stop)
  }
}
const worker = (...argv) =>
  run(
    process.execPath,
    ["--import", "tsx", ...argv],
    path.join(root, "apps/sync-worker")
  )
const cms = (...argv) =>
  run(
    process.execPath,
    ["--import", "tsx", ...argv],
    path.join(root, "apps/strapi")
  )
const prepare = (...argv) =>
  run(python, [
    path.join(analysis, "prepare.py"),
    ...argv,
    "--root",
    data,
    "--profile",
    profilePath,
    ...(apply ? ["--apply"] : []),
  ])

async function main() {
  if (stage === "plan") {
    console.log(
      JSON.stringify(
        {
          country: profile.country,
          stages: ["controls", "prepare", "import", "backfill", "verify"],
          network: profile.network.url,
          surface: profile.population.url,
          populationYear: profile.population.year,
          prerequisites:
            "Existing local CMS, Atlas projection worker and private analysis service; prepared Python environment. No extra database or app stack is created.",
          storage:
            "Versioned routing graphs and windowed rasters on the analysis volume; bounded compressed result cache; PostgreSQL metadata only.",
        },
        null,
        2
      )
    )

    return
  }
  if (apply) {
    if (args.local !== "true")
      throw new Error("--apply requires --local for this test-import command")
    for (const workspace of ["apps/strapi", "apps/sync-worker"]) {
      const env = {
        ...parseEnv(readFileSync(path.join(root, workspace, ".env"), "utf8")),
        ...process.env,
      }
      for (const key of [
        "STRAPI_URL",
        "ATLAS_DATABASE_URL",
        "ANALYSIS_SERVICE_URL",
      ]) {
        if (
          env[key] &&
          !["localhost", "127.0.0.1", "[::1]"].includes(
            new URL(env[key]).hostname
          )
        )
          throw new Error(`Local ${key} required`)
      }
      if (
        env.DATABASE_HOST &&
        !["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(
          env.DATABASE_HOST
        )
      )
        throw new Error("Local CMS database required")
    }
  }
  if (["controls", "all"].includes(stage)) {
    await worker(
      "src/atlas/ingest-population.ts",
      ...(apply ? [] : ["--dry-run"])
    )
    await worker(
      "src/atlas/ingest-population.ts",
      "--local",
      ...(apply ? [] : ["--dry-run"])
    )
  }
  if (["prepare", "all"].includes(stage) && !args.profile) {
    await run(python, [
      path.join(analysis, "prepare_uk.py"),
      "--root",
      data,
      ...(apply ? ["--apply"] : []),
    ])
  }
  if (["prepare", "all"].includes(stage) && args.profile) {
    await prepare("network", ...(args.refresh === "true" ? ["--refresh"] : []))
    await prepare("population")
    if (apply) {
      const manifests = readdirSync(path.join(data, "releases"))
        .map((name) => path.join(data, "releases", name, "network.json"))
        .filter(
          (file) =>
            existsSync(file) &&
            JSON.parse(readFileSync(file, "utf8")).id.startsWith(
              `osm-${profile.id}-`
            )
        )
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
      if (!manifests[0]) throw new Error("Prepared graph manifest is missing")
      await prepare(
        "activate",
        "--graph-manifest",
        manifests[0],
        "--population-manifest",
        path.join(
          data,
          "releases",
          `${profile.population.id}-${profile.id}-v1/population.json`
        )
      )
    }
  }
  if (["import", "all"].includes(stage)) {
    await cms(
      "scripts/ingests/run.ts",
      "--dataset=libraryon",
      "--country=GB-ENG",
      apply ? "--apply" : "--dry-run",
      "--check-cms",
      ...(args.refresh === "true" ? ["--refresh"] : []),
      ...(args.snapshot ? [`--snapshot=${path.resolve(args.snapshot)}`] : [])
    )
    if (apply) {
      const runs = path.join(
        root,
        "apps/strapi/scripts/ingests/england/libraryon/.runs"
      )
      const newest = readdirSync(runs)
        .filter((file) => file.endsWith("ingest-log.json"))
        .sort()
        .at(-1)
      if (!newest) throw new Error("Import checkpoint is missing")
      await cms(
        "scripts/ingests/publish-run.ts",
        "--local",
        "--apply",
        `--run=${path.join(runs, newest)}`
      )
    }
  }
  if (["backfill", "all"].includes(stage)) {
    await worker(
      "src/atlas/reach-backfill.ts",
      "--country=GB-ENG",
      ...(apply ? ["--apply", "--repair", "--retry-failed"] : [])
    )
    if (apply) await worker("src/atlas/analysis-worker.ts", "--once")
  }
  if (stage === "verify" || (apply && ["backfill", "all"].includes(stage)))
    await worker(
      "src/atlas/reach-backfill.ts",
      "--country=GB-ENG",
      "--verify",
      `--report=${args.report ? path.resolve(args.report) : path.join(data, "acceptance/england-reach.json")}`
    )
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
