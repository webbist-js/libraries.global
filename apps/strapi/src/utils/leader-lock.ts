// Leader election for cron jobs when more than one Strapi instance runs.
//
// The lock is a Postgres transaction-scoped advisory lock taken inside a
// short-lived knex transaction that stays open for the job's duration: the
// lock and its release are then guaranteed to happen on the same pooled
// connection, and the release happens even if the job throws. On sqlite
// (tests, local scratch DBs) there is one instance by definition, so the
// job simply runs.
//
// Copied from `src/plugins/rewards/server/utils/leader-lock.ts`: this is
// app-level code (`src/api/drive`), which can't reach across the plugin
// boundary the way the rewards plugin's own cron job can.

const PG_CLIENTS = new Set(["pg", "postgres", "postgresql"])

// Arbitrary but fixed: the hourly drive lifecycle run.
export const DRIVE_LIFECYCLE_LOCK_KEY = 7_420_101

export type LeaderLockResult<R> = { ran: true; result: R } | { ran: false }

function isPostgres(strapi: any): boolean {
  return PG_CLIENTS.has(String(strapi.db?.dialect?.client ?? "").toLowerCase())
}

export async function withLeaderLock<R>(
  strapi: any,
  key: number,
  job: () => Promise<R>
): Promise<LeaderLockResult<R>> {
  if (!isPostgres(strapi)) return { ran: true, result: await job() }

  return strapi.db.connection.transaction(async (trx: any) => {
    const res = await trx.raw("SELECT pg_try_advisory_xact_lock(?) AS locked", [
      key,
    ])
    const row = Array.isArray(res) ? res[0] : res?.rows?.[0]
    if (!row?.locked) {
      strapi.log.debug(
        `[drives] Leader lock ${key} held elsewhere; skipping this run`
      )

      return { ran: false }
    }

    return { ran: true, result: await job() }
  })
}
