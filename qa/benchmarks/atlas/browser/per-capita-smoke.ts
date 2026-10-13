import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import { createServer } from "node:http"
import { createRequire } from "node:module"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"

import { chromium } from "@playwright/test"
import { atlasPopulationBaseline, atlasLocalGeography } from "@repo/shared-data"

const root = path.resolve(new URL("../../../..", import.meta.url).pathname)
const scratch = await mkdtemp(path.join(tmpdir(), "atlas-capita-smoke-"))
const require = createRequire(import.meta.url)
const mapLibre = path.dirname(require.resolve("maplibre-gl"))
const screenshot = path.join(tmpdir(), "atlas-per-capita-browser.png")
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
      path.join(root, "qa/benchmarks/atlas/browser/per-capita-entry.ts"),
      "--bundle",
      "--jsx=automatic",
      "--format=iife",
      "--platform=browser",
      `--alias:@=${root}/apps/ui/src`,
      `--alias:react=${root}/apps/ui/node_modules/react`,
      `--alias:react-dom=${root}/apps/ui/node_modules/react-dom`,
      `--outfile=${scratch}/entry.js`,
    ],
    { stdio: "inherit" }
  )
  // Use the app's existing compiled CSS; this harness never installs packages.
  const cssDirectory = path.join(root, "apps/ui/.next/static/css")
  const appCss = (
    await Promise.all(
      (await readdir(cssDirectory))
        .filter((file) => file.endsWith(".css"))
        .map((file) => readFile(path.join(cssDirectory, file), "utf8"))
    )
  ).join("\n")
  const entry = await readFile(path.join(scratch, "entry.js")),
    vendor = await readFile(path.join(mapLibre, "maplibre-gl.js")),
    css = await readFile(path.join(mapLibre, "maplibre-gl.css"))
  const geometry = await readFile(
    path.join(root, "apps/ui/public", atlasPopulationBaseline.geometryUrl)
  )
  const localGeometry = await readFile(
    path.join(root, "apps/ui/public", atlasLocalGeography.geometryUrl)
  )
  if (!process.env.ATLAS_COUNTRY_TEST_ARCHIVE)
    throw new Error(
      "Set ATLAS_COUNTRY_TEST_ARCHIVE to a validated countries.pmtiles file"
    )
  const archive = await readFile(process.env.ATLAS_COUNTRY_TEST_ARCHIVE)
  server = createServer((request, response) => {
    if (request.url === "/countries.pmtiles") {
      const range = /^bytes=(\d+)-(\d+)$/.exec(request.headers.range ?? "")
      if (!range) {
        response.writeHead(400)
        response.end()

        return
      }
      const from = Number(range[1]),
        to = Math.min(Number(range[2]), archive.length - 1)
      response.writeHead(206, {
        "content-type": "application/vnd.pmtiles",
        "content-range": `bytes ${from}-${to}/${archive.length}`,
        etag: '"test"',
      })
      response.end(archive.subarray(from, to + 1))

      return
    }
    response.setHeader(
      "content-type",
      request.url === "/"
        ? "text/html"
        : request.url?.endsWith(".css")
          ? "text/css"
          : request.url?.endsWith(".geojson")
            ? "application/geo+json"
            : "text/javascript"
    )
    response.end(
      request.url === "/entry.js"
        ? entry
        : request.url === "/vendor.js"
          ? vendor
          : request.url === "/app.css"
            ? appCss
            : request.url === "/vendor.css"
              ? css
              : request.url === atlasPopulationBaseline.geometryUrl
                ? geometry
                : request.url === atlasLocalGeography.geometryUrl
                  ? localGeometry
                  : '<link rel="stylesheet" href="/app.css"><style>body{margin:0;background:#fff;font:14px system-ui;color:#17162B}#map{height:800px;width:1280px}#panel{position:absolute;top:30px;left:20px;width:340px;max-height:720px;overflow:auto;background:white;padding:16px;border-radius:16px}select{max-width:100%}</style><div id="map"></div><div id="panel"></div><script>window.atlasRendererErrors=[]</script><script src="/vendor.js"></script><script src="/entry.js"></script>'
    )
  })
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve))
  browser = await chromium.launch({
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  })
  const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    }),
    errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
  await page.evaluate(() => (window as any).atlasPerCapitaSmoke.start())
  const geojson = await page.evaluate(() =>
    (window as any).atlasPerCapitaSmoke.step(false)
  )
  const tiles = await page.evaluate(() =>
    (window as any).atlasPerCapitaSmoke.step(true)
  )
  const local = await page.evaluate(() =>
    (window as any).atlasPerCapitaSmoke.local()
  )
  await page.screenshot({ path: screenshot })
  const result = await page.evaluate(() => ({
    errors: (window as any).atlasRendererErrors,
    remaining: (window as any).atlasPerCapitaSmoke.finish(),
  }))
  if (errors.length || result.errors.length || result.remaining)
    throw new Error(JSON.stringify({ pageErrors: errors, ...result }))
  console.log(
    JSON.stringify({
      passed: true,
      geojson,
      tiles,
      local,
      remaining: result.remaining,
      screenshot,
    })
  )
} finally {
  await browser?.close()
  if (server)
    await new Promise<void>((resolve) => server!.close(() => resolve()))
  await rm(scratch, { recursive: true, force: true })
}
