import { NextRequest, NextResponse } from "next/server"
import { expect, it } from "vitest"

import {
  liveSecurityRequest,
  liveSecurityResponse,
} from "../mobile-live/security"

it("creates an unspoofable document nonce and starts site scripts in report-only mode", () => {
  const input = new NextRequest("https://example.org/en/libraries", {
    headers: {
      "x-nonce": "forged",
      "content-security-policy": "unsafe",
      "content-security-policy-report-only": "unsafe",
    },
  })
  const req = liveSecurityRequest(input)
  const nonce = req.headers.get("x-nonce")
  expect(nonce).toBeTruthy()
  expect(nonce).not.toBe("forged")
  expect(req.headers.has("content-security-policy")).toBe(false)
  const response = liveSecurityResponse(req, NextResponse.next())
  expect(response.headers.get("content-security-policy-report-only")).toContain(
    `'nonce-${nonce}'`
  )
  expect(response.headers.get("content-security-policy-report-only")).toContain(
    "'strict-dynamic'"
  )
})
