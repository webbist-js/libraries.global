import { randomBytes, randomUUID } from "node:crypto"
import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import {
  parseNationFromRef,
  parseRegionSlugFromRef,
  type LibraryOnRecord,
} from "../../field-mapper"
import { flag, parseArgs } from "../_shared/cli"
import { ingestDatabase } from "../_shared/population"
import { slugify } from "../_shared/text"

export function libraryOnNetwork(ref: string) {
  const nation = parseNationFromRef(ref),
    authority = parseRegionSlugFromRef(ref)
  if (
    !nation ||
    !authority ||
    !/^[a-z0-9-]{1,100}$/.test(authority) ||
    !ref.startsWith("gb:")
  )
    return null
  // LibraryOn's NI refs historically use counties. Libraries NI is one service.
  const key =
    nation.countrySlug === "northern-ireland" ? "libraries-ni" : authority
  const codes: Record<string, string> = {
    england: "GB-ENG",
    wales: "GB-WLS",
    scotland: "GB-SCT",
    "northern-ireland": "GB-NIR",
  }

  return {
    sourceKey: `libraryon:${nation.countrySlug}:${key}`,
    slug: `${nation.countrySlug}-${key}`,
    name:
      key === "libraries-ni"
        ? "Libraries NI"
        : `${key
            .split("-")
            .map((word) => word[0]!.toUpperCase() + word.slice(1))
            .join(" ")} Library Service`,
    countryCode: codes[nation.countrySlug],
  }
}

async function main() {
  process.loadEnvFile(path.resolve(__dirname, "../../../.env"))
  const args = parseArgs(),
    apply = flag(args, "apply")
  const host = new URL(process.env.STRAPI_URL ?? "http://127.0.0.1:1337")
  if (
    !flag(args, "local") ||
    !["localhost", "127.0.0.1"].includes(host.hostname)
  )
    throw new Error("Explicit --local CMS required")
  const snapshot = JSON.parse(
    readFileSync(
      args.file ??
        path.resolve(__dirname, "../england/libraryon/.cache/libraries.json"),
      "utf8"
    )
  )
  const records: LibraryOnRecord[] = Array.isArray(snapshot)
    ? snapshot
    : snapshot.data
  if (!Array.isArray(records) || records.length > 10000)
    throw new Error("Invalid LibraryOn snapshot")
  const { StrapiClient } = await import("../../strapi-client")
  const client = new StrapiClient(),
    db = ingestDatabase()
  const report = {
    dryRun: !apply,
    networksCreated: 0,
    membershipsAdded: 0,
    existingMemberships: 0,
    conflicts: [] as string[],
    missingLibraries: 0,
  }
  try {
    const batchId = randomUUID()
    const identities = await client.librariesBySourceRecord("libraryon")
    const countries = await client.findAll("countries", {
      fields: ["iso2"],
      status: "draft",
    })
    const networks = await client.findAll("library-networks")
    for (const record of records) {
      const proposed = libraryOnNetwork(record.attributes.ref ?? "")
      if (!proposed || (args.country && proposed.countryCode !== args.country))
        continue
      const documentId = identities.get(String(record.id))
      if (!documentId) {
        report.missingLibraries++
        continue
      }
      let network = networks.find(
        (item) => item.sourceKey === proposed.sourceKey
      )
      if (!network) {
        const country = countries.find(
          (item) => item.iso2 === proposed.countryCode
        )
        if (!country) throw new Error(`Missing ${proposed.countryCode}`)
        if (
          !(await db("countries")
            .where({
              document_id: country.documentId,
              iso_2: proposed.countryCode,
            })
            .first())
        )
          throw new Error("REST/database ownership mismatch")
        if (!apply) continue
        network = (
          await client.post<{
            data: { documentId: string; sourceKey?: string }
          }>("/library-networks", {
            data: {
              name: proposed.name,
              slug: slugify(proposed.slug),
              kind: "library_service",
              sourceKey: proposed.sourceKey,
              sourceUrl: "https://libraryon.org",
              lastVerifiedAt: new Date().toISOString(),
              countries: { connect: [{ documentId: country.documentId }] },
            },
          })
        ).data
        networks.push(network!)
        report.networksCreated++
      }
      if (!network) continue
      await db.transaction(async (trx) => {
        // Add the relation to every locale/publication version. Content facts,
        // timestamps and unpublished editorial changes remain untouched.
        await trx.raw("SELECT pg_advisory_xact_lock(7420125)")
        const owner = await trx("library_networks")
          .where({ document_id: network!.documentId })
          .first()
        if (!owner) throw new Error("REST/database network mismatch")
        const versions = await trx("libraries")
          .where({ document_id: documentId })
          .select("id", "locale", "published_at", "entity_ref")
          .forUpdate()
        for (const version of versions) {
          const links = await trx("libraries_networks_lnk as l")
            .join("library_networks as n", "n.id", "l.library_network_id")
            .where("l.library_id", version.id)
            .select("n.id", "n.kind", "n.document_id")
          if (
            links.some(
              (link: { id: number; kind: string; document_id: string }) =>
                link.id === owner.id
            )
          ) {
            report.existingMemberships++
            continue
          }
          if (
            links.some(
              (link: { id: number; kind: string; document_id: string }) =>
                link.kind === "library_service"
            )
          ) {
            report.conflicts.push(documentId)
            continue
          }
          if (apply) {
            await trx("libraries_networks_lnk").insert({
              library_id: version.id,
              library_network_id: owner.id,
              library_network_ord: links.length + 1,
            })
            const now = new Date()
            await trx("library_changes").insert({
              document_id: randomBytes(12).toString("hex"),
              batch_id: batchId,
              library_document_id: documentId,
              entity_ref: version.entity_ref,
              content_locale: version.locale,
              version_status: version.published_at ? "published" : "draft",
              action: "update",
              field: "networks",
              previous: JSON.stringify(
                links
                  .map(
                    (link: { id: number; kind: string; document_id: string }) =>
                      link.document_id
                  )
                  .sort()
              ),
              next: JSON.stringify(
                [
                  ...links.map(
                    (link: { id: number; kind: string; document_id: string }) =>
                      link.document_id
                  ),
                  network!.documentId,
                ].sort()
              ),
              source: "import",
              actor_kind: "system",
              actor_name: "LibraryOn network ingest",
              changed_at: now,
              created_at: now,
              updated_at: now,
              published_at: now,
            })
            report.membershipsAdded++
          }
        }
        if (apply)
          await trx("atlas_outbox").insert({
            kind: "document",
            entity_id: documentId,
            payload: JSON.stringify({}),
          })
      })
    }
    const directory = path.resolve(__dirname, ".runs")
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      path.join(directory, "networks-latest.json"),
      JSON.stringify(report, null, 2)
    )
    console.log(JSON.stringify(report))
  } finally {
    await db.destroy()
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
