import {
  appendSourceRecords,
  type LibrarySourceRecord,
} from "@repo/shared-data"

/** Convert legacy mapper output to the canonical source-record component before either API write. */
export function withLibrarySources<
  T extends {
    source?: string
    sourceUrl?: string
    sourceRecords?: LibrarySourceRecord[]
  },
>(data: T): T {
  if (!data.sourceRecords && !data.source && !data.sourceUrl) return data
  const { source, sourceUrl, ...canonical } = data
  const records = (data.sourceRecords ?? []).map((r) => ({
    ...r,
    role:
      r.role ??
      (r.dataset === source ? ("origin" as const) : ("reference" as const)),
    ...(!r.url && r.dataset === source && sourceUrl ? { url: sourceUrl } : {}),
  }))
  const legacy =
    source || sourceUrl
      ? [{ dataset: source, url: sourceUrl, role: "origin" as const }]
      : []
  const merged = records.some(
    (r) =>
      r.role === "origin" &&
      r.dataset === source &&
      (!sourceUrl || r.url === sourceUrl)
  )
    ? records
    : appendSourceRecords(records, legacy)
  const retrievedAt = new Date().toISOString().slice(0, 10)

  return {
    ...canonical,
    sourceRecords: merged.map((source) => ({
      ...source,
      retrievedAt: source.retrievedAt ?? retrievedAt,
    })),
  } as T
}
