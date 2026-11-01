import { flag, type IngestArgs } from "./cli"

const loopback = (host: string) =>
  ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(host)

/** New adapters require an explicit target before touching a CMS or database. */
export function assertIngestTarget(args: IngestArgs) {
  if (!flag(args, "apply") && !flag(args, "check-cms")) return
  const local = flag(args, "local")
  const production = flag(args, "production")
  if (local === production)
    throw new Error("Select exactly one of --local or --production")
  const cms = new URL(process.env.STRAPI_URL ?? "http://127.0.0.1:1337")
  const databaseHost = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL).hostname
    : (process.env.DATABASE_HOST ?? "127.0.0.1")
  if (local && (!loopback(cms.hostname) || !loopback(databaseHost)))
    throw new Error("--local requires loopback CMS and database targets")
  if (production && (!process.env.STRAPI_URL || loopback(cms.hostname)))
    throw new Error("--production requires an explicit non-local STRAPI_URL")
}
