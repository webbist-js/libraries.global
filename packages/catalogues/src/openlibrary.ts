import type { CatalogueHttp } from "./http"
import { isValidIsbn, toIsbn13 } from "./isbn"

interface OpenLibraryEdition {
  isbn_13?: string[]
  isbn_10?: string[]
}

/**
 * Other ISBNs of the same work, via Open Library. A library may hold the
 * paperback when you searched for the hardback. Returns ISBN-13s, input first.
 */
export async function findEditionIsbns(
  isbn: string,
  http: CatalogueHttp,
  limit = 10
): Promise<string[]> {
  const isbn13 = toIsbn13(isbn)
  const out = new Set<string>([isbn13])

  const book = await http.get(`https://openlibrary.org/isbn/${isbn13}.json`, {
    allowStatus: [404],
  })
  if (book.status === 404) return [...out]
  const works = book.json<{ works?: { key: string }[] }>().works ?? []
  const workKey = works[0]?.key
  if (!workKey) return [...out]

  const editions = await http.get(
    `https://openlibrary.org${workKey}/editions.json?limit=50`
  )
  for (const e of editions.json<{ entries?: OpenLibraryEdition[] }>().entries ??
    []) {
    for (const i of [...(e.isbn_13 ?? []), ...(e.isbn_10 ?? [])]) {
      if (out.size >= limit) break
      if (isValidIsbn(i)) out.add(toIsbn13(i))
    }
  }

  return [...out]
}
