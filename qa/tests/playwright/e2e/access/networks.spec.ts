import { tmpdir } from "node:os"
import path from "node:path"

import { expect, test, type APIRequestContext } from "@playwright/test"

import type {
  NetworkClaimSnapshot,
  NetworkMandate,
} from "../../../../../packages/shared-data/networks"
import { pageAs, signedInApi } from "../../helpers/access-fixtures"

test.describe.configure({ mode: "serial", timeout: 180000 })
let organiser: APIRequestContext,
  moderator: APIRequestContext,
  baseURL = "",
  networkId = "",
  teamId = "",
  firstId = "",
  secondId = "",
  countryPath = "",
  libraryPath = "",
  requestId = "",
  followupId = ""
let originalTeam: {
  libraries: { documentId: string }[]
  primaryNetwork?: { documentId: string }
}
type Workspace = {
  affiliations: {
    documentId: string
    status: string
    role: string
    publicDisplay: boolean
    network: { documentId: string }
  }[]
  mandates: NetworkMandate[]
  requests: {
    documentId: string
    status: string
    fields: NetworkClaimSnapshot
  }[]
}
async function workspace(): Promise<Workspace> {
  const response = await organiser.get("/api/networks/me")
  expect(response.ok()).toBeTruthy()

  return response.json()
}
async function withdrawFixtureAuthority() {
  for (const row of (await workspace()).affiliations.filter(
    (row) => row.network.documentId === networkId && row.status !== "revoked"
  )) {
    const response = await organiser.post(
      `/api/networks/${row.documentId}/withdraw`,
      { data: { reason: "Local network journey fixture cleanup" } }
    )
    expect(response.ok()).toBeTruthy()
  }
}
async function fulfil() {
  const row = (await workspace()).mandates.find(
    (row) => row.network.documentId === networkId && row.status === "approved"
  )!
  expect(row).toBeTruthy()
  if (!row.fulfilment.complete) {
    const response = await organiser.post(
      `/api/networks/${row.documentId}/retry`,
      { data: {} }
    )
    expect(response.ok()).toBeTruthy()
  }

  return (await workspace()).mandates.find(
    (value) => value.documentId === row.documentId
  )!
}
test.beforeAll(async ({ playwright }, info) => {
  baseURL = info.project.use.baseURL!
  expect(["localhost", "127.0.0.1"]).toContain(new URL(baseURL).hostname)
  organiser = await signedInApi(playwright.request, baseURL, "team-organiser")
  moderator = await signedInApi(playwright.request, baseURL, "moderator-global")
  const catalogue = await organiser.get(
    "/api/networks?q=Access%20Fixture%20Library%20Service"
  )
  expect(catalogue.ok()).toBeTruthy()
  networkId = (await catalogue.json()).networks.find(
    (row: { slug: string }) => row.slug === "access-fixture-library-service"
  ).documentId
  const detail = await organiser.get(`/api/networks/${networkId}`)
  const body = await detail.json()
  const country = body.network.countries[0]
  countryPath = `/${country.continentSlug}/${country.slug}/library-services`
  const libraries = body.libraries as {
    documentId: string
    name: string
    href: string
  }[]
  firstId = libraries.find(
    (row) => row.name === "Access Fixture Public Library"
  )!.documentId
  secondId = libraries.find(
    (row) => row.name === "Access Fixture Second Library"
  )!.documentId
  libraryPath = libraries.find((row) => row.documentId === firstId)!.href
  const mine = await organiser.get("/api/staff/team")
  teamId = (await mine.json()).teams.find(
    (row: { slug: string }) => row.slug === "access-fixture-team"
  ).id
  originalTeam = await (await organiser.get(`/api/staff/team/${teamId}`)).json()
  await withdrawFixtureAuthority()
})
test.afterAll(async () => {
  if (networkId && organiser) await withdrawFixtureAuthority()
  if (originalTeam) {
    const response = await organiser.put(`/api/staff/team/${teamId}`, {
      data: {
        libraryDocumentIds: originalTeam.libraries.map((row) => row.documentId),
        primaryNetworkId: originalTeam.primaryNetwork?.documentId ?? null,
      },
    })
    expect(response.ok()).toBeTruthy()
  }
  await organiser?.dispose()
  await moderator?.dispose()
})

