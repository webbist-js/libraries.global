/** Public provenance in the existing library.source-record component. */
export interface LibrarySourceRecord {
  dataset?: string | null
  recordId?: string | null
  retrievedAt?: string | null
  url?: string | null
  label?: string | null
  role?: "origin" | "reference" | null
  fields?: string[] | null
  submissionDocumentId?: string | null
}

export function librarySourceKey(
  records: readonly LibrarySourceRecord[] | null | undefined
): string | null {
  return (
    records?.find((record) => record.role === "origin" && record.dataset)
      ?.dataset ?? null
  )
}

export function publicSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null
  try {
    const url = new URL(value.trim())

    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}

/** Contributor references cannot modify importer identity or existing citations. */
export function submittedSourceRecords(value: unknown): LibrarySourceRecord[] {
  if (!Array.isArray(value)) return []

  return value.slice(0, 20).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return []
    const record = raw as Record<string, unknown>
    const url = publicSourceUrl(record.url)
    const label =
      typeof record.label === "string" ? record.label.trim().slice(0, 255) : ""
    if (!url) return []
    const fields = Array.isArray(record.fields)
      ? [
          ...new Set(
            record.fields.filter(
              (f): f is string =>
                typeof f === "string" && /^[a-z][a-zA-Z0-9]{0,63}$/.test(f)
            )
          ),
        ].slice(0, 50)
      : []

    return [
      {
        url,
        ...(label ? { label } : {}),
        role: "reference" as const,
        ...(fields.length ? { fields } : {}),
      },
    ]
  })
}

/** Keep original IDs/URLs; only append genuinely new public references. */
export function appendSourceRecords(
  existing: readonly LibrarySourceRecord[] | null | undefined,
  additions: readonly LibrarySourceRecord[]
): LibrarySourceRecord[] {
  const result: LibrarySourceRecord[] = (existing ?? []).map((record) => {
    const {
      dataset,
      recordId,
      retrievedAt,
      url,
      label,
      role,
      fields,
      submissionDocumentId,
    } = record

    return {
      dataset,
      recordId,
      retrievedAt,
      url,
      label,
      role,
      fields,
      submissionDocumentId,
    }
  })
  for (const record of additions) {
    if (
      !result.some(
        (r) =>
          r.url === record.url &&
          (r.dataset ?? null) === (record.dataset ?? null) &&
          (r.recordId ?? null) === (record.recordId ?? null) &&
          JSON.stringify(r.fields ?? []) === JSON.stringify(record.fields ?? [])
      )
    )
      result.push(record)
  }

  return result
}
