// apps/sync-worker/src/server.ts
import { createServer } from "node:http"

let lastSync: { runId: string; status: string; at: string } | null = null
let currentStatus: "idle" | "running" = "idle"
let nextSync: string | null = null

export function setLastSync(info: typeof lastSync): void {
  lastSync = info
}
export function setSyncStatus(s: "idle" | "running"): void {
  currentStatus = s
}
export function setNextSync(iso: string): void {
  nextSync = iso
}

export function startHealthServer(port: number): void {
  const server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json")

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200)
      res.end(
        JSON.stringify({
          ok: true,
          status: currentStatus,
          lastSync,
          nextSync,
          version: "1.0.0",
        })
      )

      return
    }

    res.writeHead(404)
    res.end(JSON.stringify({ error: "Not found" }))
  })

  // Bind to loopback by default; set WORKER_HOST=0.0.0.0 only when Strapi runs
  // on another host and the port is on a private network.
  const host = process.env.WORKER_HOST ?? "127.0.0.1"
  server.listen(port, host, () => {
    console.log(`[server] Health server listening on ${host}:${port}`)
  })
}
