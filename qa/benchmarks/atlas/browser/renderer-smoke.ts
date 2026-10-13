import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { createServer } from "node:http"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"

import { chromium } from "@playwright/test"

const root = path.resolve(new URL("../../../..", import.meta.url).pathname)
const scratch = await mkdtemp(path.join(tmpdir(), "atlas-renderer-smoke-"))
const require = createRequire(import.meta.url)
const mapLibre = path.dirname(require.resolve("maplibre-gl"))
// Use the compiler already installed with tsx; no native-tool image or archive
// is needed for this browser correctness check.
const esbuild = path.join(
  path.dirname(
    require.resolve("esbuild/package.json", {
      paths: [path.dirname(require.resolve("tsx/package.json"))],
    })
  ),
  "bin/esbuild"
)
let server: ReturnType<typeof createServer> | undefined,
  browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
try {
  execFileSync(
    esbuild,
    [
      path.join(root, "qa/benchmarks/atlas/browser/renderer-entry.ts"),
      "--bundle",
      "--format=iife",
      "--platform=browser",
      `--outfile=${scratch}/renderer.js`,
    ],
    { stdio: "ignore" }
  )
  const entry = await readFile(path.join(scratch, "renderer.js")),
    vendor = await readFile(path.join(mapLibre, "maplibre-gl.js")),
    css = await readFile(path.join(mapLibre, "maplibre-gl.css"))
  server = createServer((request, response) => {
    response.setHeader(
      "content-type",
      request.url === "/"
        ? "text/html"
        : request.url === "/vendor.css"
          ? "text/css"
          : "text/javascript"
    )
    response.end(
      request.url === "/vendor.js"
        ? vendor
        : request.url === "/vendor.css"
          ? css
          : request.url === "/renderer.js"
            ? entry
            : '<link rel="stylesheet" href="/vendor.css"><div id="map" style="height:600px;width:900px"></div><script>window.atlasRendererErrors=[]</script><script src="/vendor.js"></script><script src="/renderer.js"></script>'
    )
  })
  await new Promise<void>((resolve) =>
    server!.listen(17711, "127.0.0.1", resolve)
  )
  browser = await chromium.launch({
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  })
  const page = await browser.newPage(),
    errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("http://127.0.0.1:17711")
  if (errors.length) throw new Error(JSON.stringify(errors))
  await page.evaluate(() => (window as any).atlasRendererSmoke.start())
  let maximumSources = 0,
    maximumLayers = 0
  for (let n = 0; n < 100; n++) {
    const result = await page.evaluate(
      (n) =>
        (window as any).atlasRendererSmoke.step(n % 2 === 0, (n % 7) / 1000),
      n
    )
    maximumSources = Math.max(maximumSources, result.sources)
    maximumLayers = Math.max(maximumLayers, result.layers)
    if (!result.rendered || result.sources > 2 || result.layers > 8)
      throw new Error(
        `Renderer graph did not complete: ${JSON.stringify(result)}`
      )
  }
  await page.evaluate(() => (window as any).atlasRendererSmoke.step(true))
  await page.screenshot({ path: path.join(scratch, "renderer.png") })
  const weighted = await page.evaluate(() =>
    (window as any).atlasRendererSmoke.weightedCluster()
  )
  if (
    !weighted.length ||
    weighted.some(
      (row: any) =>
        row.total !== 1901 ||
        row.matches !== 1901 ||
        row.high !== 1901 ||
        row.point_count !== 3
    )
  )
    throw new Error(
      `Cluster lost exact population weights: ${JSON.stringify(weighted)}`
    )
  const density = await page.evaluate(() =>
    (window as any).atlasRendererSmoke.densityGrid()
  )
  if (
    density.total !== 1200 ||
    density.cells !== 40 ||
    density.pinCount !== 0 ||
    density.heatClickHandled ||
    !density.restoredPins ||
    density.maxzoom !== 13 ||
    density.colour.every((v: number, i: number) => v === density.transparent[i]) ||
    density.transparent.slice(0, 3).some((v: number) => v !== 238)
  )
    throw new Error(`Density surface did not render: ${JSON.stringify(density)}`)
  const result = await page.evaluate(() => ({
    errors: (window as any).atlasRendererErrors,
    remainingSources: (window as any).atlasRendererSmoke.finish(),
  }))
  if (errors.length || result.errors.length || result.remainingSources)
    throw new Error(JSON.stringify({ pageErrors: errors, ...result }))
  console.log(
    JSON.stringify({
      passed: true,
      generations: 100,
      maximumSources,
      maximumLayers,
      density,
      remainingSources: result.remainingSources,
    })
  )
} finally {
  await browser?.close()
  if (server)
    await new Promise<void>((resolve) => server!.close(() => resolve()))
  await rm(scratch, { recursive: true, force: true })
}