test("profile affiliation preferences save separately and consortia offer employment verification only", async ({
  browser,
}) => {
  const page = await pageAs(browser, organiser, baseURL)
  page.setDefaultTimeout(15000)
  try {
    await page.goto("/profile/settings", { waitUntil: "domcontentloaded" })
    await page
      .getByLabel("Find your library service or network")
      .fill("Access Fixture Library Service")
    await page
      .getByRole("button", { name: /Access Fixture Library Service/ })
      .click()
    await page
      .getByLabel("Role", { exact: true })
      .fill("Library service coordinator")
    await page.getByLabel("Show this affiliation on my public profile").check()
    await page
      .getByRole("button", { name: "Save affiliation", exact: true })
      .click()
    await expect
      .poll(
        async () =>
          (await workspace()).affiliations.find(
            (row) => row.network.documentId === networkId
          )?.role
      )
      .toBe("Library service coordinator")
    expect(
      (await workspace()).affiliations.find(
        (row) => row.network.documentId === networkId
      )?.publicDisplay
    ).toBe(true)
    await page
      .getByRole("link", {
        name: "Request verification or management",
        exact: true,
      })
      .click()
    await expect(page.getByLabel("What would you like reviewed?")).toHaveValue(
      "employment"
    )
    await page
      .getByLabel("Explain your relationship and requested authority")
      .fill(
        "Local QA: verify employment only, without library management authority."
      )
    await page
      .getByRole("button", { name: "Send one request for review" })
      .click()
    await expect(
      page.getByRole("status").filter({ hasText: "Request sent for review" })
    ).toBeVisible()
    const employment = (await workspace()).requests.find(
      (row) => row.fields.networkId === networkId && row.status === "pending"
    )!
    expect(employment.fields.libraryIds).toEqual([])
    const approved = await moderator.put(
      `/api/moderation/submissions/${employment.documentId}/status`,
      {
        data: {
          status: "approved",
          note: "Verified employment only; management is a separate review.",
        },
      }
    )
    expect(approved.ok()).toBeTruthy()
    const current = await workspace()
    expect(
      current.affiliations.find((row) => row.network.documentId === networkId)
        ?.status
    ).toBe("verified")
    expect(
      current.mandates.filter((row) => row.status === "approved")
    ).toHaveLength(0)
    const catalogue = await organiser.get(
      "/api/networks?q=Access%20Fixture%20Consortium"
    )
    const consortium = (await catalogue.json()).networks.find(
      (row: { slug: string }) => row.slug === "access-fixture-consortium"
    )
    await page.goto(`/staff/networks?network=${consortium.documentId}`, {
      waitUntil: "domcontentloaded",
    })
    await expect(page.getByLabel("What would you like reviewed?")).toHaveValue(
      "employment"
    )
    expect(
      await page
        .getByLabel("What would you like reviewed?")
        .locator('option[value="management"]')
        .count()
    ).toBe(0)
  } finally {
    await page.context().close()
  }
})

