import {
  describeScopes,
  type DriveTag,
  DriveQueueStrip,
  ModerationQueue,
  type QueueState,
  SEGMENTS,
} from "@/components/moderation"
import { fetchArticleLocales } from "@/lib/article-editor-server"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { T } from "@/lib/design-tokens"
import { fetchModeration } from "@/lib/moderation-proxy"
import { Link } from "@/lib/navigation"
import { privateMetadata } from "@/lib/seo/metadata"

import { ModerationAccessUnavailable } from "./_components/ModerationAccessUnavailable"
import { ModerationHero } from "./_components/ModerationHero"
import {
  coversEverything,
  queuesOf,
  requireModerator,
} from "./_components/moderator"

export const metadata = privateMetadata("Moderation")

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? ""

export default async function ModerationQueuePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { user, scopes, accessUnknown } = await requireModerator(
    "/contribute/moderation"
  )
  if (accessUnknown)
    return (
      <ModerationAccessUnavailable
        title="Review *submissions*"
        path="/contribute/moderation"
      />
    )
  const [sp, locales, driveStatsRes] = await Promise.all([
    searchParams,
    fetchArticleLocales(),
    fetchModeration<{ data?: { drive: DriveTag; waiting: number }[] }>(
      user,
      "drive-stats"
    ),
  ])
  const driveStats = driveStatsRes.body?.data ?? []
  const localeNames = Object.fromEntries(locales.map((l) => [l.code, l.name]))

  const queues = queuesOf(scopes)
  // The language filter: every language when a scope is unrestricted,
  // otherwise the languages the scopes name.
  const scoped = [
    ...new Set(scopes.flatMap((s) => (s.locale ? [s.locale] : []))),
  ]
  const filterLocales = scopes.some((s) => s.locale === null)
    ? locales.map(({ code, name }) => ({ code, name }))
    : scoped.map((code) => ({
        code,
        name: localeNames[code] ?? code.toUpperCase(),
      }))

  const segment = first(sp.status)
  const queue = first(sp.queue)
  const locale = first(sp.locale)
  const q = first(sp.q).slice(0, 100)
  const drive = first(sp.drive)
  const page = Math.min(
    500,
    Math.max(1, Math.trunc(Number(first(sp.page))) || 1)
  )
  const state: QueueState = {
    segment: SEGMENTS.some((s) => s.id === segment)
      ? (segment as QueueState["segment"])
      : "pending",
    queue: (queues as string[]).includes(queue)
      ? (queue as QueueState["queue"])
      : "",
    locale: filterLocales.some((l) => l.code === locale) ? locale : "",
    q,
    drive: isDocumentIdParam(drive) ? drive : "",
    page,
  }

  return (
    <>
      <ModerationHero
        title="Review *submissions*"
        lead={`You review ${describeScopes(scopes, localeNames)}. Your own submissions never appear here.`}
      >
        {coversEverything(scopes) ? (
          <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
            <Link
              href="/contribute/moderation/suggestions"
              className="font-semibold underline-offset-2 hover:underline"
              style={{ color: T.accent.primary }}
            >
              Option suggestions →
            </Link>{" "}
            New facilities and services contributors asked for.
          </p>
        ) : null}
      </ModerationHero>
      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-6 px-4 pt-8 pb-16 sm:px-8">
        {!state.drive ? <DriveQueueStrip rows={driveStats} /> : null}
        <ModerationQueue
          state={state}
          queues={queues}
          locales={filterLocales}
          localeNames={localeNames}
        />
      </div>
    </>
  )
}
