import {
  type APIRequestContext,
  type Browser,
  expect,
  type Page,
  test,
} from "@playwright/test"

import { pageAs, signedInApi } from "../../helpers/access-fixtures"
import { NAVIGATION } from "../../helpers/ui-flows"

// Local only, opt-in (the access project), after `pnpm seed:access`. The
// geocoder is stubbed with page.route, so Photon is never called; the atlas
// lookups are real and need England (GB-ENG) in the local Strapi.

const BRITISH_LIBRARY = {
  id: "W4680891",
  label: "British Library",
  detail: "96 Euston Road, Somers Town, London, England, United Kingdom",
  kind: "Library",
  lat: 51.5299119,
  lng: -0.1276918,
  precise: true,
  address: {
    streetAddress: "96 Euston Road",
    district: "Somers Town",
    city: "London",
    postalCode: "NW1 2DB",
    country: "United Kingdom",
    countryCode: "GB",
    state: "England",
    county: "",
  },
}

test.describe.configure({ mode: "serial", timeout: 120_000 })

let contributor: APIRequestContext

test.beforeAll(async ({ playwright }, testInfo) => {
  contributor = await signedInApi(
    playwright.request,
    testInfo.project.use.baseURL!,
    "contributor"
  )
})

test.afterAll(async () => {
  await contributor?.dispose()
})

/** A new-library wizard on its Location step, with the geocoder stubbed. */
async function locationStep(browser: Browser, baseURL: string): Promise<Page> {
  const page = await pageAs(browser, contributor, baseURL)
  await page.route("**/api/geocode/search?**", (route) =>
    route.fulfill({ json: { data: [BRITISH_LIBRARY] } })
  )
  await page.goto("/contribute/index/new?name=British%20Library", NAVIGATION)
  const lookup = page.getByRole("combobox", {
    name: "Find the library or its address",
  })
  // A click before hydration does nothing, so retry until the step shows.
  // Identity's required type and status come first: Next holds the step.
  await expect(async () => {
    if (await lookup.isVisible()) return
    for (const [trigger, option] of [
      ["#libraryType", "Public"],
      ["#operationalStatus", "Open"],
    ] as const) {
      await page.locator(trigger).click({ timeout: 5000 })
      await page
        .getByRole("option", { name: option, exact: true })
        .click({ timeout: 5000 })
    }
    await page
      .getByRole("button", { name: /^Next: Location/ })
      .click({ timeout: 5000 })
    await expect(lookup).toBeVisible({ timeout: 5000 })
  }).toPass({ timeout: 60_000 })

  return page
}

test("a picked result fills the address, the coordinates and the atlas", async ({
  browser,
  baseURL,
}) => {
  const page = await locationStep(browser, baseURL!)
  const lookup = page.getByRole("combobox", {
    name: "Find the library or its address",
  })
  await expect(lookup).toHaveValue("British Library")
  await lookup.focus()
  await page.getByRole("option", { name: /^British Library/ }).click()

  await expect(page.locator("#streetAddress")).toHaveValue("96 Euston Road")
  await expect(page.locator("#city")).toHaveValue("London")
  await expect(page.locator("#postalCode")).toHaveValue("NW1 2DB")
  await expect(page.locator("#lat")).toHaveValue("51.529912")
  await expect(page.locator("#lng")).toHaveValue("-0.127692")
  await expect(page.locator("#hier-country option:checked")).toHaveText(
    "England",
    NAVIGATION
  )
  await expect(page.locator("#country")).toHaveValue("England")
  await expect(
    page.getByText("Set from the address. Check these.")
  ).toBeVisible()
  await page.context().close()
})

test("pasting a coordinate pair fills both boxes; a bad latitude holds the step", async ({
  browser,
  baseURL,
}) => {
  const page = await locationStep(browser, baseURL!)
  await page.locator("#lat").evaluate((el, text) => {
    const data = new DataTransfer()
    data.setData("text/plain", text)
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      })
    )
  }, "51.7031, -0.3255")
  await expect(page.locator("#lat")).toHaveValue("51.7031")
  await expect(page.locator("#lng")).toHaveValue("-0.3255")

  await page.locator("#lat").fill("200")
  await page.locator("#city").fill("Radlett")
  await page.locator("#country").fill("England")
  await page.getByRole("button", { name: /^Next:/ }).click()
  await expect(
    page.getByText("Latitude is a number between -90 and 90.")
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Where is it?" })
  ).toBeVisible()
  await page.context().close()
})
