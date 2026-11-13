import { createHash } from "node:crypto"

import type { LibraryCreateData } from "../../strapi-client"

export interface ExpansionCandidate {
  recordId: string
  name: string
  sourceUrl: string
  regionHint?: string
  areaHint?: string
  data: Partial<LibraryCreateData>
  point?: { lat: number; lng: number }
  warnings: string[]
}

export interface ExpansionFeed {
  key: string
  country: string
  folder: string
  format: "csv" | "json" | "xlsx"
  download: string
  coverage: string
  pins: boolean
}

export function identity(parts: unknown[]) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        parts.map((v) =>
          String(v ?? "")
            .normalize("NFC")
            .trim()
        )
      )
    )
    .digest("hex")
    .slice(0, 24)
}

/** A publisher object whose fields are checked where they are read. */
export type SourceObject = Record<string, unknown>

export function object(value: unknown): SourceObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a source object")

  return value as SourceObject
}

export function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Expected a complete source array")

  return value
}

/** Reads an optional nested source field, like `value?.a?.b`. */
export function at(value: unknown, ...path: (string | number)[]): unknown {
  let current = value
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined
    current = (current as Record<string | number, unknown>)[key]
  }

  return current
}

/** A source string field, or "" when it is missing. */
export function sourceString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value)
}

/** Missing columns are schema drift, not an empty/partially successful import. */
export function columns(row: Record<string, unknown>, names: string[]) {
  for (const name of names)
    if (!Object.hasOwn(row, name))
      throw new Error(`Missing source column ${name}`)
}

/** Strict CSV for new feeds; preserve quoted commas/newlines and reject truncated files. */
export function expansionCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false
  text = text.replace(/^\uFEFF/, "")
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        quoted = false
        closed = true
      } else field += c
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(field)
      field = ""
      closed = false
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++
        if (row.some((v) => v !== "")) rows.push(row)
        row = []
      }
    } else if (c === '"' && !field && !closed) quoted = true
    else {
      if (closed || c === '"') throw new Error("Malformed CSV quoting")
      field += c
    }
  }
  if (quoted) throw new Error("Truncated quoted CSV field")
  if (field || row.length || closed) {
    row.push(field)
    rows.push(row)
  }
  const [header, ...body] = rows
  if (!header || new Set(header).size !== header.length)
    throw new Error("Missing or duplicate CSV headers")

  return body.map((values) => {
    if (values.length !== header.length)
      throw new Error("CSV row width changed")

    return Object.fromEntries(header.map((key, i) => [key, values[i]]))
  })
}
