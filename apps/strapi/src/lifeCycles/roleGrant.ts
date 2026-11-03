import type { Core } from "@strapi/strapi"

import { ROLE_GRANT, syncDerivedRole } from "../utils/role-grants"

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

/** Re-derive display fields after a grant changes. Authority reads current grants directly. */
export async function handleRoleGrantEvent(
  strapi: any,
  event: LifecycleEvent,
  options: { extraUsers?: string[] } = {}
): Promise<void> {
  const users = new Set<string>(options.extraUsers)
  for (const row of asRows(event?.result)) {
    const id = userOf(row)
    if (id) users.add(id)
  }
  for (const baUserId of users) {
    try {
      await syncDerivedRole(strapi, baUserId)
    } catch (err) {
      strapi.log.error(
        `[role-grants] Derived role sync failed for ${baUserId}:`,
        err
      )
    }
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
    afterCreate: (event: LifecycleEvent) => handleRoleGrantEvent(strapi, event),
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
