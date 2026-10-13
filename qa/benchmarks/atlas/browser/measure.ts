import { chromium } from "@playwright/test"

import { report, requireDisposable, statistics } from "../runtime.js"

requireDisposable()
const browser = await chromium.launch({
  headless: true,
  args: [
    "--enable-precise-memory-info",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
})
const results: unknown[] = []
try {
  for (const mode of ["current", "tiles"]) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    })
    const session = await page.context().newCDPSession(page)
    await session.send("Network.enable")
    await session.send("Network.setCacheDisabled", { cacheDisabled: true })
    await session.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 100,
      downloadThroughput: (10 * 1000 * 1000) / 8,
      uploadThroughput: (10 * 1000 * 1000) / 8,
    })
    let transferred = 0,
      ranges = 0
    const errors: string[] = []
    session.on("Network.loadingFinished", (event) => {
      transferred += event.encodedDataLength
    })
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("response", (response) => {
      if (response.url().endsWith(".pmtiles") && response.status() === 206)
        ranges++
    })
    await page.goto(`http://127.0.0.1:17710/?mode=${mode}`)
    await page.waitForFunction(
      () =>
        (window as any).atlasBenchmark?.ready ||
        (window as any).atlasBenchmark?.error,
      { timeout: 30000 }
    )
    const initial = await page.evaluate(() => {
      const b = (window as any).atlasBenchmark

      return {
        firstLayerMs: b.firstLayerMs,
        error: b.error,
        initialHeap: (performance as any).memory.usedJSHeapSize,
      }
    })
    if (initial.error) throw new Error(initial.error)
    const firstLayerBytes = transferred
    await page.evaluate(() => (window as any).atlasBenchmark.startFrames())
    for (let n = 0; n < 100; n++) {
      const previousRequests = await page.evaluate(
        () => (window as any).atlasBenchmark.requests
      )
      await page.evaluate((i) => {
        const b = (window as any).atlasBenchmark
        b.map.jumpTo({
          center: [-0.12 + (i % 10) * 0.02, 51.5 + Math.floor(i / 10) * 0.01],
          zoom: i % 3 === 0 ? 5 : i % 3 === 1 ? 10 : 14,
        })
      }, n)
      await page.waitForFunction(
        (previous) => (window as any).atlasBenchmark.requests > previous,
        previousRequests,
        { timeout: 30000 }
      )
    }
    const final = await page.evaluate(() => {
      const b = (window as any).atlasBenchmark
      b.stopFrames()

      return {
        frames: b.frames as number[],
        heap: (performance as any).memory.usedJSHeapSize,
        maxGeometryBytes: b.maxGeometryBytes,
        requests: b.requests,
        modes: [...new Set(b.modes)],
        glRenderer: b.map
          .getCanvas()
          .getContext("webgl2")
          ?.getParameter(0x1f01),
      }
    })
    const row = {
      mode,
      ...initial,
      firstLayerBytes,
      totalBytes: transferred,
      heapAfter100Pans: final.heap,
      frameMs: statistics(final.frames),
      maxGeometryBytes: final.maxGeometryBytes,
      requests: final.requests,
      modes: final.modes,
      ranges,
      errors,
      renderer: final.glRenderer,
      reference: {
        browser: await browser.version(),
        viewport: [1280, 800],
        network: "10Mbps / 100ms",
        rendering:
          "headless SwiftShader; diagnostic only, not the reference mobile-device gate",
      },
    }
    results.push(row)
    console.log(JSON.stringify(row))
    await page.close()
  }
  await report("browser", { acceptanceDevice: false, results })
} finally {
  await browser.close()
}
