import { isSubmissionType } from "@repo/access"

const DOCUMENT_ID = /^[a-z0-9]{20,32}$/

export const isSubmissionTypeParam = (v: string) => isSubmissionType(v)
export const isDocumentIdParam = (v: string) => DOCUMENT_ID.test(v)

export async function readJsonCapped(
  req: Request,
  maxBytes: number
): Promise<{ ok: true; body: unknown } | { ok: false; status: 400 | 413 }> {
  const text = await req.text()
  if (new TextEncoder().encode(text).length > maxBytes)
    return { ok: false, status: 413 }
  try {
    return { ok: true, body: JSON.parse(text) }
  } catch {
    return { ok: false, status: 400 }
  }
}
