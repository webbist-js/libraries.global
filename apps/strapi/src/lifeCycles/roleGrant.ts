import type { Core } from "@strapi/strapi"

import {
  notifySessionInvalidated,
  ROLE_GRANT,
  syncDerivedRole,
} from "../utils/role-grants"

/** Distinct `baUserId`s on an event's result, a single row or many. */
function usersOf(result: unknown): string[] {
  const rows = Array.isArray(result) ? result : [result]
  const ids = new Set<string>()
  for (const row of rows) {
    const id = (row as { baUserId?: unknown } | null)?.baUserId
    if (typeof id === "string" && id.length > 0) ids.add(id)
  }

  return [...ids]
}

/**
 * After any write to a Role Grant, re-derive the holder's `contributorRole`
 * and ask the Next app to drop its cached session. Admin edits in the
 * Content Manager therefore take effect at once. A failed sync is logged,
 * never thrown: the grant write itself has already happened.
 */
export async function handleRoleGrantEvent(
  strapi: any,
  event: { result?: unknown }
): Promise<void> {
  for (const baUserId of usersOf(event?.result)) {
    try {
      await syncDerivedRole(strapi, baUserId)
    } catch (err) {
      strapi.log.error(
        `[role-grants] Derived role sync failed for ${baUserId}:`,
        err
      )
    }
    notifySessionInvalidated(strapi, baUserId).catch(() => {})
  }
}

export function roleGrantLifecycles(strapi: any) {
  return {
    models: [ROLE_GRANT],
    afterCreate: (event: { result?: unknown }) =>
      handleRoleGrantEvent(strapi, event),
    afterUpdate: (event: { result?: unknown }) =>
      handleRoleGrantEvent(strapi, event),
    afterDelete: (event: { result?: unknown }) =>
      handleRoleGrantEvent(strapi, event),
  }
}

export const registerRoleGrantSubscriber = ({
  strapi,
}: {
  strapi: Core.Strapi
}) => {
  strapi.db.lifecycles.subscribe(roleGrantLifecycles(strapi) as any)
}
