// https://docs.strapi.io/dev-docs/configurations/cron
import type { Core } from "@strapi/strapi"

import { runNetworkFulfilment } from "../src/plugins/access/server/services/network-fulfilment"
import { reviewRoundView } from "../src/plugins/content-moderation/server/utils/suggestion-rounds"
import {
  handleAutoPaused,
  purgeOAuthDrafts,
} from "../src/plugins/events/server/cron"
import { refreshEventSearch } from "../src/utils/event-search-refresh"
import {
  DRIVE_LIFECYCLE_LOCK_KEY,
  withLeaderLock,
} from "../src/utils/leader-lock"
import { ingestLocalPopulation } from "../src/utils/local-population-ingest"
import { refreshDueOpeningSchedules } from "../src/utils/opening-schedule-refresh"
import { ingestPopulation } from "../src/utils/population-ingest"
import { resyncExpiredRoleGrants } from "../src/utils/role-grants"

const DRIVE_UID = "api::drive.drive"

// Grants that expire fire no lifecycle: re-derive the role of anyone whose
// grant expired in the last two days (the bridge already ignores them).
const resyncExpiredRoleGrantsJob = {
  task: async ({ strapi }: { strapi: any }) => {
    try {
      const { users } = await resyncExpiredRoleGrants(strapi)
      strapi.log.info(`[role-grants] Re-derived roles for ${users} users`)
    } catch (err) {
      strapi.log.warn("[role-grants] Expired grant resync failed:", err)
    }
  },
  options: {
    rule: "0 4 * * *",
  },
}

const eventFeedsJob = {
  task: async ({ strapi }: { strapi: any }) => {
    try {
      const { handled } = await handleAutoPaused(strapi)
      const { deleted } = await purgeOAuthDrafts(strapi)
      if (handled || deleted)
        strapi.log.info(
          `[events] auto-paused handled ${handled}, OAuth drafts purged ${deleted}`
        )
    } catch (err) {
      strapi.log.warn("[events] feed housekeeping failed:", err)
    }
  },
  options: { rule: "*/15 * * * *" },
}

// Opens scheduled drives whose start has arrived, closes open ones at goal
// or past their end date, and snapshots every other open drive once a day.
// Under the same Postgres advisory-lock pattern as the rewards plugin's
// weekly snapshot, so two Strapi instances never race the same drive.
const driveLifecycleJob = {
  task: async ({ strapi }: { strapi: any }) => {
    try {
      await withLeaderLock(strapi, DRIVE_LIFECYCLE_LOCK_KEY, async () => {
        const { opened, closed, held } = await strapi
          .service(DRIVE_UID)
          .runLifecycle(new Date())
        if (opened.length || closed.length || held.length)
          strapi.log.info(
            `[drives] lifecycle: opened ${opened.length}, closed ${closed.length}, held ${held.length}`
          )
      })
    } catch (err) {
      strapi.log.warn("[drives] lifecycle run failed:", err)
    }
  },
  options: { rule: "7 * * * *" },
}

export default {
  networkFulfilment: {
    task: ({ strapi }: { strapi: Core.Strapi }) =>
      withLeaderLock(strapi, 7_420_102, () =>
        runNetworkFulfilment(strapi)
      ).catch((error) =>
        strapi.log.warn("[networks] Access fulfilment will retry", error)
      ),
    options: { rule: "*/10 * * * * *", tz: "Etc/UTC" },
  },
  eventSearch: {
    task: ({ strapi }: { strapi: Core.Strapi }) =>
      refreshEventSearch(strapi).catch(() =>
        strapi.log.warn(
          "[events] Search refresh failed; the watermark was retained for retry"
        )
      ),
    options: { rule: "* * * * *", tz: "Etc/UTC" },
  },
  suggestionReviewRounds: {
    task: async ({ strapi }: { strapi: any }) => {
      try {
        await reviewRoundView(strapi, false)
      } catch {
        strapi.log.error(
          "[suggestions] Review-round cutoff failed; requests will retry it."
        )
      }
    },
    options: { rule: "* * * * *", tz: "Etc/UTC" },
  },
  openingSchedules: {
    task: ({ strapi }: { strapi: any }) =>
      refreshDueOpeningSchedules(strapi).catch((error) =>
        strapi.log.warn("[hours] Due schedule refresh failed", error)
      ),
    options: { rule: "* * * * *" },
  },
  notificationAnnouncements: {
    task: async ({ strapi }: { strapi: any }) => {
      try {
        await strapi.service("api::notification.notification").announcements()
      } catch {
        strapi.log.warn("[notifications] Announcement job failed")
      }
    },
    options: { rule: "*/5 * * * *", tz: "Etc/UTC" },
  },
  notificationRetention: {
    task: async ({ strapi }: { strapi: any }) => {
      try {
        await strapi.service("api::notification.notification").purge()
      } catch {
        strapi.log.warn("[notifications] Retention job failed")
      }
    },
    options: { rule: "30 3 * * *", tz: "Etc/UTC" },
  },
  weeklyCommunityReport: {
    task: async ({ strapi }: { strapi: any }) => {
      try {
        await strapi.service("api::notification.notification").weeklyReport()
      } catch {
        strapi.log.warn("[email] Weekly community report failed")
      }
    },
    options: { rule: "5 9 * * 1", tz: "Etc/UTC" },
  },
  followedLibraryUpdates: {
    task: async ({ strapi }: { strapi: any }) => {
      try {
        await strapi
          .service("api::notification.notification")
          .followedLibraryUpdates()
      } catch {
        strapi.log.warn("[notifications] Followed-library updates failed")
      }
    },
    options: { rule: "17 * * * *", tz: "Etc/UTC" },
  },
  notificationDelivery: {
    task: async ({ strapi }: { strapi: any }) => {
      try {
        await strapi.service("api::notification.notification").deliver()
      } catch {
        strapi.log.warn("[email] Notification worker failed")
      }
    },
    options: { rule: "* * * * *", tz: "Etc/UTC" },
  },
  weeklyDigest: {
    task: async ({ strapi }: { strapi: any }) => {
      try {
        await strapi.service("api::notification.notification").weeklyDigest()
      } catch {
        strapi.log.warn("[email] Weekly digest failed")
      }
    },
    options: { rule: "0 9 * * 1", tz: "Etc/UTC" },
  },
  population: {
    task: async ({ strapi }: { strapi: any }) => {
      if (process.env.POPULATION_SYNC_ENABLED !== "true") return
      try {
        const report = await ingestPopulation(strapi)
        await ingestLocalPopulation(strapi)
        strapi.log.info(
          `[population] Imported ${report.observations} country observations for ${report.year}`
        )
      } catch (error) {
        strapi.log.error(
          "[population] Import failed; previous observations retained",
          error
        )
      }
    },
    options: { rule: "23 3 * * 0" },
  },
  resyncExpiredRoleGrants: resyncExpiredRoleGrantsJob,
  eventFeeds: eventFeedsJob,
  driveLifecycle: driveLifecycleJob,
}
