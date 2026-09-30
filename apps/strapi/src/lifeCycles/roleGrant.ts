import type { Core } from "@strapi/strapi"

import {
  notifySessionInvalidated,
  ROLE_GRANT,
  syncDerivedRole,
} from "../utils/role-grants"

type Row = { baUserId?: unknown; source?: unknown } | null

type LifecycleEvent = {
  result?: unknown
  params?: { where?: unknown; data?: Record<string, unknown> }
  state?: Record<string, unknown>
}

const asRows = (result: unknown): Row[] =>
  (Array.isArray(result) ? result : [result]) as Row[]

const userOf = (row: Row): string | null =>
  typeof row?.baUserId === "string" && row.baUserId.length > 0
    ? row.baUserId
    : null

/**
 * After any write to a Role Grant, re-derive the holder's `contributorRole`
 * and ask the Next app to drop its cached session. Admin edits in the
 * Content Manager therefore take effect at once. A failed sync is logged,
 * never thrown: the grant write itself has already happened.
 *
 * `extraUsers` are re-synced too (the previous holder of a grant whose
 * `baUserId` an admin changed). With `quietMigration`, rows created by the
 * boot-time migration are synced without a notification, so a backfill
 * never fires one request per profile at boot.
 */
export async function handleRoleGrantEvent(
  strapi: any,
  event: LifecycleEvent,
  options: { extraUsers?: string[]; quietMigration?: boolean } = {}
): Promise<void> {
  const notify = new Map<string, boolean>()
  for (const row of asRows(event?.result)) {
    const id = userOf(row)
    if (!id) continue
    const loud = !(options.quietMigration && row?.source === "migration")
    notify.set(id, (notify.get(id) ?? false) || loud)
  }
  for (const id of options.extraUsers ?? []) notify.set(id, true)

  for (const [baUserId, shouldNotify] of notify) {
    try {
      await syncDerivedRole(strapi, baUserId)
    } catch (err) {
      strapi.log.error(
        `[role-grants] Derived role sync failed for ${baUserId}:`,
        err
      )
    }
    if (shouldNotify) notifySessionInvalidated(strapi, baUserId).catch(() => {})
  }
}

const PREVIOUS_USERS = "roleGrantPreviousUsers"

/**
 * Before an update that sets `baUserId`, remember who held the grant, so
 * `afterUpdate` can re-derive the old holder's role as well. Lifecycles see
 * only the query's `where`, so this reads through `db.query`.
 */
async function rememberPreviousHolders(strapi: any, event: LifecycleEvent) {
  const data = event?.params?.data
  if (!data || !("baUserId" in data) || !event.params?.where) return
  try {
    const rows = (await strapi.db.query(ROLE_GRANT).findMany({
      where: event.params.where,
      select: ["baUserId"],
    })) as Row[]
    const users = rows.map(userOf).filter((id): id is string => !!id)
    if (event.state) event.state[PREVIOUS_USERS] = users
  } catch (err) {
    strapi.log.warn("[role-grants] Previous holder lookup failed:", err)
  }
}

export function roleGrantLifecycles(strapi: any) {
  return {
    models: [ROLE_GRANT],
    beforeUpdate: (event: LifecycleEvent) =>
      rememberPreviousHolders(strapi, event),
    afterCreate: (event: LifecycleEvent) =>
      handleRoleGrantEvent(strapi, event, { quietMigration: true }),
    afterUpdate: (event: LifecycleEvent) =>
      handleRoleGrantEvent(strapi, event, {
        extraUsers: (event?.state?.[PREVIOUS_USERS] as string[]) ?? [],
      }),
    afterDelete: (event: LifecycleEvent) => handleRoleGrantEvent(strapi, event),
  }
}

export const registerRoleGrantSubscriber = ({
  strapi,
}: {
  strapi: Core.Strapi
}) => {
  strapi.db.lifecycles.subscribe(roleGrantLifecycles(strapi) as any)
}
