import type { Core } from "@strapi/strapi"

export async function ensureNotificationIndexes(
  strapi: Core.Strapi
): Promise<void> {
  const db = strapi.db.connection
  if (!(await db.schema.hasTable("notifications"))) return
  if (
    !["pg", "postgres", "postgresql"].includes(String(strapi.db.dialect.client))
  )
    return
  await db.transaction(async (trx) => {
    await trx.raw("SET LOCAL lock_timeout = '5s'")
    await trx.raw(
      "CREATE INDEX IF NOT EXISTS notifications_inbox_idx ON notifications (ba_user_id, id DESC) WHERE in_app = true"
    )
    await trx.raw(
      "CREATE INDEX IF NOT EXISTS notifications_delivery_idx ON notifications (email_state, next_attempt_at, id) WHERE email_state = 'pending'"
    )
  })
}
