/**
 * Minimal RFC 4180 CSV reader for dataset ingests: quoted fields, escaped
 * quotes ("") and newlines inside quotes. Returns one object per row keyed by
 * the header row.
 */

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]

    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        field += c
      }
      continue
    }

    switch (c) {
      case '"':
        quoted = true

        break

      case ",":
        row.push(field)
        field = ""

        break

      case "\n":
      case "\r":
        if (c === "\r" && text[i + 1] === "\n") i++
        row.push(field)
        rows.push(row)
        row = []
        field = ""

        break

      default:
        field += c
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  const [header, ...body] = rows
  if (!header) return []
  const keys = header.map((h) =>
    (h.codePointAt(0) === 0xfe_ff ? h.slice(1) : h).trim()
  )

  return body
    .filter((r) => r.some((v) => v !== ""))
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""])))
}
