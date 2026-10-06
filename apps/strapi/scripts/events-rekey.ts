/**
 * Re-encrypts every Event Credential value (current and pending) under
 * EVENTS_CREDENTIAL_KEY, reading with EVENTS_CREDENTIAL_KEY_PREV as the
 * fallback. Rotation: set _PREV to the old key and the main var to the new
 * one, run this, then remove _PREV from Strapi and the worker.
 * Run: pnpm --filter @repo/strapi events:rekey
 */
import { compileStrapi, createStrapi } from "@strapi/strapi"

import {
  openValues,
  sealValues,
} from "../src/plugins/events/server/utils/credential-crypto"

async function main() {
  const app = await createStrapi(await compileStrapi()).load()
  const CRED = "plugin::events.event-credential"
  let after = 0
  let done = 0
  for (;;) {
    const rows = (await app.db.query(CRED).findMany({
      where: { id: { $gt: after } },
      orderBy: { id: "asc" },
      limit: 200,
      select: [
        "id",
        "documentId",
        "credentialsEncrypted",
        "pendingCredentialsEncrypted",
      ],
    })) as any[]
    if (rows.length === 0) break
    for (const r of rows) {
      const data: Record<string, string> = {}
      if (r.credentialsEncrypted && r.credentialsEncrypted !== "{}")
        data.credentialsEncrypted = sealValues(
          openValues(r.credentialsEncrypted, r.documentId, "current"),
          r.documentId,
          "current"
        )
      if (r.pendingCredentialsEncrypted)
        data.pendingCredentialsEncrypted = sealValues(
          openValues(r.pendingCredentialsEncrypted, r.documentId, "pending"),
          r.documentId,
          "pending"
        )
      if (Object.keys(data).length)
        await app.db.query(CRED).update({ where: { id: r.id }, data })
      done++
      after = r.id
    }
  }
  console.log(`[events:rekey] re-encrypted ${done} credentials`)
  await app.destroy()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
