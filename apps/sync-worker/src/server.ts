// apps/sync-worker/src/server.ts
import { createServer } from "node:http"

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
      let body = ""
      for await (const chunk of req) body += chunk
      const { credentialDocumentId } = JSON.parse(body) as {
        credentialDocumentId: string
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

  server.listen(port, () => {
    console.log(`[server] Health server listening on port ${port}`)
  })
}
