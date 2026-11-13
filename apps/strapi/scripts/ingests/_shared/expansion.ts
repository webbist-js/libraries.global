import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { flag, type IngestArgs } from "./cli"
import { executeDirectoryIngest } from "./directory"
import { expansionCsv } from "./expansion-contract"
import { EXPANSION_FEEDS } from "./expansion-feeds"
import {
  applyExpansionReview,
  reviewTemplate,
  validateCandidates,
} from "./expansion-review"
import { assertIngestTarget } from "./target"
import { mapGraz } from "../austria/graz/map"
import { mapVienna } from "../austria/vienna/map"
import { mapBelgium } from "../belgium/fwb/map"
import { mapBrazil } from "../brazil/snbp-cadastro/map"
import { mapKenya } from "../kenya/alva/map"
import { mapLatvia } from "../latvia/kisc/map"
import { mapNetherlands } from "../netherlands/wikidata/map"
import { mapNewZealand } from "../new-zealand/wikidata/map"
import { mapSingapore } from "../singapore/nlb/map"
import { mapTaiwan } from "../taiwan/nlpi/map"

export const EXPANSION_MAPPERS = {
  "lv-kisc-libraries": mapLatvia,
  "tw-nlpi-libraries": mapTaiwan,
  "sg-nlb-libraries": mapSingapore,
  "be-fwb-libraries": mapBelgium,
  "at-vienna-libraries": mapVienna,
  "at-graz-libraries": mapGraz,
  "br-snbp-cadastro": mapBrazil,
  "nl-wikidata-libraries": mapNetherlands,
  "nz-wikidata-libraries": mapNewZealand,
  "ke-alva": mapKenya,
}

/** File-backed imports are deliberately separate from source acquisition. */
export async function runExpansion(args: IngestArgs) {
  const feed = EXPANSION_FEEDS.find((entry) => entry.key === args.dataset)
  if (!feed) throw new Error("Unknown expansion Dataset")
  if (flag(args, "apply") && flag(args, "dry-run"))
    throw new Error("Choose --apply or --dry-run")
  assertIngestTarget(args)
  if (args.snapshot || args.refresh)
    throw new Error(
      "Use --file with an immutable source export; snapshot/refresh are not supported"
    )
  if (
    !args.file ||
    !args["retrieved-at"] ||
    !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(args["retrieved-at"]) ||
    !Number.isFinite(Date.parse(args["retrieved-at"]))
  )
    throw new Error(
      "Supply --file=<publisher export> and --retrieved-at=<actual UTC ISO timestamp>"
    )
  if (Date.parse(args["retrieved-at"]) > Date.now())
    throw new Error("Retrieval date cannot be in the future")
  if ((flag(args, "apply") || flag(args, "check-cms")) && !args.review)
    throw new Error("CMS access requires --review=<completed review JSON>")
  const file = path.resolve(args.file)
  const bytes = readFileSync(file)
  const sha256 = createHash("sha256").update(bytes).digest("hex")
  const raw =
    feed.format === "xlsx"
      ? JSON.parse(
          execFileSync(
            // Operator-installed Python; fixed executable name and argv, no shell.
            // eslint-disable-next-line sonarjs/no-os-command-from-path
            "python3",
            [path.join(__dirname, "read-expansion-xlsx.py"), file],
            { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
          )
        )
      : feed.format === "csv"
        ? expansionCsv(bytes.toString("utf8"))
        : JSON.parse(bytes.toString("utf8"))
  const candidates = EXPANSION_MAPPERS[feed.key](raw)
  validateCandidates(candidates)
  const directory = path.resolve(__dirname, "..", feed.folder)
  const runs = path.join(directory, ".runs")
  mkdirSync(runs, { recursive: true })
  const prefix = path.join(runs, `${sha256.slice(0, 16)}`)
  if (!args.review) {
    // Never overwrite an operator's completed review on a repeated preparation.
    const plan = `${prefix}.candidates.json`
    writeFileSync(
      plan,
      JSON.stringify(
        {
          dataset: feed.key,
          source: {
            file,
            sha256,
            retrievedAt: args["retrieved-at"],
            url: feed.download,
          },
          coverage: feed.coverage,
          candidates,
        },
        null,
        2
      ),
      { mode: 0o600 }
    )
    const template = `${prefix}.review-template.json`
    try {
      writeFileSync(
        template,
        JSON.stringify(
          reviewTemplate(feed, candidates, sha256, args["retrieved-at"]),
          null,
          2
        ),
        { flag: "wx", mode: 0o600 }
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
    }
    console.log(
      JSON.stringify(
        {
          dataset: feed.key,
          candidates: candidates.length,
          plan,
          template,
          cmsChecked: false,
          created: 0,
        },
        null,
        2
      )
    )

    return
  }
  const reviewFile = path.resolve(args.review)
  const reviewBytes = readFileSync(reviewFile)
  const mapped = applyExpansionReview(
    feed,
    candidates,
    JSON.parse(reviewBytes.toString("utf8")),
    sha256,
    args["retrieved-at"]
  )

  return executeDirectoryIngest({
    args,
    directory,
    dataset: feed.key,
    sourceCount: candidates.length,
    retrievedAt: args["retrieved-at"],
    ...mapped,
    inputs: [
      { file, sha256, url: feed.download },
      {
        file: reviewFile,
        sha256: createHash("sha256").update(reviewBytes).digest("hex"),
      },
    ],
    details: {
      coverage: feed.coverage,
      sourceCandidates: candidates.length,
      coordinatePolicy: feed.pins
        ? "reviewed source points only"
        : "no coordinates",
      atlasReady: false,
    },
  })
}
