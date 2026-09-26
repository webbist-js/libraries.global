// apps/sync-worker/src/server.ts
import { createHash, timingSafeEqual } from "node:crypto"
import { createServer, type IncomingMessage } from "node:http"

import { decrypt } from "@repo/events-crypto"

import db from "./db"
import { getProvider } from "./providers"
import type { ProviderKey } from "./providers/types"

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

/**
 * /test-credential decrypts stored provider credentials and calls out to the
 * provider, so it must only be callable by Strapi. Fails closed when
 * WORKER_SECRET is unset.
 */
function hasWorkerSecret(req: IncomingMessage): boolean {
  const expected = process.env.WORKER_SECRET
  const provided = req.headers["x-worker-secret"]
  if (!expected || typeof provided !== "string" || !provided) return false
  const a = createHash("sha256").update(provided).digest()
  const b = createHash("sha256").update(expected).digest()

  return timingSafeEqual(a, b)
}

export function startHealthServer(port: number): void {
  const server = createServer(async (req, res) => {
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

    if (req.method === "POST" && req.url === "/test-credential") {
      if (!hasWorkerSecret(req)) {
        res.writeHead(401)
        res.end(JSON.stringify({ ok: false, error: "Unauthorized" }))

        return
      }
      let body = ""
      let bodySize = 0
      const MAX_BODY = 65_536 // 64 KB
      for await (const chunk of req) {
        bodySize += (chunk as Buffer).length
        if (bodySize > MAX_BODY) {
          res.writeHead(413)
          res.end(
            JSON.stringify({ ok: false, error: "Request body too large" })
          )

          return
        }
        body += chunk
      }

      let credentialDocumentId: string
      try {
        const parsed = JSON.parse(body) as { credentialDocumentId?: string }
        if (typeof parsed.credentialDocumentId !== "string")
          throw new Error("Missing credentialDocumentId")
        credentialDocumentId = parsed.credentialDocumentId
      } catch {
        res.writeHead(400)
        res.end(JSON.stringify({ ok: false, error: "Invalid JSON body" }))

        return
      }

      const row = await db("ev_event_credentials")
        .select("provider", "credentials_encrypted")
        .where("document_id", credentialDocumentId)
        .first()

      if (!row) {
        res.writeHead(404)
        res.end(JSON.stringify({ ok: false, error: "Credential not found" }))

        return
      }

      const key = process.env.EVENTS_CREDENTIAL_KEY!
      const prevKey = process.env.EVENTS_CREDENTIAL_KEY_PREV
      let credentials: Record<string, string>
      try {
        credentials = JSON.parse(
          decrypt(row.credentials_encrypted as string, key, prevKey)
        ) as Record<string, string>
      } catch {
        res.writeHead(500)
        res.end(JSON.stringify({ ok: false, error: "Decryption failed" }))

        return
      }

      const provider = getProvider(row.provider as ProviderKey)
      if (!provider) {
        res.writeHead(400)
        res.end(
          JSON.stringify({
            ok: false,
            error: `No provider for "${row.provider as string}"`,
          })
        )

        return
      }

      try {
        const result = await provider.test(credentials)
        res.writeHead(200)
        res.end(JSON.stringify(result))
      } catch (err: any) {
        res.writeHead(200)
        res.end(JSON.stringify({ ok: false, error: err.message as string }))
      }

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
