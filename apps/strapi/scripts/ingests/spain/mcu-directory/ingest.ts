import path from "node:path"

import { mapSpanishLibrary, type SpanishLibrary } from "./map"
import { flag, type IngestArgs } from "../../_shared/cli"
import { executeDirectoryIngest } from "../../_shared/directory"
import { JsonSources } from "../../_shared/json-source"

const EXPORT_URL =
  "https://directoriobibliotecas.mcu.es/DescargaFicheros/datos_completos.json"

export async function runSpain(args: IngestArgs) {
  const sources = new JsonSources(
    args.snapshot ?? path.join(__dirname, ".cache"),
    { offline: Boolean(args.snapshot), refresh: flag(args, "refresh") }
  )

  const snapshot = await sources.read<{ bibliotecas: SpanishLibrary[] }>(
    "libraries",
    EXPORT_URL,
    { bytes: true, checksum: true },
    async () => {
      const response = await fetch(EXPORT_URL, {
        signal: AbortSignal.timeout(60000),
      })
      if (!response.ok) {
        throw new Error(`Spanish MCU directory HTTP ${response.status}`)
      }

      return response.json()
    }
  )

  const rawData = snapshot.data
  if (!rawData.bibliotecas || !Array.isArray(rawData.bibliotecas)) {
    throw new Error(
      "Unexpected Spanish directory structure: missing bibliotecas array"
    )
  }

  const records = rawData.bibliotecas
  console.log(`Found ${records.length} records from Spanish MCU directory`)
  if (records.length < 1000) {
    throw new Error(`Spanish directory coverage ${records.length} is too low`)
  }

  const libraries = []
  const skipped = []
  const typeCounts: Record<string, number> = {}

  for (const record of records) {
    const mapped = mapSpanishLibrary(record)
    if (typeof mapped === "string") {
      skipped.push({
        recordId: record.NIDEN || "",
        name: record.Nombre || "",
        reason: mapped,
      })
    } else {
      libraries.push(mapped)
      typeCounts[mapped.data.libraryType!] =
        (typeCounts[mapped.data.libraryType!] || 0) + 1
    }
  }

  return executeDirectoryIngest({
    args,
    directory: __dirname,
    dataset: "es-mcu-libraries",
    inputs: sources.inputs,
    retrievedAt: snapshot.retrievedAt,
    sourceCount: records.length,
    libraries,
    skipped,
    details: {
      coverage:
        "Spanish public, university, specialized and cultural libraries (16 regions, 50 provinces)",
      typeCounts,
      coordinatesIncluded: libraries.filter((l) => l.data.location).length,
    },
  })
}
