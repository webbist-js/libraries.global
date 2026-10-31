import { mkdir } from "node:fs/promises"
import path from "node:path"

import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { atlasDashboardFixtures } from "../helpers/dashboard-fixtures"

const region = "/europe/england/greater-london"
const library = `${region}/abbey-wood-library`
const service = "/library-networks/access-fixture-library-service"
const artifacts = path.resolve(
  __dirname,
  "../../../../.scratch/dashboard-batch-b"
)
type MotionWindow = Window & {
  __dashboardDepartures: { url: string; top: number }[]
  __dashboardMotion: {
    types: string[]
    names: string[]
    durations: number[]
    error?: string
  }[]
}

async function observeMotion(page: Page) {
  await page.addInitScript(`
    window.__dashboardMotion = [];
    window.__dashboardDepartures = [];
    window.addEventListener('dashboard-before-navigation', () => window.__dashboardDepartures.push({url:location.pathname, top:document.querySelector('[data-dashboard-scroll=content]')?.scrollTop || 0}));
    if (document.startViewTransition) {
      const original = document.startViewTransition.bind(document);
      document.startViewTransition = (...args) => {
        const transition = original(...args);
        transition.ready.then(() => {
          const animations = document.getAnimations().filter(animation => (animation.animationName || '').startsWith('dashboard-'));
          window.__dashboardMotion.push({ types: Array.from(transition.types || []), names: animations.map(animation => animation.animationName), durations: animations.map(animation => animation.effect.getComputedTiming().duration) });
        }, error => window.__dashboardMotion.push({ types: [], names: [], durations: [], error: error.name }));
        return transition;
      };
    }
  `)
}

async function capture(page: Page, name: string) {
  await mkdir(artifacts, { recursive: true })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({
    path: path.join(artifacts, `${name}-${test.info().project.name}.png`),
    animations: "disabled",
    style: "canvas { visibility: hidden !important; }",
  })
}

async function signedOut(page: Page) {
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({ json: null })
  )
}

async function publicPage(page: Page, route: string) {
  await page.goto(route)
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true })
  ).toBeVisible({ timeout: 30_000 })
}

async function geometry(page: Page) {
  await expect(page.getByRole("main")).toHaveCount(1)
  await expect(page.locator(".dashboard-navigation")).toHaveCount(1)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  const main = await page.getByRole("main").boundingBox()
  expect(main?.x).toBe(page.viewportSize()!.width >= 768 ? 96 : 0)
  expect(main?.y).toBe(page.viewportSize()!.width >= 768 ? 0 : 56)
}

