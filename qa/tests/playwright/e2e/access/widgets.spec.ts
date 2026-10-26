import type { Server } from "node:https"
import { tmpdir } from "node:os"
import path from "node:path"

import { expect, test, type APIRequestContext } from "@playwright/test"

import type {
  TeamWidget,
  WidgetWorkspace,
} from "../../../../../packages/shared-data/widgets"
import { pageAs, signedInApi } from "../../helpers/access-fixtures"
import { createWidgetHost } from "../../helpers/widget-host"

/** Reuses the existing local Team fixtures; never starts another application or database. */
test.describe.configure({ mode: "serial", timeout: 180000 })
// Exercise the real WebGL renderer on headless machines without a physical GPU.
test.use({
  launchOptions: {
    args: [
      "--enable-unsafe-swiftshader",
      "--ignore-certificate-errors",
      "--allow-running-insecure-content",
    ],
  },
})
let disposeHost: (() => void) | undefined
let hostServer: Server,
  allowedOrigin = "",
  blockedOrigin = ""
let organiser: APIRequestContext,
  member: APIRequestContext,
  baseURL = "",
  teamId = "",
  widget: TeamWidget
const created: string[] = []
const prefix = `Widget QA ${Date.now().toString(36)}`
const root = () => `/api/staff/team/${teamId}/widgets`
async function detail() {
  const r = await organiser.get(`${root()}/${widget.documentId}`)
  expect(r.ok()).toBeTruthy()

  return (await r.json()) as TeamWidget
}

test.beforeAll(async ({ playwright }, info) => {
  baseURL = info.project.use.baseURL!
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL).hostname)
  organiser = await signedInApi(playwright.request, baseURL, "team-organiser")
  member = await signedInApi(playwright.request, baseURL, "team-member")
  const mine = await organiser.get("/api/staff/team")
  expect(mine.ok()).toBeTruthy()
  const teams = (await mine.json()).teams as { id: string; slug: string }[]
  teamId = teams.find((t) => t.slug === "access-fixture-team")!.id
  const host = createWidgetHost((_req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/html",
      "Cache-Control": "no-store",
    })
    res.end(
      `<html><body><iframe src="${baseURL}/embed/w/${widget?.publicId ?? "unavailable"}" title="Widget" width="360" height="900"></iframe><a href="${baseURL}/embed/w/${widget?.publicId ?? "unavailable"}">Open hosted view</a></body></html>`
    )
  })
  hostServer = host.server
  disposeHost = host.dispose
  await new Promise<void>((resolve) => hostServer.listen(0, "::", resolve))
  const port = (hostServer.address() as { port: number }).port
  allowedOrigin = `https://127.0.0.1:${port}`
  blockedOrigin = `https://localhost:${port}`
})
test.afterAll(async () => {
  for (const id of created) {
    const res = await organiser?.get(`${root()}/${id}`)
    if (res?.ok()) {
      const w = (await res.json()) as TeamWidget
      await organiser.post(`${root()}/${id}/actions/archive`, {
        data: { version: w.draftVersion },
      })
    }
  }
  await new Promise<void>(
    (resolve) => hostServer?.close(() => resolve()) ?? resolve()
  )
  disposeHost?.()
  await organiser?.dispose()
  await member?.dispose()
})

