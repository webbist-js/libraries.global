import type { ZodType } from "zod"

import { readJsonCapped } from "@/lib/bridge-params"

/** Reject unsupported media, oversized streams and invalid shapes before a bridge write. */
export async function readTypedJson<T>(
  req: Pick<Request, "headers" | "body">,
  maxBytes: number,
  schema: ZodType<T>
): Promise<{ ok: true; body: T } | { ok: false; status: 400 | 413 | 415 }> {
  if (
    req.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !==
    "application/json"
  )
    return { ok: false, status: 415 }
  const parsed = await readJsonCapped(req, maxBytes)
  if (!parsed.ok) return parsed
  const value = schema.safeParse(parsed.body)

  return value.success
    ? { ok: true, body: value.data }
    : { ok: false, status: 400 }
}
