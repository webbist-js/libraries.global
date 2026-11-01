import path from "node:path"

import { IRISH_FEEDS } from "./feeds"
import { ambiguousIrishNames, mapIrishLibrary } from "./map"
import { readIrishFeed } from "./source"
import { flag, type IngestArgs } from "../../_shared/cli"
import { executeDirectoryIngest } from "../../_shared/directory"
import { directoryText } from "../../_shared/directory-fields"
import { JsonSources } from "../../_shared/json-source"
import { assertIngestTarget } from "../../_shared/target"

export async function runIreland(args: IngestArgs) {
  assertIngestTarget(args)
  const feed = IRISH_FEEDS.find((item) => item.key === args.dataset)
  if (!feed) throw new Error("Select a registered Irish council Dataset")
  const directory = path.join(__dirname, feed.key)
  const sources = new JsonSources(
    args.snapshot ?? path.join(directory, ".cache"),
    { offline: Boolean(args.snapshot), refresh: flag(args, "refresh") }
  )
  const snapshot = await readIrishFeed(sources, feed)
  const ambiguous = ambiguousIrishNames(snapshot.rows)
  const libraries = [],
    skipped = []
  for (const row of snapshot.rows) {
    const mapped = ambiguous.has(
      directoryText(row.attributes.Name)?.toLocaleLowerCase("en-IE") ?? ""
    )
      ? "Duplicate branch name under different source IDs; editorial reconciliation required"
      : mapIrishLibrary(row, feed)
    if (typeof mapped === "string")
      skipped.push({
        recordId: String(row.attributes[feed.idField]),
        name: String(row.attributes.Name ?? ""),
        reason: mapped,
      })
    else libraries.push(mapped)
  }

  return executeDirectoryIngest({
    args,
    directory,
    dataset: feed.key,
    inputs: sources.inputs,
    retrievedAt: snapshot.retrievedAt,
    sourceCount: snapshot.rows.length,
    libraries,
    skipped,
    details: {
      coverage: `${feed.publisher} feed only; not a national directory`,
      catalogueModified: snapshot.metadataModified,
      nationalCoverage: false,
      atlasReady: false,
    },
  })
}
