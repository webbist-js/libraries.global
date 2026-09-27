import { isSubmissionType } from "@repo/access"

/** The longest documentId accepted. Strapi v5 makes them 24 characters. */
export const MAX_ID_LENGTH = 32

/**
 * Strapi v5 documentIds, `/^[a-z0-9]{20,32}$/`: the same rule as Strapi's
 * `utils/library-export.ts` and content-moderation's `isDocumentId`.
 */
export const DOCUMENT_ID_PATTERN = new RegExp(`^[a-z0-9]{20,${MAX_ID_LENGTH}}$`)

export const isSubmissionTypeParam = (v: string) => isSubmissionType(v)
export const isDocumentIdParam = (v: string) => DOCUMENT_ID_PATTERN.test(v)

/**
 * The body as text, counting bytes as they arrive. Null once more than
 * `maxBytes` have been read; the rest of the body is never read.
 */
async function readTextCapped(
  req: Request,
  maxBytes: number
): Promise<string | null> {
  if (!req.body) return ""
  const reader = req.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return text + decoder.decode()
    bytes += value.byteLength
    if (bytes > maxBytes) {
      await reader.cancel().catch(() => {})

      return null
    }
    text += decoder.decode(value, { stream: true })
  }
}

/**
 * The request's JSON body, reading at most `maxBytes` of it. 413 when the
 * declared Content-Length or the bytes actually read pass the cap; 400 when
 * it isn't JSON.
 */
export async function readJsonCapped(
  req: Request,
  maxBytes: number
): Promise<{ ok: true; body: unknown } | { ok: false; status: 400 | 413 }> {
  if (Number(req.headers.get("content-length") ?? 0) > maxBytes)
    return { ok: false, status: 413 }
  const text = await readTextCapped(req, maxBytes)
  if (text === null) return { ok: false, status: 413 }
  try {
    return { ok: true, body: JSON.parse(text) }
  } catch {
    return { ok: false, status: 400 }
  }
}
