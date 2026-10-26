import { readFileSync } from "node:fs"
import vm from "node:vm"

import { defaultWidgetConfig } from "@repo/shared-data"
import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { atlasCohortRequest } from "@/lib/proxies/atlasCohort"
import { betaGate } from "@/lib/proxies/betaGate"
import { widgetResponse } from "@/lib/proxies/widgets"
import { widgetEmbedCode } from "@/lib/widgets/client"

const publicId = "a".repeat(24)
beforeEach(() => {
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-secret")
  vi.stubEnv("STRAPI_URL", "http://localhost:1337")
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
describe("widget framing", () => {
  it("only changes framing for exact standalone widget paths", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ origins: ["https://council.example"] })
      )
    vi.stubGlobal("fetch", fetch)
    const result = await widgetResponse(
      new NextRequest(`https://libraries.example/embed/w/${publicId}`)
    )
    expect(result?.headers.get("content-security-policy")).toBe(
      `frame-ancestors 'self' https://council.example; report-uri /api/widgets/${publicId}/reports`
    )
    expect(result?.headers.get("cache-control")).toContain("no-store")
    expect(
      await widgetResponse(
        new NextRequest("https://libraries.example/staff/teams/widgets")
      )
    ).toBeNull()
    expect(
      await widgetResponse(
        new NextRequest(`https://libraries.example/embed/w/${publicId}/other`)
      )
    ).toBeNull()
    expect(fetch).toHaveBeenCalledOnce()
  })
  it("fails closed for revoked widgets, failures and invalid stored origins", async () => {
    for (const response of [
      new Response(null, { status: 404 }),
      Response.json({ origins: ["https://*.example.org"] }),
    ]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response))
      expect(
        (
          await widgetResponse(
            new NextRequest(`https://libraries.example/embed/w/${publicId}`)
          )
        )?.headers.get("content-security-policy")
      ).toContain("frame-ancestors 'none'")
    }
  })
  it("does not assign Atlas visitor cohorts to public widgets or their helper", () => {
    vi.stubEnv("ATLAS_QUERY_ENABLED", "true")
    vi.stubEnv("ATLAS_PROVIDER", "scalable")
    vi.stubEnv("ATLAS_ROLLOUT_PERCENT", "50")
    expect(
      atlasCohortRequest(
        new NextRequest(`https://libraries.example/embed/w/${publicId}`)
      ).created
    ).toBeUndefined()
    expect(
      atlasCohortRequest(
        new NextRequest("https://libraries.example/embed/resize.js")
      ).created
    ).toBeUndefined()
    expect(
      atlasCohortRequest(new NextRequest("https://libraries.example/atlas"))
        .created
    ).toMatch(/^[a-f0-9]{32}$/)
  })
  it("preserves the beta gate for iframe pages, resize helper and reports", () => {
    vi.stubEnv("BETA_GATE_ENABLED", "true")
    for (const path of [
      `/embed/w/${publicId}`,
      "/embed/resize.js",
      `/api/widgets/${publicId}/reports`,
    ])
      expect(
        betaGate(new NextRequest(`https://libraries.example${path}`))
      ).not.toBeNull()
  })
  it("escapes copied markup and includes a fallback outside the iframe", () => {
    const config = {
      ...defaultWidgetConfig(),
      title: '" onload="alert(1)<script>',
      locate: true,
    }
    const code = widgetEmbedCode(publicId, config, "https://libraries.example")
    expect(code).toContain('title="&quot; onload=&quot;alert(1)&lt;script&gt;"')
    expect(code).toContain('allow="geolocation"')
    expect(code).toContain("</iframe>\n<script")
    expect(code).toContain('<p><a href="https://libraries.example/embed/w/')
  })
})

describe("optional resize script", () => {
  it("checks sender origin, window, widget identity and bounded integer height", () => {
    type ResizeEvent = {
      origin: string
      source: object
      data: { type: string; publicId: string; height: number }
    }
    let listener: ((event: ResizeEvent) => void) | undefined
    const frame = {
      src: `https://libraries.example/embed/w/${publicId}`,
      dataset: { lgWidget: publicId },
      contentWindow: {},
      style: { height: "640px" },
    }
    const code = readFileSync(
      new URL("../../../../public/embed/resize.js", import.meta.url),
      "utf8"
    )
    // eslint-disable-next-line sonarjs/code-eval -- execute the repository-owned resize helper in an isolated test VM.
    vm.runInNewContext(code, {
      URL,
      document: {
        currentScript: { src: "https://libraries.example/embed/resize.js" },
        querySelectorAll: () => [frame],
      },
      window: {
        addEventListener: (_name: string, fn: (event: ResizeEvent) => void) => {
          listener = fn
        },
      },
    })
    const good = {
      origin: "https://libraries.example",
      source: frame.contentWindow,
      data: { type: "libraries-global-widget-resize", publicId, height: 850 },
    }
    for (const bad of [
      { ...good, origin: "https://evil.example" },
      { ...good, source: {} },
      { ...good, data: { ...good.data, publicId: "x".repeat(24) } },
      { ...good, data: { ...good.data, height: 1601 } },
      { ...good, data: { ...good.data, height: 850.5 } },
    ])
      listener!(bad)
    expect(frame.style.height).toBe("640px")
    listener!(good)
    expect(frame.style.height).toBe("850px")
  })
})
