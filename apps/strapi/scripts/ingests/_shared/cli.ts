/**
 * Command-line flags shared by dataset ingests.
 *
 *   --dry-run      Map records and report, without calling Strapi
 *   --limit=N      Stop after N records
 *   --log=path     Where to write the run log
 *
 * Each ingest adds its own flags on top (for example --state=NY).
 */

export type IngestArgs = Record<string, string>

export function parseArgs(argv = process.argv.slice(2)): IngestArgs {
  return Object.fromEntries(
    argv.map((a) => {
      const [k, ...v] = a.replace(/^--/, "").split("=")

      return [k, v.length > 0 ? v.join("=") : "true"]
    })
  )
}

export function flag(args: IngestArgs, name: string): boolean {
  return args[name] === "true"
}

export function limitOf(args: IngestArgs): number {
  if (!args.limit) return Infinity
  const limit = Number(args.limit)
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new Error("--limit must be a positive integer")

  return limit
}

export function concurrencyOf(args: IngestArgs): number {
  const concurrency =
    args.concurrency === undefined ? 1 : Number(args.concurrency)
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4)
    throw new Error("--concurrency must be an integer from 1 to 4")

  return concurrency
}

/** Comma-separated upper-case list, e.g. --state=NY,NJ → ["NY", "NJ"]. */
export function listOf(args: IngestArgs, name: string): string[] | null {
  const raw = args[name]
  if (!raw || raw === "true") return null

  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
}
