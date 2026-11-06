import type { Pool } from "pg"

import type { JobRow } from "../analysis-jobs"

type Result = { rows: unknown[]; rowCount?: number }

const none = (): Result => ({ rows: [], rowCount: 0 })
const UNITS = { seconds: 1e3, minutes: 6e4, hours: 36e5, days: 864e5 }
const UPDATE =
  /^update api_jobs set (.+) where id=\$1 and state='pending'( and checked_at<now\(\)-interval '1 second')?( returning \*)?$/

function later(sql: string) {
  const m = /interval '(\d+) (minutes|hours|seconds|days)'/.exec(sql)

  return new Date(
    Date.now() +
      Number(m?.[1] ?? 0) * UNITS[(m?.[2] ?? "seconds") as keyof typeof UNITS]
  )
}

const column = (row: JobRow, name: string) =>
  (row as unknown as Record<string, unknown>)[name]

function value(expr: string, row: JobRow, params: unknown[]): unknown {
  expr = expr.trim()
  if (/^\$\d+$/.test(expr)) return params[Number(expr.slice(1)) - 1]
  if (expr.length > 1 && expr.startsWith("'") && expr.endsWith("'"))
    return expr.slice(1, -1)
  if (expr === "null") return null
  if (expr === "now()") return new Date()
  if (expr.startsWith("now()+interval")) return later(expr)
  const coalesce = /^coalesce\((\w+),(.+)\)$/.exec(expr)
  if (coalesce)
    return column(row, coalesce[1]!) ?? value(coalesce[2]!, row, params)
  if (/^\w+$/.test(expr)) return column(row, expr)
  throw new Error(`fake pool: unknown expression ${expr}`)
}

/** Split a SET list on the commas that are outside parentheses. */
function assignments(list: string) {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < list.length; i++) {
    if (list[i] === "(") depth++
    else if (list[i] === ")") depth--
    else if (list[i] === "," && depth === 0) {
      parts.push(list.slice(start, i))
      start = i + 1
    }
  }
  parts.push(list.slice(start))

  return parts
}

const copies = (rows: JobRow[]) => rows.map((r) => ({ ...r }))

function openCounts(rows: JobRow[], params: unknown[]): Result {
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

function insertJob(rows: JobRow[], s: string, params: unknown[]): Result {
  const [id, team_id, key_id, kind, operation, input_hash, input, credits] =
    params as [
      string,
      string,
      string,
      JobRow["kind"],
      string,
      string,
      string,
      number,
    ]
  if (
    rows.some(
      (r) =>
        r.team_id === team_id &&
        r.input_hash === input_hash &&
        r.state === "pending"
    )
  )
    return none()
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

const reusableRow = (r: JobRow) =>
  r.state === "pending" ||
  (r.state === "complete" &&
    r.result !== null &&
    r.result_expires_at! > new Date())

function selectJobs(
  rows: JobRow[],
  s: string,
  params: unknown[]
): Result | null {
  const sameInput = (r: JobRow) =>
    r.team_id === params[0] && r.input_hash === params[1]
  if (
    s.startsWith(
      "select * from api_jobs where team_id=$1 and input_hash=$2 and (state='pending'"
    )
  ) {
    const found = rows
      .filter((r) => sameInput(r) && reusableRow(r))
      .sort(
        (a, b) => Number(b.state === "pending") - Number(a.state === "pending")
      )

    return { rows: copies(found.slice(0, 1)) }
  }
  if (
    s.startsWith(
      "select * from api_jobs where team_id=$1 and input_hash=$2 and state='pending'"
    )
  )
    return {
      rows: copies(rows.filter((r) => sameInput(r) && r.state === "pending")),
    }
  if (s === "select * from api_jobs where id=$1")
    return { rows: copies(rows.filter((r) => r.id === params[0])) }
  if (s === "select * from api_jobs where id=$1 and team_id=$2")
    return {
      rows: copies(
        rows.filter((r) => r.id === params[0] && r.team_id === params[1])
      ),
    }
  if (
    s.startsWith(
      "select * from api_jobs where state='pending' and expires_at<=now()"
    )
  )
    return {
      rows: copies(
        rows.filter((r) => r.state === "pending" && r.expires_at <= new Date())
      ),
      rowCount: 0,
    }

  return null
}

function deleteJobs(
  rows: JobRow[],
  s: string,
  params: unknown[]
): Result | null {
  if (s.startsWith("delete from api_jobs where id=$1")) {
    const i = rows.findIndex((r) => r.id === params[0] && r.state === "pending")
    if (i !== -1) rows.splice(i, 1)

    return { rows: [], rowCount: i !== -1 ? 1 : 0 }
  }
  if (s.startsWith("update api_jobs set result=null where id in")) return none()
  if (s.startsWith("delete from api_jobs where id in")) return none()

  return null
}

function updateJob(
  rows: JobRow[],
  s: string,
  params: unknown[]
): Result | null {
  const update = UPDATE.exec(s)
  if (!update) return null
  const row = rows.find((r) => r.id === params[0] && r.state === "pending")
  if (!row || (update[2] && Date.now() - row.checked_at.getTime() < 1000))
    return none()
  const next: Record<string, unknown> = {}
  for (const assignment of assignments(update[1]!)) {
    const [col, ...rest] = assignment.split("=")
    next[col!.trim()] = value(rest.join("="), row, params)
  }
  if (typeof next.result === "string") next.result = JSON.parse(next.result)
  Object.assign(row, next)

  return { rows: [{ ...row }], rowCount: 1 }
}

/**
 * An in-memory stand-in for the `api_jobs` statements in analysis-jobs.ts,
 * so the job lifecycle can be tested without a database. It understands
 * exactly the SQL shapes that module sends and fails on anything else.
 */
export function fakeJobsPool() {
  const rows: JobRow[] = []
  async function query(sql: string, params: unknown[] = []) {
    const s = sql.replaceAll(/\s+/g, " ").trim()
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(s) || s.includes("pg_advisory"))
      return none()
    if (s.startsWith("select count(*) filter")) return openCounts(rows, params)
    if (s.startsWith("insert into api_jobs")) return insertJob(rows, s, params)
    const handled =
      selectJobs(rows, s, params) ??
      deleteJobs(rows, s, params) ??
      updateJob(rows, s, params)
    if (handled) return handled
    throw new Error(`fake pool: unsupported SQL ${s}`)
  }
  const pool = {
    query,
    connect: async () => ({ query, release: () => {} }),
  } as unknown as Pool

  return { pool, rows }
}