test("creates and autosaves a real Strapi draft, then publishes at a stable address", async ({
  browser,
}) => {
  const page = await pageAs(browser, organiser, baseURL)
  page.setDefaultTimeout(15000)
  try {
    await page.goto("/staff/teams/widgets", { waitUntil: "domcontentloaded" })
    await expect(
      page.getByRole("heading", { name: "Widgets", exact: true }).first()
    ).toBeVisible()
    await page.getByRole("link", { name: "Create widget", exact: true }).click()
    await page.getByRole("button", { name: "Continue", exact: true }).click()
    await page
      .getByLabel("Internal name", { exact: true })
      .fill(`${prefix} finder`)
    const create = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" && new URL(r.url()).pathname === root()
    )
    await page
      .getByRole("button", { name: "Create draft and open preview" })
      .click()
    const result = await create
    expect(result.ok()).toBeTruthy()
    widget = (await result.json()) as TeamWidget
    created.push(widget.documentId)
    await expect(
      page.getByRole("heading", { name: `${prefix} finder`, exact: true })
    ).toBeVisible()
    await page
      .getByLabel("Public title", { exact: true })
      .fill("Find our fixture libraries")
    await expect(page.getByText(/Draft saved/).first()).toBeVisible({
      timeout: 30000,
    })
    await expect
      .poll(async () => (await detail()).config.title)
      .toBe("Find our fixture libraries")
    widget = await detail()
    await page.screenshot({
      path: path.join(tmpdir(), "widgets-builder.png"),
      fullPage: true,
      caret: "initial",
    })
    await page
      .getByRole("button", { name: "Publish & embed", exact: true })
      .click()
    await expect(
      page.getByRole("heading", { name: "Publication checks" })
    ).toBeVisible()
    await page
      .getByLabel("Add an allowed website", { exact: true })
      .fill(allowedOrigin)
    await page.getByRole("button", { name: "Add website", exact: true }).click()
    await expect(
      page.getByRole("button", { name: "Publish version 1", exact: true })
    ).toBeEnabled()
    await page
      .getByRole("button", { name: "Publish version 1", exact: true })
      .click()
    await expect(
      page.getByText("Version 1 published at the same embed address.")
    ).toBeVisible()
    widget = await detail()
    expect(widget.publishedVersion).toBe(1)
    await page.screenshot({
      path: path.join(tmpdir(), "widgets-publish.png"),
      fullPage: true,
      caret: "initial",
    })
    const response = await organiser.get(`/embed/w/${widget.publicId}`)
    expect(response.ok()).toBeTruthy()
    expect(response.headers()["content-security-policy"]).toBe(
      `frame-ancestors 'self' ${allowedOrigin}; report-uri /api/widgets/${widget.publicId}/reports`
    )
    expect(response.headers()["content-security-policy"]).not.toContain(
      "http://127.0.0.1:1337"
    )
    const html = await response.text()
    expect(html).toContain("Find our fixture libraries")
    expect(html).not.toContain("access-team-organiser@example.test")
    const denied = await member.post(
      `${root()}/${widget.documentId}/actions/publish`,
      { data: { version: widget.draftVersion, origins: widget.origins } }
    )
    expect(denied.status()).toBe(403)
  } finally {
    await page.context().close()
  }
})

test("visitors can use narrow lists and tables, with external framing enforced", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 360, height: 800 },
    }),
    page = await context.newPage()
  try {
    await page.goto(`${baseURL}/embed/w/${widget.publicId}`, {
      waitUntil: "domcontentloaded",
    })
    await expect(
      page.getByRole("heading", { name: "Find our fixture libraries" })
    ).toBeVisible()
    await expect(
      page.getByText("Access Fixture Public Library", { exact: true }).first()
    ).toBeVisible()
    await expect(
      page.getByRole("radio", { name: "List", exact: true })
    ).toBeChecked()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await page.screenshot({
      path: path.join(tmpdir(), "widgets-mobile.png"),
      fullPage: true,
      caret: "initial",
    })
    await page
      .getByPlaceholder("Search by library or town")
      .fill("No matching town")
    await expect(
      page.getByText("No libraries match", { exact: true })
    ).toBeVisible()
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .first()
      .click()
    // Keep tile-provider availability out of the interaction test. MapLibre,
    // its worker and the Strapi-backed records still run normally.
    await page.route("https://basemaps.cartocdn.com/**", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#ece8df" },
            },
          ],
        }),
      })
    )
    await page.getByRole("radio", { name: "Map", exact: true }).focus()
    await page.getByRole("radio", { name: "Map", exact: true }).press("Space")
    await expect(
      page.getByRole("button", { name: "Reset view", exact: true })
    ).toBeVisible()
    const map = page.locator("div[aria-label^='Library map.']")
    await expect(
      map
        .getByRole("button", { name: /Access Fixture|Zoom to \d+ libraries/ })
        .first()
    ).toBeVisible()
    await page.goto(allowedOrigin)
    await expect(
      page
        .frameLocator("iframe")
        .getByRole("heading", { name: "Find our fixture libraries" })
    ).toBeVisible()
    await page.goto(blockedOrigin)
    await expect(
      page.getByRole("link", { name: "Open hosted view" })
    ).toBeVisible()
    await expect(
      page
        .frameLocator("iframe")
        .getByRole("heading", { name: "Find our fixture libraries" })
    ).not.toBeVisible()
  } finally {
    await context.close()
  }
})

