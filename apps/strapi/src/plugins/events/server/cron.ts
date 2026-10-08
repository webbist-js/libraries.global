import {
  EVENT_PROVIDERS,
  type EventProviderKey,
  FEED_TEST_COPY,
  type FeedTestCode,
} from "@repo/shared-data"

import { recordCredentialEvent } from "./utils/credential-events"
import { notifyOtherClaimants } from "./utils/feed-access"

const CRED = "plugin::events.event-credential"

/** Feeds the worker auto-paused and nobody has been told about yet. */
export async function handleAutoPaused(
  strapi: any,
  deps: { notify?: typeof notifyOtherClaimants } = {}
): Promise<{ handled: number }> {
  const notify = deps.notify ?? notifyOtherClaimants
  const rows = (await strapi.documents(CRED).findMany({
    filters: {
      status: "paused",
      pausedReason: "sync_failures",
      autoPauseNotifiedAt: { $null: true },
    },
    fields: ["documentId", "provider", "lastErrorCode"],
    populate: { libraries: { fields: ["documentId", "name", "slug"] } },
    limit: 200,
  })) as any[]
  for (const row of rows) {
    const libraryIds = (row.libraries ?? []).map((l: any) => l.documentId)
    await strapi.documents(CRED).update({
      documentId: row.documentId,
      data: { autoPauseNotifiedAt: new Date().toISOString() },
    })
    await recordCredentialEvent(strapi, {
      credentialDocumentId: row.documentId,
      provider: row.provider,
      libraryDocumentIds: libraryIds,
      action: "auto_paused",
      actor: "system",
      resultCode: row.lastErrorCode ?? undefined,
    })
    await strapi
      .plugin("events")
      .service("credentials")
      .syncLibraryFeedFlags(libraryIds)
    const label =
      EVENT_PROVIDERS[row.provider as EventProviderKey]?.label ?? "event"
    const why =
      FEED_TEST_COPY[(row.lastErrorCode ?? "provider_error") as FeedTestCode]
    await notify(strapi, libraryIds, null, {
      subject: `Your library's ${label} feed stopped working`,
      text: `The ${label} feed for ${row.libraries?.[0]?.name ?? "your library"} stopped working and has been paused. ${why} Replace its details to restart it: ${process.env.APP_PUBLIC_URL ?? ""}${row.libraries?.[0]?.slug ? `/staff/${row.libraries[0].slug}/events` : "/staff"}`,
    })
  }

  return { handled: rows.length }
}

/** OAuth connections never finished: drop them after an hour. */
export async function purgeOAuthDrafts(
  strapi: any,
  now = new Date()
): Promise<{ deleted: number }> {
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const rows = (await strapi.documents(CRED).findMany({
    filters: { status: "draft", createdAt: { $lt: cutoff } },
    fields: ["documentId"],
    limit: 500,
  })) as any[]
  for (const r of rows)
    await strapi.documents(CRED).delete({ documentId: r.documentId })

  return { deleted: rows.length }
}
