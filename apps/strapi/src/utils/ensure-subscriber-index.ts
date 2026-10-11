import type { Core } from "@strapi/strapi"

/** Bootstrap runs after schema sync, unlike user migrations on a fresh database. */
export async function ensureSubscriberIndex(
  strapi: Core.Strapi
): Promise<void> {
  const db = strapi.db.connection
  if (!(await db.schema.hasTable("subscribers"))) return
  await db.transaction(async (trx) => {
    await trx("subscribers").whereNull("type").update({
      type: "newsletter",
      source: "legacy",
      state: "pending_confirmation",
    })
    await trx("subscribers")
      .whereNull("state")
      .update({ state: "pending_confirmation" })
    await trx("subscribers")
      .where({ type: "newsletter", state: "active" })
      .whereNull("confirmed_at")
      .update({ state: "pending_confirmation" })
    // Legacy rows keep their evidence and are excluded from sendable exports.
    // Never delete ambiguous duplicates: retain them for an operator to inspect.
    const dialect = String(strapi.db.dialect.client)
    if (["pg", "postgres", "postgresql"].includes(dialect)) {
      await trx.raw("SET LOCAL lock_timeout = '5s'")
      await trx.raw(
        "CREATE UNIQUE INDEX IF NOT EXISTS subscribers_email_type_unique ON subscribers (lower(trim(email)), type) WHERE consented_at IS NOT NULL"
      )
    }
  })
}
