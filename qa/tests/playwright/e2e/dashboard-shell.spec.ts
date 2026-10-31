import { mkdir } from "node:fs/promises"
import path from "node:path"

import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import {
  atlasDashboardFixtures as fixtures,
  library,
} from "../helpers/dashboard-fixtures"

// Public synthetic read responses exercise the real hydrated Atlas and shell.
// They do not stand in for the separate local CMS/account acceptance gate.
const baseline = process.env.QA_DASHBOARD_BASELINE === "1"
const artifacts = path.resolve(
  __dirname,
  "../../../../.scratch/dashboard-batch-a"
)
async function capture(page: Page, name: string) {
  await mkdir(artifacts, { recursive: true })
  await page.evaluate(() => document.fonts.ready)
  const engine = page.context().browser()?.browserType().name() ?? "browser"
  const suffix = engine === "chromium" ? "" : `-${engine}`
  await page.screenshot({
    path: path.join(artifacts, `${name}${suffix}.png`),
    animations: "disabled",
    style: "canvas { visibility: hidden !important; }",
  })
}

test.use({
  contextOptions: { reducedMotion: "reduce" },
  trace: "off",
  video: "off",
})

test.describe("Atlas dashboard review gate", () => {
  test.setTimeout(60_000)
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(
      !baseURL ||
        !["localhost", "127.0.0.1", "[::1]"].includes(
          new URL(baseURL).hostname
        ),
      "Local synthetic acceptance only"
    )
    await fixtures(page)
  })

  test("renders Atlas directly in the default locale without a prefix", async ({
    page,
  }) => {
    test.skip(baseline)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/map?list=1&layers=pins")
    await expect(page.locator("html")).toHaveAttribute("lang", "en")
    await expect(page).toHaveURL(/\/map\?/)
    await expect(
      page.getByRole("table").getByText(library.name, { exact: true })
    ).toBeVisible()
    await expect(
      page
        .getByRole("navigation", { name: "Main", exact: true })
        .getByRole("link", { name: "Journal", exact: true })
    ).toHaveAttribute("href", "/journal")
    const trigger = page.getByRole("button", {
      name: "Contribute",
      exact: true,
    })
    await trigger.click()
    await expect(
      page.getByRole("dialog", { name: "Contribute", exact: true })
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(trigger).toBeFocused()
    await capture(page, "english-1440")
  })

  test("captures the previous Atlas layout for manual comparison", async ({
    page,
  }) => {
    test.skip(
      !baseline,
      "Run only with the previous layout restored for a baseline capture"
    )
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height })
      await page.goto("/fr/map?list=1&layers=pins")
      await expect(page.getByRole("main")).toHaveCount(1)
      if (width >= 1024)
        await expect(
          page.getByRole("link", { name: "Se connecter", exact: true })
        ).toBeVisible()
      await expect(
        page.getByRole("table").getByText(library.name, { exact: true })
      ).toBeVisible()
      await capture(page, `before-${width}`)
    }
  })

  test("keeps the workspace while global drawers open and restore focus", async ({
    page,
  }) => {
    test.skip(baseline)
    await page.setViewportSize({ width: 1440, height: 900 })
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto("/fr/map?list=1&layers=pins")
    await expect(
      page.getByRole("table").getByText(library.name, { exact: true })
    ).toBeVisible()
    await expect(page.getByRole("main")).toHaveCount(1)
    await expect(page.locator("[data-global-header]")).toHaveCount(0)
    const main = await page.getByRole("main").boundingBox()
    expect(main?.x).toBe(96)
    expect(main?.y).toBe(0)
    const primary = await page
      .locator(".dashboard-destinations > a")
      .first()
      .boundingBox()
    expect(primary?.width).toBeLessThan(100)
    expect(primary?.x).toBeGreaterThan(0)
    await expect(page.locator(".dashboard-brand svg")).toHaveAttribute(
      "viewBox",
      "0 0 640 640"
    )
    await capture(page, "after-1440")

    const contribute = page.getByRole("button", {
      name: "Contribuer",
      exact: true,
    })
    const url = new URL(page.url())
    await contribute.click()
    const dialog = page.getByRole("dialog", { name: "Contribuer", exact: true })
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByRole("link", { name: /Add a library/ })
    ).toHaveAttribute("href", /callbackUrl=/)
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab")
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement)
        )
      ).toBe(true)
    }
    await capture(page, "contribute-1440")
    await page.keyboard.press("Escape")
    await expect(dialog).toHaveCount(0)
    await expect(contribute).toBeFocused()
    await expect(
      page.getByRole("table").getByText(library.name, { exact: true })
    ).toBeVisible()
    const restored = new URL(page.url())
    expect(restored.pathname).toBe(url.pathname)
    expect(restored.searchParams.get("list")).toBe(url.searchParams.get("list"))
    expect(restored.searchParams.get("layers")).toBe(
      url.searchParams.get("layers")
    )

    await page.getByRole("button", { name: "Navigation", exact: true }).click()
    const navigation = page.getByRole("dialog", {
      name: "Navigation",
      exact: true,
    })
    await expect(
      navigation
        .getByRole("navigation", { name: "Principal", exact: true })
        .getByRole("link", { name: "Journal", exact: true })
    ).toHaveAttribute("href", "/fr/journal")
    await expect(
      navigation.locator('a[href="/fr/library-networks"]').first()
    ).toHaveAttribute("href", "/fr/library-networks")
    await expect(
      navigation.getByRole("combobox", { name: "Langue", exact: true })
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(
      page.getByRole("button", { name: "Navigation", exact: true })
    ).toBeFocused()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    expect(errors).toEqual([])
  })

  test("provides phone and tablet navigation without hiding Atlas controls", async ({
    page,
  }) => {
    test.skip(baseline)
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [768, 1024],
      [1100, 800],
      [1024, 360],
    ]) {
      await page.setViewportSize({ width, height })
      await page.goto("/fr/map?layers=pins")
      await expect(
        page.getByRole("navigation", { name: "Atlas workspace" })
      ).toBeVisible()
      await expect(
        page.getByRole("link", { name: "Se connecter", exact: true })
      ).toBeVisible()
      const main = await page.getByRole("main").boundingBox()
      expect(main?.x).toBe(width < 768 ? 0 : 96)
      expect(main?.y).toBe(width < 768 ? 56 : 0)
      await page
        .getByRole("button", { name: "Contribuer", exact: true })
        .click()
      const dialog = page.getByRole("dialog", {
        name: "Contribuer",
        exact: true,
      })
      await expect(dialog).toBeVisible()
      const bounds = await dialog.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
      await page.keyboard.press("Escape")
      await page
        .getByRole("button", { name: "Navigation", exact: true })
        .click()
      const navigation = page.getByRole("dialog", {
        name: "Navigation",
        exact: true,
      })
      await expect(
        navigation
          .getByRole("navigation", { name: "Principal", exact: true })
          .getByRole("link", { name: "Journal", exact: true })
      ).toBeVisible()
      await page.keyboard.press("Escape")
      await expect(
        page.getByRole("navigation", { name: "Atlas workspace" })
      ).toBeVisible()
      await page.getByRole("radio", { name: "List", exact: true }).click()
      await expect(
        page.getByRole("table").getByText(library.name, { exact: true })
      ).toBeVisible()
      await capture(page, `after-${width}`)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
    }
  })

  test("keeps navigation usable with enlarged text", async ({ page }) => {
    test.skip(baseline)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/fr/map?list=1&layers=pins")
    expect(
      await page.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches
      )
    ).toBe(true)
    await expect(
      page.getByRole("table").getByText(library.name, { exact: true })
    ).toBeVisible()
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" })
    const trigger = page.getByRole("button", {
      name: "Navigation",
      exact: true,
    })
    await trigger.click()
    const dialog = page.getByRole("dialog", { name: "Navigation", exact: true })
    await expect(
      dialog.getByRole("combobox", { name: "Langue", exact: true })
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await capture(page, "enlarged-1440")
    await page.keyboard.press("Escape")
    await expect(trigger).toBeFocused()
  })

  test("preserves direct-load selection, reload, Map/List and query history", async ({
    page,
  }) => {
    test.skip(baseline)
    await page.setViewportSize({ width: 1560, height: 900 })
    await page.goto("/fr/map?lib=dashboard-fixture&layers=pins")
    await expect(
      page.getByRole("heading", { name: library.name, exact: true })
    ).toBeVisible()
    await expect(
      page.locator('.atlas-motion [role="status"][aria-busy="true"]')
    ).toHaveCount(0, { timeout: 30_000 })
    if (
      await page.getByRole("radio", { name: "List", exact: true }).isChecked()
    ) {
      test.info().annotations.push({
        type: "WebGL fallback",
        description:
          "Map toolbar is unavailable in List fallback; real toolbar geometry/popover are checked in map-capable engines.",
      })
      await expect(
        page.getByRole("table").getByText(library.name, { exact: true })
      ).toBeVisible()
    } else {
      const status = page.locator(".atlas-status")
      const bar = await status.boundingBox()
      const area = await status.locator("..").boundingBox()
      expect(bar!.width).toBeLessThanOrEqual(720)
      expect(
        Math.abs(bar!.x + bar!.width / 2 - area!.x - area!.width / 2)
      ).toBeLessThan(2)
      await expect(status).toHaveCSS("border-radius", "14px")
      await status.getByRole("button", { name: "Map key", exact: true }).click()
      await expect(page.getByLabel("Légende de la carte active")).toBeVisible()
      await page.keyboard.press("Escape")
      await capture(page, "after-map-1560")
    }
    await page.reload()
    await expect(
      page.getByRole("heading", { name: library.name, exact: true })
    ).toBeVisible()
    await page.getByRole("button", { name: "Navigation", exact: true }).click()
    await page.keyboard.press("Escape")
    await expect(
      page.getByRole("heading", { name: library.name, exact: true })
    ).toBeVisible()
    expect(new URL(page.url()).searchParams.get("lib")).toBe(
      "dashboard-fixture"
    )
    await page.getByRole("radio", { name: "List", exact: true }).click()
    await expect(
      page.getByRole("table").getByText(library.name, { exact: true })
    ).toBeVisible()
    await page.getByRole("radio", { name: "Map", exact: true }).click()
    await expect(
      page.getByRole("heading", { name: library.name, exact: true })
    ).toBeVisible()
    await page.goto("/fr/map?list=1&layers=pins")
    await expect(
      page.getByRole("table").getByText(library.name, { exact: true })
    ).toBeVisible()
    await page.goBack()
    await expect(
      page.getByRole("heading", { name: library.name, exact: true })
    ).toBeVisible()
    expect(new URL(page.url()).searchParams.get("lib")).toBe(
      "dashboard-fixture"
    )
    await page.goForward()
    await expect(
      page.getByRole("table").getByText(library.name, { exact: true })
    ).toBeVisible()
    await page.goBack()
    await expect(
      page.getByRole("heading", { name: library.name, exact: true })
    ).toBeVisible()
    await page.getByRole("button", { name: "Navigation", exact: true }).click()
    await page
      .getByRole("dialog", { name: "Navigation", exact: true })
      .getByRole("combobox", { name: "Langue", exact: true })
      .click()
    await page.getByRole("option", { name: "Čeština", exact: true }).click()
    await expect(page).toHaveURL(/\/cs\/map\?/)
    await expect(
      page.getByRole("heading", { name: library.name, exact: true })
    ).toBeVisible()
    expect(new URL(page.url()).searchParams.get("lib")).toBe(
      "dashboard-fixture"
    )
  })

  test("keeps the shell through Journal and restores Atlas state (local CMS required)", async ({
    page,
  }) => {
    test.skip(
      process.env.QA_DASHBOARD_LIVE_CONTENT !== "1",
      "Pending: existing local CMS/database fixture services must be running"
    )
    await page.setViewportSize({ width: 1560, height: 900 })
    await page.goto("/fr/map?lib=dashboard-fixture&layers=pins")
    await expect(
      page.getByRole("heading", { name: library.name, exact: true })
    ).toBeVisible()
    await page.getByRole("button", { name: "Navigation", exact: true }).click()
    await page
      .getByRole("dialog", { name: "Navigation", exact: true })
      .getByRole("navigation", { name: "Principal", exact: true })
      .getByRole("link", { name: "Journal", exact: true })
      .click()
    await expect(page).toHaveURL(/\/fr\/journal$/, { timeout: 30_000 })
    await expect(page.locator("[data-dashboard-shell]")).toHaveCount(1)
    await expect(page.locator("body")).toHaveAttribute(
      "data-dashboard-active",
      "true"
    )
    await expect(page.locator(".strapi-layout-footer")).toBeHidden()
    await page.goBack()
    await expect(
      page.getByRole("heading", { name: library.name, exact: true })
    ).toBeVisible()
    await page.getByRole("link", { name: "Se connecter", exact: true }).click()
    await expect(page).toHaveURL(/\/fr\/auth\/signin$/, { timeout: 30_000 })
    await expect(page.locator("[data-dashboard-shell]")).toHaveCount(0)
    await page.goBack()
    await expect(
      page.getByRole("heading", { name: library.name, exact: true })
    ).toBeVisible()
  })

  test("has no serious accessibility violations in the shell and navigation drawer", async ({
    page,
  }) => {
    test.skip(baseline)
    await page.goto("/fr/map?list=1&layers=pins")
    await expect(
      page.getByRole("table").getByText(library.name, { exact: true })
    ).toBeVisible()
    const shell = await new AxeBuilder({ page })
      .include(".dashboard-navigation")
      .analyze()
    expect(
      shell.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact ?? "")
      )
    ).toEqual([])
    await page.getByRole("button", { name: "Navigation", exact: true }).click()
    const drawer = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze()
    expect(
      drawer.violations.filter((item) =>
        ["serious", "critical"].includes(item.impact ?? "")
      )
    ).toEqual([])
  })
})
