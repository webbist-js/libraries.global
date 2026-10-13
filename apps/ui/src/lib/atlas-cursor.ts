import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"

import { ATLAS_LIMITS, type AtlasCursorPayload } from "@repo/shared-data"

const secret = (): string => {
  const value = process.env.ATLAS_CURSOR_SECRET
  if (!value || value.length < 32)
    throw new Error("ATLAS_CURSOR_SECRET must have at least 32 characters")

  return value
}

export function signAtlasCursor(payload: AtlasCursorPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url")

  return `${encoded}.${createHmac("sha256", secret()).update(encoded).digest("base64url")}`
}
export class AtlasCursorExpired extends Error {}
export function readAtlasCursor(
  cursor: string,
  expected: Pick<
    AtlasCursorPayload,
    "fingerprint" | "queryEpoch" | "dictionaryVersion" | "sort"
  >,
  now: Date
): AtlasCursorPayload {
  if (cursor.length > ATLAS_LIMITS.cursorBytes)
    throw new AtlasCursorExpired("Cursor expired; refresh the list")
  const [encoded, signed, extra] = cursor.split(".")
  if (
    !encoded ||
    !signed ||
    extra !== undefined ||
    !/^[A-Za-z0-9_-]+$/.test(encoded) ||
    !/^[A-Za-z0-9_-]{43}$/.test(signed)
  )
    throw new AtlasCursorExpired("Invalid cursor")
  const supplied = Buffer.from(signed, "base64url"),
    mac = createHmac("sha256", secret()).update(encoded).digest()
  if (supplied.length !== mac.length || !timingSafeEqual(supplied, mac))
    throw new AtlasCursorExpired("Invalid cursor")
  let payload: AtlasCursorPayload
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
  } catch {
    throw new AtlasCursorExpired("Invalid cursor")
  }
  if (
    payload.schemaVersion !== 1 ||
    Object.entries(expected).some(
      ([key, value]) => payload[key as keyof AtlasCursorPayload] !== value
    ) ||
    !Number.isSafeInteger(payload.lastId) ||
    payload.lastId < 1 ||
    typeof payload.lastKey !== "string" ||
    !Number.isFinite(Date.parse(payload.evaluatedAt)) ||
    !Number.isFinite(Date.parse(payload.expiresAt)) ||
    Date.parse(payload.expiresAt) <= now.getTime() ||
    Date.parse(payload.expiresAt) >
      now.getTime() + ATLAS_LIMITS.cursorSeconds * 1000
  )
    throw new AtlasCursorExpired("Cursor expired; refresh the list")

  return payload
}