test.use({ trace: "off", video: "off" })
test.beforeEach(async ({ page, baseURL }) => {
  test.skip(
    !baseURL ||
      !["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname),
    "Local fixture services only"
  )
  await signedOut(page)
})
test.setTimeout(120_000)

test("keeps the global rail through continent, country, region and library navigation and restores native history", async ({
  page,
}) => {
  await observeMotion(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await publicPage(page, "/europe")
  const nativeMotion = await page.evaluate(() => {
    const transition = (
      window as unknown as { ViewTransition?: { prototype: object } }
    ).ViewTransition

    return (
      typeof document.startViewTransition === "function" &&
      Boolean(transition && "types" in transition.prototype)
    )
  })
  if (!nativeMotion)
    test.info().annotations.push({
      type: "motion fallback",
      description:
        "Native transition types unavailable; functional hierarchy/history checks still run.",
    })
  await expect(
    page.getByRole("heading", { level: 1, name: "Europe", exact: true })
  ).toBeVisible()
  await geometry(page)
  const rail = await page.locator(".dashboard-navigation").elementHandle()
  await page
    .locator('.dashboard-context-panel a[href="/europe/england"]')
    .click()
  await expect(
    page.getByRole("heading", { level: 1, name: "England", exact: true })
  ).toBeVisible()
  expect(await rail!.evaluate((node) => node.isConnected)).toBe(true)
  if (nativeMotion)
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as MotionWindow).__dashboardMotion
        )
      )
      .toContainEqual(
        expect.objectContaining({
          types: expect.arrayContaining(["nav-forward"]),
          names: expect.arrayContaining(["dashboard-slide"]),
        })
      )
  await page.locator(`.dashboard-context-panel a[href="${region}"]`).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Greater London", exact: true })
  ).toBeVisible()
  const body = page.locator(".dashboard-page-body")
  await body.evaluate((node) => {
    node.scrollTop = 600
  })
  await expect
    .poll(() => body.evaluate((node) => node.scrollTop))
    .toBeGreaterThan(300)
  const before = await body.evaluate((node) => node.scrollTop)
  // A link may scroll into view before activation; remember the actual position.
  const destination = page
    .locator(`.dashboard-page-body a[href="${library}"]`)
    .first()
  await destination.scrollIntoViewIfNeeded()
  await destination.click()
  const restored = await page.evaluate(
    (source) =>
      (window as unknown as MotionWindow).__dashboardDepartures.findLast(
        (entry) => entry.url === source
      )!.top,
    region
  )
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Abbey Wood Library",
      exact: true,
    })
  ).toBeVisible()
  expect(await rail!.evaluate((node) => node.isConnected)).toBe(true)
  await geometry(page)
  const left = await page.locator(".dashboard-context-panel").boundingBox()
  const right = await page.locator(".dashboard-page-context").boundingBox()
  expect(left?.x).toBe(96)
  expect(left?.y).toBe(0)
  expect(right?.y).toBe(0)
  expect(right!.x + right!.width).toBe(1440)
  await capture(page, "library-1440")
  await page.goBack()
  await expect(
    page.getByRole("heading", { level: 1, name: "Greater London", exact: true })
  ).toBeVisible()
  await expect
    .poll(() =>
      page.locator(".dashboard-page-body").evaluate((node) => node.scrollTop)
    )
    .toBeCloseTo(restored, -1)
  expect(before).toBeGreaterThan(300)
  await page.goForward()
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Abbey Wood Library",
      exact: true,
    })
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Abbey Wood Library",
      exact: true,
    })
  ).toBeVisible()
  await page.locator(`.dashboard-context-panel a[href="${region}"]`).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Greater London", exact: true })
  ).toBeVisible()
  await expect
    .poll(() =>
      page.locator(".dashboard-page-body").evaluate((node) => node.scrollTop)
    )
    .toBe(0)
  if (nativeMotion)
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as MotionWindow).__dashboardMotion
        )
      )
      .toContainEqual(
        expect.objectContaining({
          types: expect.arrayContaining(["nav-back"]),
          names: expect.arrayContaining(["dashboard-slide"]),
        })
      )
  await capture(page, "region-1440")
})

test("keeps hierarchy navigation functional with reduced motion and disables movement", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await observeMotion(page)
  await publicPage(page, "/europe/england")
  await page.locator(`.dashboard-context-panel a[href="${region}"]`).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Greater London", exact: true })
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches
    )
  ).toBe(true)
  expect(
    await page.evaluate(() =>
      (window as unknown as MotionWindow).__dashboardMotion
        .flatMap((motion) => motion.durations)
        .every((duration) => duration === 0)
    )
  ).toBe(true)
})

test("keeps location and library navigation usable at compact widths, including section drawers and anchors", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1100]) {
    await page.setViewportSize({ width, height: 844 })
    await publicPage(page, library)
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Abbey Wood Library",
        exact: true,
      })
    ).toBeVisible()
    await geometry(page)
    if (width < 1024) {
      const trigger = page.getByRole("button", { name: /Section navigation/ })
      await trigger.click()
      const drawer = page.getByRole("dialog", {
        name: "Abbey Wood Library",
        exact: true,
      })
      await expect(drawer).toBeVisible()
      await drawer
        .getByRole("link", { name: "Details and actions", exact: true })
        .click()
      await expect(drawer).toHaveCount(0)
      await expect(page.locator("#dashboard-page-context")).toBeFocused()
    }
    await capture(page, `library-${width}`)
    await publicPage(page, region)
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Greater London",
        exact: true,
      })
    ).toBeVisible()
    await geometry(page)
    await capture(page, `region-${width}`)
  }
})

