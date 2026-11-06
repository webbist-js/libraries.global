import type { Pool } from "pg"

import type { JobRow } from "../analysis-jobs"

/**
 * An in-memory stand-in for the `api_jobs` statements in analysis-jobs.ts,
 * so the job lifecycle can be tested without a database. It understands
 * exactly the SQL shapes that module sends and fails on anything else.
 */
export function fakeJobsPool() {
  const rows: JobRow[] = []
  const later = (sql: string) => {
    const m = /interval '(\d+) (minutes|hours|seconds|days)'/.exec(sql)
    const unit = { seconds: 1e3, minutes: 6e4, hours: 36e5, days: 864e5 }

    return new Date(
      Date.now() +
        Number(m?.[1] ?? 0) * unit[(m?.[2] ?? "seconds") as keyof typeof unit]
    )
  }
  const value = (expr: string, row: JobRow, params: unknown[]): unknown => {
    expr = expr.trim()
    if (/^\$\d+$/.test(expr)) return params[Number(expr.slice(1)) - 1]
    if (/^'.*'$/.test(expr)) return expr.slice(1, -1)
    if (expr === "null") return null
    if (expr === "now()") return new Date()
    if (expr.startsWith("now()+interval")) return later(expr)
    const coalesce = /^coalesce\((\w+),(.+)\)$/.exec(expr)
    if (coalesce)
      return (row as any)[coalesce[1]!] ?? value(coalesce[2]!, row, params)
    if (/^\w+$/.test(expr)) return (row as any)[expr]
    throw new Error(`fake pool: unknown expression ${expr}`)
  }
  async function query(sql: string, params: unknown[] = []) {
    const s = sql.replaceAll(/\s+/g, " ").trim()
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(s) || s.includes("pg_advisory"))
      return { rows: [], rowCount: 0 }
    if (s.startsWith("select count(*) filter")) {
      const open = rows.filter(
        (r) => r.state === "pending" && r.expires_at > new Date()
      )

      return {
        rows: [
          {
            team: String(open.filter((r) => r.team_id === params[0]).length),
            total: String(open.length),
          },
        ],
      }
    }
    if (s.startsWith("insert into api_jobs")) {
      const [id, team_id, key_id, kind, operation, input_hash, input, credits] =
        params as any[]
      if (
        rows.some(
          (r) =>
            r.team_id === team_id &&
            r.input_hash === input_hash &&
            r.state === "pending"
        )
      )
        return { rows: [], rowCount: 0 }
      const row: JobRow = {
        id,
        team_id,
        key_id,
        kind,
        operation,
        input_hash,
        input: JSON.parse(input),
        credits,
        spent: null,
        state: "pending",
        charge: "reserved",
        cached: false,
        error: null,
        result: null,
        result_bytes: null,
        created_at: new Date(),
        checked_at: new Date(),
        completed_at: null,
        expires_at: later(s),
        result_expires_at: null,
      }
      rows.push(row)

      return { rows: [{ ...row }], rowCount: 1 }
    }
    if (
      s.startsWith(
        "select * from api_jobs where team_id=$1 and input_hash=$2 and (state='pending'"
      )
    ) {
      const found = rows
        .filter(
          (r) =>
            r.team_id === params[0] &&
            r.input_hash === params[1] &&
            (r.state === "pending" ||
              (r.state === "complete" &&
                r.result !== null &&
                r.result_expires_at! > new Date()))
        )
        .sort(
          (a, b) =>
            Number(b.state === "pending") - Number(a.state === "pending")
        )

      return { rows: found.slice(0, 1).map((r) => ({ ...r })) }
    }
    if (
      s.startsWith(
        "select * from api_jobs where team_id=$1 and input_hash=$2 and state='pending'"
      )
    )
      return {
        rows: rows
          .filter(
            (r) =>
              r.team_id === params[0] &&
              r.input_hash === params[1] &&
              r.state === "pending"
          )
          .map((r) => ({ ...r })),
      }
    if (s === "select * from api_jobs where id=$1")
      return {
        rows: rows.filter((r) => r.id === params[0]).map((r) => ({ ...r })),
      }
    if (s === "select * from api_jobs where id=$1 and team_id=$2")
      return {
        rows: rows
          .filter((r) => r.id === params[0] && r.team_id === params[1])
          .map((r) => ({ ...r })),
      }
    if (
      s.startsWith(
        "select * from api_jobs where state='pending' and expires_at<=now()"
      )
    )
      return {
        rows: rows
          .filter((r) => r.state === "pending" && r.expires_at <= new Date())
          .map((r) => ({ ...r })),
        rowCount: 0,
      }
    if (s.startsWith("delete from api_jobs where id=$1")) {
      const i = rows.findIndex(
        (r) => r.id === params[0] && r.state === "pending"
      )
      if (i !== -1) rows.splice(i, 1)

      return { rows: [], rowCount: i !== -1 ? 1 : 0 }
    }
    if (s.startsWith("update api_jobs set result=null where id in"))
      return { rows: [], rowCount: 0 }
    if (s.startsWith("delete from api_jobs where id in"))
      return { rows: [], rowCount: 0 }
    const update =
      /^update api_jobs set (.+) where id=\$1 and state='pending'( and checked_at<now\(\)-interval '1 second')?( returning \*)?$/.exec(
        s
      )
    if (update) {
      const row = rows.find((r) => r.id === params[0] && r.state === "pending")
      if (!row || (update[2] && Date.now() - row.checked_at.getTime() < 1000))
        return { rows: [], rowCount: 0 }
      const next: Record<string, unknown> = {}
      for (const assignment of update[1]!.split(/,(?![^(]*\))/)) {
        const [col, ...rest] = assignment.split("=")
        next[col!.trim()] = value(rest.join("="), row, params)
      }
      if (typeof next.result === "string") next.result = JSON.parse(next.result)
      Object.assign(row, next)

      return { rows: [{ ...row }], rowCount: 1 }
    }
    throw new Error(`fake pool: unsupported SQL ${s}`)
  }
  const pool = {
    query,
    connect: async () => ({ query, release: () => {} }),
  } as unknown as Pool

  return { pool, rows }
}
