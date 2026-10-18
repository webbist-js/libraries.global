import { NextResponse } from "next/server"

import { rejectOversizedRequest } from "./upload-quota"

/** Buffer only a bounded stream, then parse multipart and require exactly one file. */
export async function readUploadFile(
  req: Request,
  field: "file" | "files",
  maxFileBytes: number,
  timeoutMs = 15000
): Promise<{ ok: true; file: File } | { ok: false; response: NextResponse }> {
  const failure = (error: string, status = 400) => ({
    ok: false as const,
    response: NextResponse.json({ error }, { status }),
  })
  const oversized = rejectOversizedRequest(req, maxFileBytes)
  if (oversized) return { ok: false, response: oversized }
  const contentType = req.headers.get("content-type") ?? ""
  if (!/^multipart\/form-data\s*;\s*boundary=/i.test(contentType) || !req.body)
    return failure("Expected one image in multipart form data")
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    reader.cancel().catch(() => {})
  }, timeoutMs)
  try {
    for (;;) {
      const result = await reader.read()
      if (timedOut) return failure("Upload timed out", 408)
      if (result.done) break
      total += result.value.byteLength
      if (total > maxFileBytes + 64 * 1024) {
        await reader.cancel()

        return failure("Upload body too large", 413)
      }
      chunks.push(result.value)
    }
  } catch {
    return failure("Invalid upload body")
  } finally {
    clearTimeout(timer)
    reader.releaseLock()
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    const bounded = new Request(req.url, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: bytes,
    })
    const entries = [...(await bounded.formData()).entries()]
    const entry = entries[0]
    if (
      entries.length !== 1 ||
      !entry ||
      entry[0] !== field ||
      !(entry[1] instanceof File)
    )
      return failure("Expected exactly one image file")
    const file = entry[1]
    if (file.size < 1) return failure("Image is empty")
    if (file.size > maxFileBytes) return failure("File too large", 413)

    return { ok: true, file }
  } catch {
    return failure("Invalid multipart form data")
  }
}
