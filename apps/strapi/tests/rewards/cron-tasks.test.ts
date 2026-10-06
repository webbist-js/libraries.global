import { describe, expect, it } from "vitest"

import cronTasks from "../../config/cron-tasks"

describe("config/cron-tasks", () => {
  it("runs the expired role-grant resync and event feed housekeeping", () => {
    // Quick wins (and their 4-hourly refresh) were removed: drives replace them.
    // `eventFeeds` (Task 12) auto-pauses failing feeds and purges stale OAuth drafts.
    expect(Object.keys(cronTasks)).toEqual([
      "resyncExpiredRoleGrants",
      "eventFeeds",
    ])
  })
})
