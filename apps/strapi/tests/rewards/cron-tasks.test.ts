import { describe, expect, it } from "vitest"

import cronTasks from "../../config/cron-tasks"

describe("config/cron-tasks", () => {
  it("runs only the expired role-grant resync", () => {
    // Quick wins (and their 4-hourly refresh) were removed: drives replace them.
    expect(Object.keys(cronTasks)).toEqual(["resyncExpiredRoleGrants"])
  })
})
