import { beforeEach, describe, it, expect, vi } from "vitest"

const mocks = vi.hoisted(() => ({ proxy: vi.fn() }))
vi.mock("@/lib/staff-proxy", () => ({ proxyStaff: mocks.proxy }))
import { GET, POST, PUT } from "@/app/api/networks/[[...path]]/route"

const ID = "network00000000000000001"
beforeEach(() => mocks.proxy.mockResolvedValue(Response.json({ ok: true })))
const request = (method: string) =>
  new Request("https://libraries.example/api/networks", { method })
describe("Network gateway", () => {
  it("forwards only bounded network operations and preserves explicit role requests", async () => {
    await POST(request("POST"), {
      params: Promise.resolve({ path: [ID, "claims"] }),
    })
    const options = mocks.proxy.mock.calls.at(-1)![1]
    expect(options.path).toBe(`networks/${ID}/claims`)
    expect(options.bodyKeys).toContain("staffRole")
    expect(options.bodyKeys).not.toContain("baUserId")
    expect(options.bodyKeys).not.toContain("approvedLibraryIds")
    expect(options.bodyKeys).not.toContain("verifiedAt")
  })
  it.each([
    ["unrecognised", [ID, "erase"]],
    ["traversal", ["..", "claims"]],
    ["admin path", ["admin", "people"]],
  ])("rejects %s paths", async (_, path) => {
    expect(
      (await POST(request("POST"), { params: Promise.resolve({ path }) }))
        .status
    ).toBe(404)
  })
  it("does not allow read or update methods to submit a claim", async () => {
    expect(
      (
        await GET(request("GET"), {
          params: Promise.resolve({ path: [ID, "claims"] }),
        })
      ).status
    ).toBe(404)
    expect(
      (
        await PUT(request("PUT"), {
          params: Promise.resolve({ path: [ID, "claims"] }),
        })
      ).status
    ).toBe(404)
  })
})