test("retains Find filters, URL state and service/network destinations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await publicPage(page, "/libraries?country=england&q=library&view=list")
  await expect(
    page.getByRole("heading", { level: 1, name: /Find a library/ })
  ).toBeVisible()
  await geometry(page)
  await expect(page.locator(".dashboard-context-panel")).toBeVisible()
  await page.getByRole("button", { name: "Hide", exact: true }).click()
  await expect(page.locator(".dashboard-context-panel")).toBeHidden()
  await page.getByRole("button", { name: /^Filters/ }).click()
  await expect(page.locator(".dashboard-context-panel")).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true })
  ).toBeVisible()
  expect(new URL(page.url()).searchParams.get("q")).toBe("library")
  await capture(page, "find-1440")
  for (const route of [
    "/library-networks?kind=library_service",
    service,
    "/europe/england/library-services",
  ]) {
    await publicPage(page, route)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await geometry(page)
    await capture(
      page,
      route === service
        ? "service-1440"
        : route.startsWith("/europe")
          ? "country-services-1440"
          : "networks-1440"
    )
  }
  await publicPage(
    page,
    "/europe/england/library-services/access-fixture-library-service"
  )
  await expect(page).toHaveURL(new RegExp(`${service}$`))
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
})

test("has no serious accessibility violations in the fixed location panels or library navigation", async ({
  page,
}) => {
  for (const route of ["/europe/england", library]) {
    await publicPage(page, route)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    const result = await new AxeBuilder({ page })
      .include(".dashboard-navigation")
      .include(".dashboard-context-panel")
      .include(".dashboard-page-context")
      .analyze()
    expect(
      result.violations.filter((issue) =>
        ["serious", "critical"].includes(issue.impact ?? "")
      )
    ).toEqual([])
  }
})

