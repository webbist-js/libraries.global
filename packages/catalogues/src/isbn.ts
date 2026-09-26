/** Strips hyphens/spaces and upper-cases a trailing x. Does not validate. */
export function cleanIsbn(raw: string): string {
  return raw.replaceAll(/[\s-]/g, "").toUpperCase()
}

function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false
  let sum = 0
  for (let i = 0; i < 10; i++) {
    const ch = isbn[i]!
    sum += (ch === "X" ? 10 : Number(ch)) * (10 - i)
  }

  return sum % 11 === 0
}

function isValidIsbn13(isbn: string): boolean {
  if (!/^97[89]\d{10}$/.test(isbn)) return false
  let sum = 0
  for (let i = 0; i < 13; i++) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3)

  return sum % 10 === 0
}

export function isValidIsbn(raw: string): boolean {
  const isbn = cleanIsbn(raw)

  return isbn.length === 10 ? isValidIsbn10(isbn) : isValidIsbn13(isbn)
}

/** Converts a valid ISBN-10 to ISBN-13; returns ISBN-13 input unchanged. */
export function toIsbn13(raw: string): string {
  const isbn = cleanIsbn(raw)
  if (isbn.length === 13) return isbn
  const core = `978${isbn.slice(0, 9)}`
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3)

  return `${core}${(10 - (sum % 10)) % 10}`
}
