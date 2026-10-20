// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, render, screen } from "@/test/render"

import { LocationEventsStrip } from "../LocationEventsStrip"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it("scopes a country without an ISO code by its canonical slug and reads the response envelope", async () => {
  const request = vi.fn().mockResolvedValue(
    Response.json({
      events: [
        {
          documentId: "event-1",
          title: "Synthetic event",
          eventType: "talk",
          isFree: true,
          libraryName: "Fixture library",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 6,
    })
  )
  vi.stubGlobal("fetch", request)
  render(<LocationEventsStrip countrySlug="england" locationLabel="England" />)
  await screen.findByText("Synthetic event")
  const requestedUrl = request.mock.calls.at(0)?.at(0)
  expect(requestedUrl).toBeDefined()
  const query = new URL(String(requestedUrl), "http://localhost").searchParams
  expect(query.get("country")).toBe("england")
  expect(query.get("countryCode")).toBeNull()
  expect(query.get("limit")).toBe("6")
  expect(screen.getByText("Fixture library")).toBeTruthy()
})
