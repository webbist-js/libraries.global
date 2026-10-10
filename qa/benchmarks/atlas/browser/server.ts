import { createReadStream } from "node:fs"
import { readFile, stat } from "node:fs/promises"
import { createServer } from "node:http"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { parseAtlasQueryRequest } from "@repo/shared-data"

import { currentGeometry, type Dataset } from "../engine.js"
import { artifactDirectory, readReport, requireDisposable } from "../runtime.js"

const { dirname, resolve } = path

requireDisposable()
const dataset = await readReport<Dataset>("dataset")
const require = createRequire(import.meta.url)
const mapLibre = dirname(require.resolve("maplibre-gl"))
const pmtiles = resolve(dirname(require.resolve("pmtiles")), "..", "pmtiles.js")
const files: Record<string, { path: string; type: string }> = {
  "/": {
    path: fileURLToPath(new URL("./index.html", import.meta.url)),
    type: "text/html",
  },
  "/vendor/maplibre-gl.js": {
    path: resolve(mapLibre, "maplibre-gl.js"),
    type: "text/javascript",
  },
  "/vendor/maplibre-gl.css": {
    path: resolve(mapLibre, "maplibre-gl.css"),
    type: "text/css",
  },
  "/vendor/pmtiles.js": { path: pmtiles, type: "text/javascript" },
}
const archive = resolve(artifactDirectory, "atlas-z10.pmtiles")
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1:17710")
    if (url.pathname === "/geometry" && req.method === "POST") {
      let body = ""
      for await (const chunk of req) {
        body += chunk
        if (Buffer.byteLength(body) > 32768) {
          res.writeHead(413).end()

          return
        }
      }
      const input = parseAtlasQueryRequest(JSON.parse(body))
      if (input.purpose !== "viewport" || !input.scope.bbox)
        throw new RangeError("Expected viewport scope")
      const result = await currentGeometry(
        { ...input.scope, bbox: input.scope.bbox },
        dataset
      )
      res
        .writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        })
        .end(JSON.stringify(result))

      return
    }
    if (url.pathname === "/archive.pmtiles") {
      const size = (await stat(archive)).size
      const match = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range ?? "")
      if (!match) {
        res.writeHead(416, { "Content-Range": `bytes */${size}` }).end()

        return
      }
      const start = Number(match[1]),
        end = Math.min(size - 1, Number(match[2]))
      if (start > end || start >= size) {
        res.writeHead(416).end()

        return
      }
      res.writeHead(206, {
        "Content-Type": "application/vnd.pmtiles",
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": end - start + 1,
        "Cache-Control": "public, max-age=31536000, immutable",

        "Access-Control-Allow-Origin": "http://127.0.0.1:17710",
        "Access-Control-Expose-Headers": "ETag, Content-Range",
        ETag: `"atlas-local-${size}"`,
      })
      createReadStream(archive, { start, end }).pipe(res)

      return
    }
    const file = files[url.pathname]
    if (!file) {
      res.writeHead(404).end()

      return
    }
    res
      .writeHead(200, { "Content-Type": file.type })
      .end(await readFile(file.path))
  } catch (error) {
    res
      .writeHead(error instanceof RangeError ? 400 : 503)
      .end(error instanceof Error ? error.message : String(error))
  }
})
server.listen(17710, "127.0.0.1", () =>
  console.log("Atlas benchmark browser: http://127.0.0.1:17710")
)
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close())
