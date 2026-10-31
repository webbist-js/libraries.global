// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { closeEditorialDrawer, openEditorialDrawer } from "../editorial/drawer"
import { installGoogleAnalytics } from "../google-analytics"
import {
  closeProfileDrawer,
  openProfileDrawer,
  setProfileNavigationGuard,
} from "../profile-drawer"
import { closeStaffDrawer, openStaffDrawer } from "../staff/drawer"

beforeEach(() => {
  closeProfileDrawer(true)
  closeStaffDrawer()
  closeEditorialDrawer()
  window.location.href = "https://libraries.global/knowledge"
  vi.spyOn(document.head, "append").mockImplementation(() => {})
})
afterEach(() => {
  delete window.librariesGlobalAnalytics
  delete window.gtag
  delete window.dataLayer
  vi.restoreAllMocks()
})
const views = () =>
  (window.dataLayer ?? []).filter(
    (row) =>
      (row as { analytics?: { event_name?: string } }).analytics?.event_name ===
      "workspace_view"
  )

describe("workspace drawers", () => {
  it("records a real open/section change once, respecting the unsaved-changes guard", () => {
    installGoogleAnalytics(window, undefined, false, true)!.setConsent(true)
    openProfileDrawer("overview", "PRIVATE_ACTOR")
    openProfileDrawer("overview", "PRIVATE_ACTOR")
    expect(views()).toHaveLength(1)
    const removeGuard = setProfileNavigationGuard(() => false)
    openProfileDrawer("settings", "PRIVATE_ACTOR")
    expect(views()).toHaveLength(1)
    removeGuard()
    openProfileDrawer("settings", "PRIVATE_ACTOR")
    expect(views()).toHaveLength(2)
    openProfileDrawer("membership", "PRIVATE_ACTOR")
    expect(views()).toHaveLength(2)
    expect(JSON.stringify(window.dataLayer)).not.toContain("PRIVATE_ACTOR")
  })

  it("does not measure pre-consent activity, and never includes staff library IDs", () => {
    const controller = installGoogleAnalytics(window, undefined, false, true)!
    openStaffDrawer("PRIVATE_LIBRARY")
    expect(views()).toHaveLength(0)
    controller.setConsent(true)
    closeStaffDrawer()
    openStaffDrawer("PRIVATE_LIBRARY")
    openStaffDrawer("ANOTHER_PRIVATE_LIBRARY")
    expect(views()).toHaveLength(1)
    openEditorialDrawer()
    openEditorialDrawer()
    expect(views()).toHaveLength(2)
    expect(JSON.stringify(window.dataLayer)).not.toContain("PRIVATE_LIBRARY")
    expect(JSON.stringify(window.dataLayer)).not.toContain("ANOTHER_PRIVATE")
  })
})