async function accountFixtures(page: Page) {
  await atlasDashboardFixtures(page)
  const profile = {
    id: 1,
    username: "dashboard-reviewer",
    firstName: "Dashboard",
    lastName: "Reviewer",
    profileVisibility: "private",
    isVerifiedLibrarian: false,
    createdAt: "2026-01-01T12:00:00Z",
    updatedAt: "2026-01-01T12:00:00Z",
    languages: [],
    interests: [],
    followedLibraries: [],
    followedDrives: [],
    followedProfiles: [],
    claimedLibraries: [],
    earnedBadges: [],
    notifPrefs: {
      weeklyDigest: false,
      editsReviewed: false,
      newFollowers: false,
      editorialMessages: false,
      soundOn: false,
      marketing: false,
    },
  }
  const user = {
    id: "dashboard-reviewer",
    name: "Dashboard Reviewer",
    email: "reviewer@example.test",
    username: profile.username,
    image: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#c8c1ff" d="M0 0h48v48H0z"/><circle fill="#4338ca" cx="24" cy="17" r="9"/><path fill="#4338ca" d="M8 48v-8a16 16 0 0 1 32 0v8z"/></svg>')}`,
    profileLoaded: true,
    emailVerified: true,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    capabilities: [],
    plan: "free",
    features: [],
  }
  await page.route("**/api/auth/get-session**", (route) =>
    route.fulfill({
      json: {
        user,
        session: {
          id: "dashboard-review-session",
          userId: user.id,
          token: "synthetic-review-token",
          expiresAt: "2027-01-01T00:00:00Z",
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
      },
    })
  )
  await page.route("**/api/profile/workspace**", (route) =>
    route.fulfill({
      json: {
        actorId: user.id,
        asOf: 1,
        profile,
        avatarUrl: null,
        imageUploadsEnabled: false,
        followedDrives: [],
      },
    })
  )
  await page.route("**/api/profile/dashboard-reviewer/**", (route) =>
    route.fulfill({ json: { data: [] } })
  )
  await page.route("**/api/notifications**", (route) =>
    route.fulfill({ json: { data: [], unread: 0, soundOn: false } })
  )
  await page.route("**/api/profile/me/sessions", (route) =>
    route.fulfill({ json: { sessions: [] } })
  )
  await page.route("**/api/profile/me/connections", (route) =>
    route.fulfill({ json: { connections: [] } })
  )
  await page.route("**/api/profile/me", async (route) => {
    if (route.request().method() === "PUT") {
      Object.assign(profile, route.request().postDataJSON())
      await route.fulfill({ json: { data: profile } })

      return
    }
    await route.fulfill({ json: { data: profile } })
  })

  return profile
}

test("uses the real profile sections in a drawer, saves through the existing form and returns from account entry links", async ({
  page,
}) => {
  await accountFixtures(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/map?v=30.0000%2C10.0000%2C1.60&layers=pins&list=1")
  const trigger = page.getByRole("button", {
    name: "Your profile",
    exact: true,
  })
  await expect(trigger).toBeVisible()
  const avatar = await trigger.locator("img").boundingBox()
  const button = await trigger.boundingBox()
  expect(avatar?.width).toBe(button?.width)
  expect(avatar?.height).toBe(button?.height)
  await trigger.click()
  const drawer = page.getByRole("dialog", { name: "Your profile", exact: true })
  await expect(
    drawer.getByRole("heading", { name: "Dashboard Reviewer", exact: true })
  ).toBeVisible()
  const navigation = drawer.getByRole("navigation", {
    name: "Profile sections",
  })
  const row = await navigation.boundingBox()
  expect(row!.width).toBeGreaterThan(1000)
  expect(row!.height).toBeLessThan(80)
  const original = page.url()
  await capture(page, "profile-overview-1440")
  await drawer.getByRole("button", { name: "Settings", exact: true }).click()
  const firstName = drawer.getByRole("textbox", {
    name: /Display name/,
  })
  await firstName.fill("Reviewed")
  page.once("dialog", (dialog) => dialog.dismiss())
  await page.keyboard.press("Escape")
  await expect(firstName).toHaveValue("Reviewed")
  const saved = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/profile/me") && request.method() === "PUT"
  )
  await drawer
    .getByRole("button", { name: "Save profile", exact: true })
    .click()
  expect((await saved).postDataJSON()).toMatchObject({ firstName: "Reviewed" })
  await expect(
    drawer.getByText("Unsaved profile changes", { exact: true })
  ).toHaveCount(0)
  expect(page.url()).toBe(original)
  await expect(
    drawer.getByRole("link", { name: /View public profile/ })
  ).toHaveAttribute("href", "/profile/dashboard-reviewer")
  await capture(page, "profile-settings-1440")
  await page.keyboard.press("Escape")
  await expect(drawer).toHaveCount(0)
  await expect(trigger).toBeFocused()
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 })
    await trigger.click()
    await expect(drawer).toBeVisible()
    await drawer.getByRole("button", { name: "Settings", exact: true }).click()
    await expect(
      drawer.getByRole("textbox", { name: /Display name/ })
    ).toHaveValue("Reviewed")
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await capture(page, `profile-settings-${width}`)
    await page.keyboard.press("Escape")
    await expect(drawer).toHaveCount(0)
  }
  await page.goto("/map?list=1&layers=pins&account=notifications")
  await expect(
    page.getByRole("dialog", { name: "Your profile", exact: true })
  ).toBeVisible()
  await expect(
    page.locator('[data-profile-section="notifications"]')
  ).toBeVisible()
  await expect
    .poll(() => new URL(page.url()).searchParams.get("account"))
    .toBeNull()
  expect(new URL(page.url()).searchParams.get("list")).toBe("1")
})

test("keeps dashboard navigation and recovery controls for a missing library", async ({
  page,
}) => {
  await publicPage(
    page,
    "/europe/england/greater-london/missing-dashboard-review-library"
  )
  await expect(page.locator(".dashboard-recovery")).toBeVisible()
  await geometry(page)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
})

test("keeps hierarchy navigation functional without the native view transition API", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: undefined,
    })
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await publicPage(page, "/europe")
  await page
    .locator('.dashboard-context-panel a[href="/europe/england"]')
    .click()
  await expect(
    page.getByRole("heading", { level: 1, name: "England", exact: true })
  ).toBeVisible()
  await geometry(page)
  await page.goBack()
  await expect(
    page.getByRole("heading", { level: 1, name: "Europe", exact: true })
  ).toBeVisible()
})
