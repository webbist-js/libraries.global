import { describe, expect, it } from "vitest"

import {
  buildSecurityHeaders,
  imageRemotePatterns,
} from "../security-headers.mjs"

const header = (
  list: { key: string; value: string }[],
  key: string
): string | undefined => list.find((h) => h.key === key)?.value

describe("buildSecurityHeaders", () => {
  const production = buildSecurityHeaders({
    strapiAdminOrigin: "https://cms.libraries.global",
    isProduction: true,
  })

  it("only allows framing by the site itself and the Strapi admin", () => {
    expect(header(production, "Content-Security-Policy")).toBe(
      "frame-ancestors 'self' https://cms.libraries.global"
    )
  })

  it("allows only self-framing when no Strapi admin origin is configured", () => {
    const list = buildSecurityHeaders({ isProduction: true })

    expect(header(list, "Content-Security-Policy")).toBe(
      "frame-ancestors 'self'"
    )
  })

  it("reduces a Strapi URL with a path to its origin", () => {
    const list = buildSecurityHeaders({
      strapiAdminOrigin: "https://cms.libraries.global/admin/",
      isProduction: true,
    })

    expect(header(list, "Content-Security-Policy")).toBe(
      "frame-ancestors 'self' https://cms.libraries.global"
    )
  })

  it("ignores a Strapi URL that isn't a URL", () => {
    const list = buildSecurityHeaders({
      strapiAdminOrigin: "not a url",
      isProduction: true,
    })

    expect(header(list, "Content-Security-Policy")).toBe(
      "frame-ancestors 'self'"
    )
  })

  it("sets nosniff, the referrer policy and the permissions policy", () => {
    expect(header(production, "X-Content-Type-Options")).toBe("nosniff")
    expect(header(production, "Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin"
    )
    expect(header(production, "Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=(self)"
    )
  })

  it("sends HSTS for two years with subdomains in production only", () => {
    expect(header(production, "Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains"
    )
    const dev = buildSecurityHeaders({ isProduction: false })
    expect(header(dev, "Strict-Transport-Security")).toBeUndefined()
  })
})

describe("imageRemotePatterns", () => {
  it("lists the Strapi hosts and the extra CDN hosts, never a wildcard", () => {
    const patterns = imageRemotePatterns({
      hosts: [
        "http://127.0.0.1:1337",
        "https://cms.libraries.global",
        "cdn.libraries.global, images.example.org ,, bad host",
      ],
    })

    expect(patterns).toEqual([
      { protocol: "http", hostname: "127.0.0.1", port: "1337" },
      { protocol: "https", hostname: "cms.libraries.global", port: "" },
      { protocol: "https", hostname: "cdn.libraries.global", port: "" },
      { protocol: "https", hostname: "images.example.org", port: "" },
    ])
    expect(patterns.some((p) => p.hostname === "*")).toBe(false)
  })

  it("de-duplicates hosts and skips empty input", () => {
    const patterns = imageRemotePatterns({
      hosts: [
        undefined,
        "https://cms.libraries.global",
        "cms.libraries.global",
      ],
    })

    expect(patterns).toEqual([
      { protocol: "https", hostname: "cms.libraries.global", port: "" },
    ])
  })
})
