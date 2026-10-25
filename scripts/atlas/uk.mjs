/** Finite local four-nation ingestion and Reach acceptance. Reuses existing services. */
import { spawn } from "node:child_process"
import { readFileSync, mkdirSync } from "node:fs"
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
const apply = args.apply === "true",
  stage = args.stage ?? "plan"
const countries = ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"]
const data = path.resolve(args.data ?? path.join(root, "apps/analysis/data"))
async function run(command, argv, cwd) {
  const child = spawn(command, argv, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048" },
  })
  const stop = () => child.kill("SIGTERM")
  process.once("SIGINT", stop)
  process.once("SIGTERM", stop)
  try {
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject)
      child.once("exit", resolve)
    })
    if (code !== 0) throw new Error(`UK ${stage} stage failed (${code})`)
  } finally {
    process.removeListener("SIGINT", stop)
    process.removeListener("SIGTERM", stop)
  }
}
async function main() {
  if (
    ![
      "plan",
      "prepare",
      "import",
      "networks",
      "backfill",
      "verify",
      "all",
    ].includes(stage)
  )
    throw new Error("Unknown stage")
  if (stage === "plan") {
    console.log(
      JSON.stringify(
        {
          countries,
          stages: ["prepare", "import", "networks", "backfill", "verify"],
          apply: false,
          populationYear: 2020,
          services:
            "Reuse local CMS, projection worker and native service. No database or application stack is created.",
        },
        null,
        2
      )
    )

    return
  }
  const env = parseEnv(
    readFileSync(path.join(root, "apps/strapi/.env"), "utf8")
  )
  if (
    apply &&
    (args.local !== "true" ||
      !["localhost", "127.0.0.1"].includes(
        new URL(env.STRAPI_URL ?? "http://127.0.0.1:1337").hostname
      ))
  )
    throw new Error("Apply requires --local and the local CMS")
  const cms = (...argv) =>
    run(
      process.execPath,
      ["--import", "tsx", ...argv],
      path.join(root, "apps/strapi")
    )
  const worker = (...argv) =>
    run(
      process.execPath,
      ["--import", "tsx", ...argv],
      path.join(root, "apps/sync-worker")
    )
  const selected = (name) => stage === name || stage === "all"
  if (selected("prepare"))
    await run(
      args.python ?? path.join(root, "apps/analysis/.venv/bin/python"),
      [
        path.join(root, "apps/analysis/prepare_uk.py"),
        "--root",
        data,
        ...(apply ? ["--apply"] : []),
      ],
      root
    )
  if (selected("import"))
    for (const country of countries) {
      const log = path.join(
        root,
        `apps/strapi/scripts/ingests/england/libraryon/.runs/uk-${country}.json`
      )
      await cms(
        "scripts/ingests/run.ts",
        "--dataset=libraryon",
        `--country=${country}`,
        `--log=${log}`,
        ...(apply ? ["--apply"] : []),
        ...(args.snapshot ? [`--snapshot=${path.resolve(args.snapshot)}`] : []),
        ...(args.refresh === "true" ? ["--refresh"] : [])
      )
      if (apply)
        await cms(
          "scripts/ingests/publish-run.ts",
          "--local",
          "--apply",
          `--run=${log}`
        )
    }
  if (selected("networks"))
    await cms(
      "scripts/ingests/uk/libraryon-networks.ts",
      "--local",
      ...(apply ? ["--apply"] : [])
    )
  if (selected("backfill")) {
    const started = Date.now()
    for (;;) {
      const response = await fetch(
        new URL("/api/atlas/state", env.STRAPI_URL ?? "http://127.0.0.1:1337"),
        {
          headers: {
            "x-service-secret": env.STRAPI_BRIDGE_SECRET,
            "x-atlas-token": env.ATLAS_SERVICE_TOKEN,
          },
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        }
      )
      const state = response.ok ? await response.json() : null
      if (
        state?.pendingProjection === 0 &&
        state.projectionRevision === state.indexedThrough
      )
        break
      if (Date.now() - started > 120000)
        throw new Error(
          "Wait for the existing Atlas projection worker to drain before analytical backfill"
        )
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
    for (const country of countries)
      await worker(
        "src/atlas/reach-backfill.ts",
        `--country=${country}`,
        ...(apply ? ["--apply", "--repair", "--retry-failed"] : [])
      )
    if (apply) await worker("src/atlas/analysis-worker.ts", "--once")
  }
  if (selected("verify") || (stage === "all" && apply)) {
    mkdirSync(path.join(data, "acceptance"), { recursive: true })
    for (const country of countries)
      await worker(
        "src/atlas/reach-backfill.ts",
        `--country=${country}`,
        "--verify",
        `--report=${path.join(data, "acceptance", `${country}-reach.json`)}`
      )
  }
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
