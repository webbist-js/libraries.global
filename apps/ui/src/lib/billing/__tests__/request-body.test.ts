import { describe, expect, it } from "vitest"

import { readBillingJson } from "../request-body"

const request = (body: string, length?: string) =>
  new Request("https://libraries.global/api/billing/checkout", {
    method: "POST",
    body,
    headers: length ? { "Content-Length": length } : {},
  })

describe("bounded billing selections", () => {
  it("reads a small JSON selection", async () => {
    expect(await readBillingJson(request('{"plan":"pro"}'))).toEqual({
      plan: "pro",
    })
  })
  it("refuses oversized bodies even when the claimed size is smaller", async () => {
    await expect(
      readBillingJson(
        request(JSON.stringify({ input: "x".repeat(5000) }), "20")
      )
    ).rejects.toMatchObject({ status: 413 })
    await expect(readBillingJson(request("{}", "5000"))).rejects.toMatchObject({
      status: 413,
    })
  })
  it("reports malformed input without reflecting the body", async () => {
    await expect(readBillingJson(request("not json"))).rejects.toMatchObject({
      status: 400,
      code: "invalid_billing_request",
    })
  })
})