test("public network pages expose reviewed sources and preserve the service claim context", async ({
  browser,
}) => {
  const context = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage()
  try {
    await page.goto("/library-networks?q=Access%20Fixture", {
      waitUntil: "domcontentloaded",
    })
    await expect(
      page.getByRole("link", {
        name: "Access Fixture Library Service",
        exact: true,
      })
    ).toBeVisible()
    await expect(
      page.getByRole("link", {
        name: "Access Fixture Unreviewed Service",
        exact: true,
      })
    ).toHaveCount(0)
    await page
      .getByRole("link", {
        name: "Access Fixture Library Service",
        exact: true,
      })
      .click()
    await expect(
      page
        .getByRole("heading", { name: /Access Fixture Library Service/ })
        .first()
    ).toBeVisible()
    await expect(
      page.getByText("Access Fixture Second Library", { exact: true }).first()
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await page.screenshot({
      path: path.join(tmpdir(), "networks-public-mobile.png"),
      fullPage: true,
    })
    const claim = page
      .getByRole("link", { name: /work for|manage|claim|service access/i })
      .filter({ hasNotText: "Contact" })
      .first()
    await expect(claim).toHaveAttribute("href", new RegExp(networkId))
    await claim.click()
    await expect(page).toHaveURL(/auth\/signin\?callbackUrl=/)
    expect(new URL(page.url()).searchParams.get("callbackUrl")).toContain(
      networkId
    )
    const alias = await page.request.get(
      `${countryPath}/access-fixture-library-service`,
      { maxRedirects: 0 }
    )
    expect(alias.status()).toBe(308)
    expect(alias.headers().location).toContain(
      "/library-networks/access-fixture-library-service"
    )
    await page.goto(libraryPath, { waitUntil: "domcontentloaded" })
    await expect(
      page
        .getByRole("link", {
          name: "Access Fixture Library Service",
          exact: true,
        })
        .first()
    ).toBeVisible()
    const hidden = await page.request.get(
      "/library-networks/access-fixture-unreviewed-service"
    )
    expect(hidden.status()).toBe(404)
  } finally {
    await context.close()
  }
})

test("submits one owner request and moderates a frozen subset through the existing queue", async ({
  browser,
}) => {
  const page = await pageAs(browser, organiser, baseURL)
  try {
    await page.goto(`/staff/networks?network=${networkId}`, {
      waitUntil: "domcontentloaded",
    })
    await page.getByRole("radio", { name: /Manage library records/ }).check()
    await page.getByLabel("Your role", { exact: true }).fill("Service manager")
    await page
      .getByRole("combobox", { name: "Requested responsibility", exact: true })
      .click()
    await page
      .getByRole("option", {
        name: "Manage staff and delegate access as an owner",
        exact: true,
      })
      .click()
    await page
      .getByLabel("Evidence URL (optional)")
      .fill("https://example.test/service-staff")
    await page
      .getByLabel("Explain your relationship and requested authority")
      .fill(
        "Local QA: please review owner responsibility for these two fictional branches."
      )
    await expect(
      page.getByLabel("Access Fixture Second Library", { exact: true })
    ).toBeChecked()
    await page
      .getByRole("button", { name: "Send one request for review" })
      .click()
    await expect(
      page.getByRole("status").filter({ hasText: "Request sent for review" })
    ).toBeVisible()
    const requests = (await workspace()).requests.filter(
      (row) => row.fields.networkId === networkId && row.status === "pending"
    )
    expect(requests).toHaveLength(1)
    requestId = requests[0]!.documentId
    expect(requests[0]!.fields.libraryIds.sort()).toEqual(
      [firstId, secondId].sort()
    )
    expect(requests[0]!.fields.teamId).toBe(teamId)
    await page.screenshot({
      path: path.join(tmpdir(), "networks-staff-request.png"),
      fullPage: true,
    })
  } finally {
    await page.context().close()
  }
  const review = await pageAs(browser, moderator, baseURL)
  try {
    await review.goto(`/contribute/moderation/${requestId}`, {
      waitUntil: "domcontentloaded",
    })
    await review.getByText(/Choose approved scope/).click()
    await review
      .getByLabel("Access Fixture Second Library", { exact: true })
      .uncheck()
    await review.getByLabel("Approved responsibility").selectOption("owner")
    await review
      .getByLabel("Note to the contributor")
      .fill(
        "Owner responsibility verified for the public branch; send separate evidence for the second branch."
      )
    await review.getByRole("button", { name: "Approve", exact: true }).click()
    await expect(review.getByText("Approved.", { exact: true })).toBeVisible()
    await review.screenshot({
      path: path.join(tmpdir(), "networks-moderation.png"),
      fullPage: true,
    })
  } finally {
    await review.context().close()
  }
  const mandate = await fulfil()
  expect(mandate.approvedLibraryIds).toEqual([firstId])
  expect(mandate.ownerLibraryIds).toEqual([firstId])
  expect(mandate.fulfilment.complete).toBe(true)
})

test("revises the same needs-info case, connects Team coverage and defaults widgets to the service", async ({
  browser,
}) => {
  const mandate = (await workspace()).mandates.find(
    (row) => row.network.documentId === networkId && row.status === "approved"
  )!
  const sent = await organiser.post(`/api/networks/${networkId}/claims`, {
    data: {
      intent: "management",
      locale: "en",
      staffRole: "owner",
      role: "Service manager",
      department: "Libraries",
      evidenceUrl: "https://example.test/second-branch",
      note: "Review owner responsibility for the second fictional branch.",
      libraryIds: [secondId],
      teamId,
      mandateId: mandate.documentId,
    },
  })
  expect(sent.ok()).toBeTruthy()
  followupId = (await workspace()).requests.find(
    (row) => row.fields.networkId === networkId && row.status === "pending"
  )!.documentId
  const returned = await moderator.put(
    `/api/moderation/submissions/${followupId}/status`,
    {
      data: {
        status: "needs_info",
        note: "Please explain the second branch delegation.",
      },
    }
  )
  expect(returned.ok()).toBeTruthy()
  const page = await pageAs(browser, organiser, baseURL)
  try {
    await page.goto(
      `/staff/networks?network=${networkId}&request=${followupId}`,
      { waitUntil: "domcontentloaded" }
    )
    await expect(page.getByLabel("What would you like reviewed?")).toHaveValue(
      "management"
    )
    await expect(page.getByLabel("Evidence URL (optional)")).toHaveValue(
      "https://example.test/second-branch"
    )
    await expect(
      page.getByLabel("Access Fixture Public Library", { exact: true })
    ).not.toBeChecked()
    await page
      .getByLabel("Explain your relationship and requested authority")
      .fill(
        "Updated QA evidence confirms staff delegation at the second fictional branch."
      )
    await page
      .getByRole("button", { name: "Send one request for review" })
      .click()
    await expect(
      page.getByRole("status").filter({ hasText: "Request sent for review" })
    ).toBeVisible()
    expect(
      (await workspace()).requests.find((row) => row.documentId === followupId)
        ?.status
    ).toBe("pending")
    const approved = await moderator.put(
      `/api/moderation/submissions/${followupId}/status`,
      {
        data: {
          status: "approved",
          note: "Explicitly verified branch owner and delegation responsibility.",
          approvedLibraryIds: [secondId],
          approvedStaffRole: "owner",
        },
      }
    )
    expect(approved.ok()).toBeTruthy()
    expect((await fulfil()).approvedLibraryIds.sort()).toEqual(
      [firstId, secondId].sort()
    )
    await page.goto(`/staff/teams?network=${networkId}`, {
      waitUntil: "domcontentloaded",
    })
    await page
      .getByRole("button", { name: "Confirm connection", exact: true })
      .click()
    await expect(
      page.getByText(/Service connected\. Existing staff authority/)
    ).toBeVisible()
    const team = await (await organiser.get(`/api/staff/team/${teamId}`)).json()
    expect(team.primaryNetwork.documentId).toBe(networkId)
    expect(
      team.libraries.map((row: { documentId: string }) => row.documentId)
    ).toContain(secondId)
    const draft = await organiser.post(`/api/staff/team/${teamId}/widgets`, {
      data: {
        name: `Widget QA network ${Date.now().toString(36)}`,
        type: "finder",
      },
    })
    expect(draft.ok()).toBeTruthy()
    const widget = await draft.json()
    try {
      expect(widget.selection.spec.sources).toContainEqual({
        kind: "network",
        documentId: networkId,
      })
    } finally {
      await organiser.post(
        `/api/staff/team/${teamId}/widgets/${widget.documentId}/actions/archive`,
        { data: { version: widget.draftVersion } }
      )
    }
  } finally {
    await page.context().close()
  }
})
