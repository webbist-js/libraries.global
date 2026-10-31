// @vitest-environment happy-dom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { ApiPlayground } from "@/components/developers/ApiPlayground"
import { render } from "@/test/render"

const entityRef =
  "europe:england:west-midlands:sandwell:central-library-west-bromwich"
const record = {
  name: "Central Library (West Bromwich)",
  entityRef,
  sourceRecords: [],
}
const secret = `lg_api_${"a".repeat(43)}`
function mount() {
  render(<ApiPlayground teamName="Library service" showUsageWarning={false} />)
  fireEvent.change(screen.getByLabelText(/Team API key/), {
    target: { value: secret },
  })
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("clearly discloses Team usage and runs the normal authenticated API with no free proxy", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json({ data: [record], meta: { locale: "en" } })
    )
  vi.stubGlobal("fetch", fetch)
  mount()
  expect(
    screen.getByText("This playground uses your Team’s API allowance.")
  ).toBeTruthy()
  expect(
    screen.getByText(
      /Successful requests consume your Team’s shared request and response-data allowance/
    )
  ).toBeTruthy()
  expect(fetch).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText("Search query"), {
    target: { value: "Central" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Run request" }))
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain(
      "Live data · 200 OK"
    )
  )
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/search/libraries",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ q: "Central", locale: "en", limit: 10 }),
      credentials: "omit",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
    })
  )
  expect(screen.getByLabelText("JSON response").textContent).not.toContain(
    secret
  )
})
it("treats Read this record as another authenticated request, without a London restriction", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ data: [record], meta: {} }))
    .mockResolvedValueOnce(Response.json({ data: record, meta: {} }))
  vi.stubGlobal("fetch", fetch)
  mount()
  fireEvent.click(screen.getByRole("button", { name: "Run request" }))
  fireEvent.click(
    await screen.findByRole("button", {
      name: `Read this record: ${record.name}`,
    })
  )
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  expect(fetch).toHaveBeenLastCalledWith(
    `/api/v1/libraries/${encodeURIComponent(entityRef)}?locale=en`,
    expect.objectContaining({
      method: "GET",
      body: undefined,
      headers: { Authorization: `Bearer ${secret}` },
    })
  )
  await waitFor(() =>
    expect(screen.getByLabelText("JSON response").textContent).toContain(
      '"data": {'
    )
  )
  expect(
    (screen.getByLabelText(/Entity reference/) as HTMLInputElement).value
  ).toBe(entityRef)
  expect(
    screen.getByRole("region", { name: "Returned libraries" })
  ).toBeTruthy()
  expect(
    screen
      .getByRole("button", { name: `Read this record: ${record.name}` })
      .getAttribute("aria-pressed")
  ).toBe("true")
  expect(fetch).toHaveBeenCalledTimes(2)
})
it("lists records through the same metered API", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ data: [], meta: { nextCursor: null } }))
  vi.stubGlobal("fetch", fetch)
  mount()
  fireEvent.click(screen.getByRole("button", { name: "List records" }))
  fireEvent.change(screen.getByLabelText("Number of records"), {
    target: { value: "5" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Run request" }))
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("200 OK")
  )
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/libraries?locale=en&limit=5",
    expect.objectContaining({
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
    })
  )
})
it.each([401, 403, 429, 503])(
  "shows the actual authentication, entitlement or allowance error (%s)",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { code: "access_or_allowance_refused" } },
            { status }
          )
        )
    )
    mount()
    fireEvent.click(screen.getByRole("button", { name: "Run request" }))
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        `Live data · ${status}`
      )
    )
    expect(screen.getByLabelText("JSON response").textContent).toContain(
      "access_or_allowance_refused"
    )
  }
)
it("requires a key even if native form validation is bypassed", async () => {
  const fetch = vi.fn()
  vi.stubGlobal("fetch", fetch)
  render(<ApiPlayground teamName="Library service" showUsageWarning={false} />)
  fireEvent.submit(screen.getByRole("form", { name: "API request playground" }))
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    expect.stringContaining("Enter your Team API key")
  )
  expect(fetch).not.toHaveBeenCalled()
})
it("clears stale responses and warns that a timed-out request might still consume usage", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ data: [record], meta: {} }))
    .mockRejectedValueOnce(new Error("offline"))
  vi.stubGlobal("fetch", fetch)
  mount()
  fireEvent.click(screen.getByRole("button", { name: "Run request" }))
  await screen.findByLabelText("JSON response")
  fireEvent.change(screen.getByLabelText("Search query"), {
    target: { value: "Another Library" },
  })
  expect(screen.queryByLabelText("JSON response")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Run request" }))
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    expect.stringContaining("may still count toward your Team’s allowance")
  )
})
