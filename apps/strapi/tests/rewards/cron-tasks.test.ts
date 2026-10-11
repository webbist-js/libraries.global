import { describe, expect, it } from "vitest"

import cronTasks from "../../config/cron-tasks"

describe("config/cron-tasks", () => {
  it("runs the expired role-grant resync, event feed housekeeping and the drive lifecycle", () => {
    // Quick wins (and their 4-hourly refresh) were removed: drives replace them.
    // `eventFeeds` (Task 12) auto-pauses failing feeds and purges stale OAuth drafts.
    // `driveLifecycle` (D1 Task 6) opens, closes and snapshots drives hourly.
    expect(Object.keys(cronTasks)).toEqual(
      expect.arrayContaining([
        "resyncExpiredRoleGrants",
        "eventFeeds",
        "driveLifecycle",
        "notificationDelivery",
        "notificationRetention",
        "notificationAnnouncements",
        "followedLibraryUpdates",
        "weeklyDigest",
        "weeklyCommunityReport",
      ])
    )
  })
})
