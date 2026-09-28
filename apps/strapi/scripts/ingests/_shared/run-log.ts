import { writeFileSync } from "node:fs"

/**
 * One JSON log per ingest run: what was read (file, checksum), with which
 * flags, and what happened to every source record. Logs are git-ignored
 * (`ingest-log.json`, `*.ingest-log.json`) but keep the checksum, so a run can
 * be matched to the exact file it read.
 */

export type RunLogStatus =
  | "created"
  | "exists"
  | "skipped"
  | "error"
  | "dry-run"

export interface RunLogEntry {
  recordId: string
  name: string
  status: RunLogStatus
  documentId?: string
  slug?: string
  reason?: string
  warnings?: string[]
}

export interface RunLogMeta {
  dataset: string
  startedAt: string
  dryRun: boolean
  input: { url?: string; file: string; sha256: string }[]
  args: Record<string, string>
}

export class RunLog {
  readonly entries: RunLogEntry[] = []

  constructor(
    private readonly path: string,
    private readonly meta: RunLogMeta
  ) {}

  add(entry: RunLogEntry) {
    this.entries.push(entry)
  }

  counts(): Record<RunLogStatus, number> {
    const counts = {
      created: 0,
      exists: 0,
      skipped: 0,
      error: 0,
      "dry-run": 0,
    }
    for (const e of this.entries) counts[e.status]++

    return counts
  }

  save() {
    writeFileSync(
      this.path,
      JSON.stringify(
        {
          ...this.meta,
          finishedAt: new Date().toISOString(),
          counts: this.counts(),
          entries: this.entries,
        },
        null,
        2
      )
    )
  }
}
