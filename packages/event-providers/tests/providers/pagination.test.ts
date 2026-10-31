import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { safeFetchText } from "../../src/lib/safe-fetch"
import { aspenProvider } from "../../src/providers/aspen"
import { solusProvider } from "../../src/providers/solus"

vi.mock("../../src/lib/safe-fetch", () => ({
  safeFetchText: vi.fn(),
  parseJsonBody: (response: { text: string }) => JSON.parse(response.text),
}))
const response = (value: unknown) =>
  ({ ok: true, status: 200, text: JSON.stringify(value) }) as Awaited<
    ReturnType<typeof safeFetchText>
  >
beforeEach(() => vi.resetAllMocks())
afterEach(() => vi.useRealTimers())
it("uses one bounded deadline for Solus credential verification and its event probe", async () => {
  vi.mocked(safeFetchText)
    .mockResolvedValueOnce(response({ data: { token: "fixture" } }))
    .mockResolvedValueOnce(response({ data: { events: [] } }))
  await solusProvider.test({
    endpoint: "https://feed.example.org",
    secretKey: "fixture",
  })
  const calls = vi.mocked(safeFetchText).mock.calls
  expect(calls).toHaveLength(2)
  expect(calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  expect(calls[1]?.[1]?.signal).toBe(calls[0]?.[1]?.signal)
})
it("bounds Aspen pages even when every result is empty or filtered", async () => {
  vi.mocked(safeFetchText).mockResolvedValue(
    response({ result: { success: true, items: [], totalPages: 100_000 } })
  )
  await expect(
    aspenProvider.fetch(
      {
        endpoint: "https://feed.example.org",
        clientId: "fixture",
        clientSecret: "fixture",
      },
      []
    )
  ).rejects.toThrow("pagination budget")
  expect(safeFetchText).toHaveBeenCalledTimes(100)
  expect(
    vi
      .mocked(safeFetchText)
      .mock.calls.every(([, options]) => options?.signal instanceof AbortSignal)
  ).toBe(true)
})
it("bounds Solus filtered pages and includes token acquisition in the same deadline", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(safeFetchText)
    .mockResolvedValueOnce(response({ data: { token: "fixture" } }))
    .mockResolvedValue(
      response({
        data: {
          available: 100_000,
          event_list: Array.from({ length: 100 }, () => ({})),
        },
      })
    )
  const result = solusProvider.fetch(
    { endpoint: "https://feed.example.org", secretKey: "fixture" },
    []
  )
  const assertion = expect(result).rejects.toThrow("pagination budget")
  await vi.runAllTimersAsync()
  await assertion
  expect(safeFetchText).toHaveBeenCalledTimes(101)
  const calls = vi.mocked(safeFetchText).mock.calls
  expect(calls[0]?.[1]?.signal).toBe(calls[1]?.[1]?.signal)
})
