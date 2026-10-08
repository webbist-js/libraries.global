import { expect, test } from "@playwright/test"

test("Strapi admin loads linked workspace dependencies before and after reload", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))

  await page.goto(`${process.env.STRAPI_URL ?? "http://localhost:1337"}/admin`)
  await expect(
    page.getByRole("button", { name: "Login", exact: true })
  ).toBeVisible()
  await expect(page.getByLabel(/^Email/)).toBeVisible()
  expect(errors).toEqual([])

  await page.reload()
  await expect(
    page.getByRole("button", { name: "Login", exact: true })
  ).toBeVisible()
  expect(errors).toEqual([])
})
