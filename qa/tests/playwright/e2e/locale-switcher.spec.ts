import { expect, test } from "@playwright/test"

test("the homepage language round trip persists across navigation and reload", async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(isMobile, "the desktop language selector is in the header")

  await page.goto("/en")
  const english = page.getByRole("combobox", {
    name: "Language",
    exact: true,
  })
  await english.click()
  await page.getByRole("option", { name: "Français", exact: true }).click()
  await expect(page).toHaveURL(/\/fr$/)
  await expect(page.locator("html")).toHaveAttribute("lang", "fr")

  await page.getByRole("combobox", { name: "Langue", exact: true }).click()
  await page.getByRole("option", { name: "English", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator("html")).toHaveAttribute("lang", "en")

  await page
    .getByRole("navigation", { name: "Main", exact: true })
    .getByRole("link", { name: "Journal", exact: true })
    .click()
  await expect(page).toHaveURL(/\/journal$/)
  await expect(page.locator("html")).toHaveAttribute("lang", "en")
  await page.reload()
  await expect(page).toHaveURL(/\/journal$/)
  await expect(page.locator("html")).toHaveAttribute("lang", "en")
  expect(
    (await context.cookies()).find((cookie) => cookie.name === "NEXT_LOCALE")
      ?.value
  ).toBe("en")
})

test("switching language preserves filters and the current fragment", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "the desktop language selector is in the header")

  await page.goto("/en/journal?view=list&section=data#all-articles")
  await page.getByRole("combobox", { name: "Language", exact: true }).click()
  await page.getByRole("option", { name: "Français", exact: true }).click()
  await expect(page).toHaveURL(
    /\/fr\/journal\?view=list&section=data#all-articles$/
  )
  await expect(page.locator("html")).toHaveAttribute("lang", "fr")
})