test("shared edits stay in drafts, then restore/pause/archive remain functional", async ({
  browser,
}) => {
  const workspace = (await (
    await organiser.get(root())
  ).json()) as WidgetWorkspace
  const selection = workspace.selections.find(
    (s) => s.documentId === widget.selection!.documentId
  )!
  const team = (await (
    await organiser.get(`/api/staff/team/${teamId}`)
  ).json()) as { libraries: { documentId: string }[] }
  const changed = await member.put(
    `${root()}/selections/${selection.documentId}`,
    {
      data: {
        name: selection.name,
        spec: {
          ...selection.spec,
          excludeLibraryIds: [
            ...selection.spec.excludeLibraryIds,
            team.libraries[0]!.documentId,
          ],
        },
        version: selection.version,
      },
    }
  )
  expect(changed.ok()).toBeTruthy()
  widget = await detail()
  expect(widget.hasChanges).toBe(true)
  const oldRelease = widget.release!.documentId
  const saved = await organiser.put(`${root()}/${widget.documentId}`, {
    data: {
      version: widget.draftVersion,
      name: widget.name,
      type: "chart",
      config: {
        ...widget.config,
        title: "Recorded accessibility",
        metric: "facility",
        chartMode: "percentage",
      },
      selectionId: selection.documentId,
    },
  })
  expect(saved.ok()).toBeTruthy()
  widget = await saved.json()
  const published = await organiser.post(
    `${root()}/${widget.documentId}/actions/publish`,
    { data: { version: widget.draftVersion, origins: widget.origins } }
  )
  expect(published.ok()).toBeTruthy()
  widget = await published.json()
  expect(widget.publishedVersion).toBe(2)
  const restored = await organiser.post(
    `${root()}/${widget.documentId}/actions/restore`,
    { data: { version: widget.draftVersion, releaseId: oldRelease } }
  )
  expect(restored.ok()).toBeTruthy()
  widget = await restored.json()
  expect(widget.type).toBe("finder")
  const live = await organiser.get(`/embed/w/${widget.publicId}`)
  expect(await live.text()).toContain("Recorded accessibility")
  const paused = await organiser.post(
    `${root()}/${widget.documentId}/actions/pause`,
    { data: { version: widget.draftVersion } }
  )
  expect(paused.ok()).toBeTruthy()
  widget = await paused.json()
  expect(
    await (await organiser.get(`/embed/w/${widget.publicId}`)).text()
  ).toContain("Library widget unavailable")
  const context = await browser.newContext(),
    page = await context.newPage()
  try {
    await page.goto(allowedOrigin)
    await expect(
      page
        .frameLocator("iframe")
        .getByRole("heading", { name: "Library widget unavailable" })
    ).toBeVisible()
  } finally {
    await context.close()
  }
})

