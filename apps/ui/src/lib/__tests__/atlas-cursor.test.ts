import { atlasPlaceSortKey, type AtlasCursorPayload } from "@repo/shared-data"
import { afterEach, expect, it, vi } from "vitest"

import { readAtlasCursor, signAtlasCursor } from "../atlas-cursor"

afterEach(() => vi.unstubAllEnvs())
it("round trips maximum Unicode place keys and rejects scope changes, tampering and expiry", () => {
  vi.stubEnv("ATLAS_CURSOR_SECRET", "test-secret-".repeat(4))
  const now = new Date("2026-10-08T12:00:00Z")
  const payload: AtlasCursorPayload = {
    schemaVersion: 1,
    queryEpoch: "epoch",
    dictionaryVersion: "dict",
    fingerprint: "scope",
    sort: "place",
    lastId: 1,
    lastKey: atlasPlaceSortKey("🌍".repeat(255), "𐐀".repeat(255)),
    evaluatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 600000).toISOString(),
  }
  const cursor = signAtlasCursor(payload)
  expect(readAtlasCursor(cursor, payload, now)).toEqual(payload)
  expect(() =>
    readAtlasCursor(cursor, { ...payload, fingerprint: "other" }, now)
  ).toThrow("expired")
  expect(() => readAtlasCursor(cursor + "x", payload, now)).toThrow("Invalid")
  expect(() =>
    readAtlasCursor(cursor, payload, new Date(now.getTime() + 600001))
  ).toThrow("expired")
})
