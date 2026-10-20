import { expect, test } from "@playwright/test"

import { setSecretValue } from "../helpers/ui-flows"

test("read-only admin can inspect plugins but cannot invoke management routes", async ({
  request,
}) => {
  const email = process.env.QA_READONLY_EMAIL
  const password = process.env.QA_READONLY_PASSWORD
  if (!email?.endsWith("@example.test") || !password)
    throw new Error("Seed a local read-only @example.test admin")
  const login = await request.post("/admin/login", {
    data: { email, password },
  })
  expect(login.ok()).toBe(true)
  const { data } = await login.json()
  const headers = { Authorization: `Bearer ${data.token}` }
  for (const path of [
    "/events/admin/credentials",
    "/events/admin/pending-review",
    "/rewards/stats",
    "/discussions/revisions",
  ]) {
    expect((await request.get(path, { headers })).status(), path).toBe(200)
    expect([401, 403]).toContain((await request.get(path)).status())
  }
  for (const [method, path] of [
    ["POST", "/events/admin/credentials"],
    ["POST", "/events/admin/credentials/fixture/reveal"],
    ["PUT", "/events/admin/pending-review/fixture"],
    ["PUT", "/rewards/award"],
    ["POST", "/rewards/snapshot"],
    ["PUT", "/discussions/revisions/fixture"],
    ["GET", "/access/people"],
    ["GET", "/beta-invites/subscribers"],
  ])
    expect(
      (await request.fetch(path, { method, headers })).status(),
      path
    ).toBe(403)
})

test("read-only admin reloads Events and Rewards without privileged controls", async ({
  page,
}) => {
  const email = process.env.QA_READONLY_EMAIL
  const password = process.env.QA_READONLY_PASSWORD
  if (!email?.endsWith("@example.test") || !password)
    throw new Error("Seed a local read-only admin")
  await page.goto("/admin/auth/login")
  await page.getByLabel("Email", { exact: false }).fill(email)
  await setSecretValue(page.getByLabel("Password", { exact: false }), password)
  await page.getByRole("button", { name: "Login" }).click()
  await expect(page).toHaveURL(/\/admin\/?$/)
  for (const [slug, title] of [
    ["events", "Events"],
    ["rewards", "Rewards"],
  ]) {
    await page.goto(`/admin/plugins/${slug}`)
    await page.reload()
    await expect(
      page.getByRole("heading", { name: title, exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Add credential", exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByText("Adjust a contributor's points", { exact: true })
    ).toHaveCount(0)
  }
})