test("edits custom selections and groups, and renders the remaining widget types accessibly", async ({
  browser,
}) => {
  const page = await pageAs(browser, organiser, baseURL)
  try {
    page.setDefaultTimeout(15000)
    if (!widget) {
      const r = await organiser.post(root(), {
        data: { name: `${prefix} base`, type: "finder" },
      })
      expect(r.ok()).toBeTruthy()
      widget = await r.json()
      created.push(widget.documentId)
    }

    const createdDirectory = await organiser.post(root(), {
      data: {
        name: `${prefix} directory`,
        type: "directory",
        selectionId: widget.selection!.documentId,
      },
    })
    expect(createdDirectory.ok()).toBeTruthy()
    const directory = (await createdDirectory.json()) as TeamWidget
    created.push(directory.documentId)
    await page.goto(
      `/staff/teams/widgets/selections/${directory.selection!.documentId}`,
      { waitUntil: "domcontentloaded" }
    )
    await page.screenshot({
      path: path.join(tmpdir(), "widgets-selection.png"),
      fullPage: true,
      caret: "initial",
    })

    await page
      .getByRole("button", {
        name: "Add any published library Search libraries",
        exact: true,
      })
      .click()
    const librarySearch = page.getByRole("searchbox", {
      name: "Search libraries",
      exact: true,
    })
    await librarySearch.fill("Access Fixture Second Library", {
      timeout: 15000,
    })
    await expect(librarySearch).toHaveValue("Access Fixture Second Library")
    await page
      .getByRole("button", { name: /Access Fixture Second Library/ })
      .click()
    await expect(
      page.getByText("Access Fixture Second Library", { exact: true })
    ).toBeVisible()
    await page.getByRole("radio", { name: "Fixed list", exact: true }).focus()
    await page
      .getByRole("radio", { name: "Fixed list", exact: true })
      .press("Space")
    await page.getByRole("radio", { name: /2. Comparison groups/ }).check()
    await page
      .getByRole("button", { name: "Create first group", exact: true })
      .click()
    await page.getByLabel("Group name", { exact: true }).fill("North branches")
    await page
      .getByRole("group", { name: "Libraries in North branches", exact: true })
      .getByRole("checkbox")
      .first()
      .check()
    await page.getByRole("button", { name: "Add group", exact: true }).click()
    await page.getByLabel("Group name", { exact: true }).fill("South branches")
    await page
      .getByRole("group", { name: "Libraries in South branches", exact: true })
      .getByRole("checkbox")
      .last()
      .check()
    await page
      .getByRole("button", { name: "Save selection", exact: true })
      .click()
    await expect(
      page.getByText("Selection saved", { exact: true }).first()
    ).toBeVisible()
    const catalogue = await organiser.get(`${root()}/catalogue?kind=networks`)
    expect(catalogue.ok()).toBeTruthy()
    const publishOther = async (
      type: "directory" | "chart" | "stat",
      existingId?: string
    ) => {
      let w: TeamWidget
      if (existingId)
        w = await (await organiser.get(`${root()}/${existingId}`)).json()
      else {
        const r = await organiser.post(root(), {
          data: {
            name: `${prefix} ${type}`,
            type,
            selectionId: directory.selection!.documentId,
          },
        })
        expect(r.ok()).toBeTruthy()
        w = await r.json()
        created.push(w.documentId)
      }
      const result = await organiser.post(
        `${root()}/${w.documentId}/actions/publish`,
        { data: { version: w.draftVersion, origins: [allowedOrigin] } }
      )
      expect(result.ok()).toBeTruthy()

      return (await result.json()) as TeamWidget
    }
    const liveDirectory = await publishOther("directory", directory.documentId)
    await page.goto(`/embed/w/${liveDirectory.publicId}`, {
      waitUntil: "domcontentloaded",
    })
    await expect(
      page.getByRole("heading", { name: "Access Fixture Second Library" })
    ).toBeVisible()
    const chart = await publishOther("chart")
    await page.goto(`/embed/w/${chart.publicId}`, {
      waitUntil: "domcontentloaded",
    })
    await page
      .getByRole("button", { name: "Show as table", exact: true })
      .click()
    await expect(page.getByRole("table")).toBeVisible()
    await expect(
      page.getByRole("rowheader", { name: "North branches" })
    ).toBeVisible()
    const stat = await publishOther("stat")
    await page.goto(`/embed/w/${stat.publicId}`, {
      waitUntil: "domcontentloaded",
    })
    await expect(page.getByText("3", { exact: true })).toBeVisible()
    const { default: AxeBuilder } = await import("@axe-core/playwright")
    const audit = await new AxeBuilder({ page }).include("article").analyze()
    expect(audit.violations).toEqual([])
  } finally {
    await page.context().close()
  }
})
