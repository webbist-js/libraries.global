import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"

import { flag, parseArgs } from "./_shared/cli"

async function run() {
  const env = path.resolve(__dirname, "../../.env")
  if (existsSync(env)) process.loadEnvFile(env)
  const args = parseArgs()
  if (flag(args, "help") || !args.dataset) {
    console.log(
      "pnpm ingest --dataset=kirjastot-fi|wikidata|au-public-libraries|slq-directory|fr-culture-libraries|nkp-cadr|mx-sic-rnbp|ca-statcan-odcaf|imls-pls|libraryon|gazetteer [--dry-run] [--check-cms] [--apply] [--limit=N]\nDefaults to a dry run. Wikidata: --country=SE|NO|DK. Finland: --year=2025. New adapters support --concurrency=1..4 (default 1). Use --refresh or --snapshot=directory. Legacy adapters keep their own dataset flags."
    )

    return
  }
  if (flag(args, "apply") && flag(args, "dry-run"))
    throw new Error("Choose --apply or --dry-run")
  if (args.dataset === "kirjastot-fi") {
    const { runFinland } = await import("./finland/kirjastot-fi/ingest")
    await runFinland(args)

    return
  }
  if (args.dataset === "wikidata") {
    const { runNordic } = await import("./nordics/ingest")
    await runNordic(args)

    return
  }
  if (["au-public-libraries", "slq-directory"].includes(args.dataset)) {
    const { runAustralia } = await import("./australia/libraries/ingest")
    await runAustralia(args)

    return
  }
  if (args.dataset === "fr-culture-libraries") {
    const { runFrance } = await import("./france/culture/ingest")
    await runFrance(args)

    return
  }
  if (args.dataset === "nkp-cadr") {
    const { runCzechia } = await import("./czechia/nkp-cadr/ingest")
    await runCzechia(args)

    return
  }
  if (args.dataset === "mx-sic-rnbp") {
    const { runMexico } = await import("./mexico/sic-rnbp/ingest")
    await runMexico(args)

    return
  }
  if (args.dataset === "ca-statcan-odcaf") {
    const { runCanada } = await import("./canada/statcan-odcaf/ingest")
    await runCanada(args)

    return
  }
  if (args.dataset === "libraryon" && args.legacy !== "true") {
    const { runEnglandLibraryOn } = await import("./england/libraryon/ingest")
    await runEnglandLibraryOn(args)

    return
  }
  const legacy = {
    "imls-pls": "usa/imls-pls/ingest.ts",
    libraryon: "../libraryon-ingest.ts",
    gazetteer: "gazetteer/import.ts",
  }
  const script = legacy[args.dataset]
  if (!script) throw new Error(`Unknown Dataset ${args.dataset}`)
  if (flag(args, "check-cms"))
    throw new Error(
      "Legacy adapters use their own CMS checks; see the Dataset README"
    )
  const forwarded = Object.entries(args)
    .filter(([key]) => !["dataset", "apply", "dry-run"].includes(key))
    .map(([key, value]) => `--${key}=${value}`)
  if (!flag(args, "apply")) forwarded.push("--dry-run")
  const child = spawn(
    process.execPath,
    [...process.execArgv, path.resolve(__dirname, script), ...forwarded],
    { stdio: "inherit", env: process.env }
  )
  process.exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject)
    child.on("exit", (code) => resolve(code ?? 1))
  })
}

run().catch((error) => {
  console.error((error as Error).message)
  process.exitCode = 1
})
