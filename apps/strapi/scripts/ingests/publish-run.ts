import { readFileSync } from "node:fs"
import path from "node:path"

import { flag, parseArgs } from "./_shared/cli"

/** Local acceptance only. Publish exactly the new drafts in one successful run. */
async function main() {
  process.loadEnvFile(path.resolve(__dirname, "../../.env"))
  const args = parseArgs()
  if (!flag(args, "local") || !args.run)
    throw new Error("--local and --run=ingest-log.json are required")
  const base = new URL(process.env.STRAPI_URL ?? "http://127.0.0.1:1337")
  if (!["localhost", "127.0.0.1"].includes(base.hostname))
    throw new Error("Local CMS required")
  const run = JSON.parse(readFileSync(args.run, "utf8"))
  if (
    run.dryRun !== false ||
    !Array.isArray(run.entries) ||
    run.entries.length > 10000 ||
    run.entries.some((row) => row.status === "error")
  )
    throw new Error("A successful apply run is required")
  const created = run.entries.filter((row) => row.status === "created")
  const { StrapiClient } = await import("../strapi-client")
  const client = new StrapiClient()
  let published = 0,
    existing = 0
  for (const row of created) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(row.documentId))
      throw new Error("Invalid document identity")
    const live = await client.findAll("libraries", {
      filters: { documentId: { $eq: row.documentId } },
      status: "published",
      fields: ["slug"],
    })
    if (live.length) {
      existing++
      continue
    }
    const { data: draft } = await client.get<{
      data: {
        slug: string
        entityRef: string
        updatedAt: string
        createdAt: string
        sourceRecords?: { dataset: string; recordId: string }[]
      }
    }>(`/libraries/${row.documentId}`, {
      status: "draft",
      populate: "sourceRecords",
    })
    if (
      draft.slug !== row.slug ||
      !draft.entityRef ||
      !draft.sourceRecords?.some(
        (source) =>
          source.dataset === run.dataset && source.recordId === row.recordId
      ) ||
      Date.parse(draft.updatedAt) - Date.parse(draft.createdAt) > 5000
    )
      throw new Error(
        `Draft ${row.documentId} changed after import; publication requires review`
      )
    if (flag(args, "apply")) {
      await client.put(
        `/libraries/${row.documentId}?status=published&locale=en`,
        { data: {} }
      )
      const after = await client.findAll("libraries", {
        filters: { documentId: { $eq: row.documentId } },
        status: "published",
        fields: ["slug", "entityRef"],
      })
      if (
        after.length !== 1 ||
        after[0]!.slug !== draft.slug ||
        after[0]!.entityRef !== draft.entityRef
      )
        throw new Error("Publication verification failed")
      published++
    }
  }
  console.log(
    JSON.stringify({
      dryRun: !flag(args, "apply"),
      selected: created.length,
      published,
      alreadyPublished: existing,
    })
  )
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
