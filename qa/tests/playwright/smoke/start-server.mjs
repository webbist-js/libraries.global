import { cp, access } from "node:fs/promises"
import { fileURLToPath } from "node:url"

// Exercise the same traced server and asset layout as the production image.
const ui = new URL("../../../../apps/ui/", import.meta.url)
const dist = process.env.NEXT_DIST_DIR ?? ".next"
const standalone = new URL(`${dist}/standalone/apps/ui/`, ui)
await access(new URL("./server.js", standalone))
await cp(new URL("./public/", ui), new URL("./public/", standalone), {
  recursive: true,
})
await cp(
  new URL(`${dist}/static/`, ui),
  new URL(`${dist}/static/`, standalone),
  {
    recursive: true,
  }
)
process.chdir(fileURLToPath(standalone))
await import(new URL("./server.js", standalone).href)
